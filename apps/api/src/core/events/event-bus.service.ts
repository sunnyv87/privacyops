import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'crypto';
import { connect, NatsConnection, JSONCodec, JetStreamManager, JetStreamClient } from 'nats';
import { CorrelationIdMiddleware } from '@/core/telemetry/correlation-id.middleware';
import { PrometheusService } from '@/core/telemetry/prometheus.service';

export interface PlatformEvent {
  type: string;
  tenantId: string;
  data: any;
  timestamp: Date;
  correlationId?: string;
  eventId?: string;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private connection: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private codec = JSONCodec();
  private eventCounts = new Map<string, { success: number; failure: number }>();
  private readonly hmacSecret: string | null = null;
  /** In-memory idempotency cache: eventId -> timestamp. Entries expire after IDEMPOTENCY_TTL_MS. */
  private processedEvents = new Map<string, number>();
  private static readonly IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private idempotencyCleanupTimer: ReturnType<typeof setInterval> | null = null;

  private prometheus: PrometheusService | null = null;

  constructor(private readonly config: ConfigService) {
    this.hmacSecret = this.config.get<string>('EVENT_HMAC_SECRET') || null;
  }

  /** Late-bind PrometheusService to avoid circular DI during module init. */
  setPrometheus(prometheus: PrometheusService) {
    this.prometheus = prometheus;
  }

  async onModuleInit() {
    try {
      const natsUrl = this.config.get('NATS_URL', 'nats://localhost:4222');
      const natsToken = this.config.get<string>('NATS_TOKEN');
      const natsUser = this.config.get<string>('NATS_USER');
      const natsPass = this.config.get<string>('NATS_PASS');

      const connectOpts: any = { servers: natsUrl };
      if (natsToken) {
        connectOpts.token = natsToken;
      } else if (natsUser && natsPass) {
        connectOpts.user = natsUser;
        connectOpts.pass = natsPass;
      }

      this.connection = await connect(connectOpts);

      // Setup JetStream
      const jsm: JetStreamManager = await this.connection.jetstreamManager();

      // Create stream for platform events
      try {
        await jsm.streams.add({
          name: 'PRIVACYOPS',
          subjects: ['privacyops.>'],
          retention: 'limits' as any,
          max_msgs: 1000000,
          max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
        });
      } catch {
        // Stream may already exist
      }

      // Create DLQ stream for failed events
      try {
        await jsm.streams.add({
          name: 'PRIVACYOPS_DLQ',
          subjects: ['privacyops-dlq.>'],
          retention: 'limits' as any,
          max_msgs: 100000,
          max_age: 30 * 24 * 60 * 60 * 1000000000, // 30 days in nanoseconds
        });
      } catch {
        // DLQ stream may already exist
      }

      this.js = this.connection.jetstream();
      this.logger.log('NATS connected with DLQ support');
    } catch (error) {
      this.logger.warn(`NATS connection failed, events will be logged only: ${error}`);
    }

    // Periodically purge expired idempotency entries
    this.idempotencyCleanupTimer = setInterval(() => {
      const cutoff = Date.now() - EventBusService.IDEMPOTENCY_TTL_MS;
      for (const [id, ts] of this.processedEvents) {
        if (ts < cutoff) this.processedEvents.delete(id);
      }
    }, 60_000);
  }

  async onModuleDestroy() {
    if (this.idempotencyCleanupTimer) clearInterval(this.idempotencyCleanupTimer);
    await this.connection?.close();
  }

  async publish(event: PlatformEvent): Promise<void> {
    // Validate tenantId is present and well-formed
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.length === 0) {
      this.logger.error(`Refusing to publish event ${event.type}: missing or invalid tenantId`);
      return;
    }

    // Auto-assign a unique eventId for idempotency tracking
    if (!event.eventId) {
      event.eventId = randomUUID();
    }

    // Auto-populate correlationId from request context if not set
    if (!event.correlationId) {
      event.correlationId = CorrelationIdMiddleware.getCorrelationId();
    }

    const subject = `privacyops.${event.type}`;
    const payload: Record<string, any> = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

    if (this.hmacSecret) {
      payload._hmac = createHmac('sha256', this.hmacSecret)
        .update(JSON.stringify({ type: event.type, tenantId: event.tenantId, eventId: event.eventId }))
        .digest('hex');
    }

    if (this.js) {
      await this.js.publish(subject, this.codec.encode(payload));
    } else {
      this.logger.log(`[Event] ${subject}: ${JSON.stringify(payload)}`);
    }

    this.prometheus?.eventPublishedTotal.inc({ event_type: event.type });
  }

  async subscribe(
    subject: string,
    durableName: string,
    handler: (event: PlatformEvent) => Promise<void>,
  ): Promise<void> {
    if (!this.js) {
      this.logger.warn(`Cannot subscribe to ${subject}: NATS not connected`);
      return;
    }

    const sub = await this.js.subscribe(`privacyops.${subject}`, {
      durable_name: durableName,
    } as any);

    (async () => {
      for await (const msg of sub) {
        let event: PlatformEvent | undefined;
        const eventStart = Date.now();
        try {
          event = this.codec.decode(msg.data) as PlatformEvent;
          // Verify HMAC if signing is enabled
          if (this.hmacSecret && (event as any)._hmac) {
            const expected = createHmac('sha256', this.hmacSecret)
              .update(JSON.stringify({ type: event.type, tenantId: event.tenantId, eventId: event.eventId }))
              .digest('hex');
            if ((event as any)._hmac !== expected) {
              this.logger.warn(`HMAC verification failed for event ${event.eventId} on ${subject}`);
              msg.ack();
              continue;
            }
          }
          // Idempotency: skip duplicate events
          if (this.isAlreadyProcessed(event)) {
            this.logger.debug(`Skipping duplicate event ${event.eventId} for ${subject}`);
            msg.ack();
            continue;
          }
          await this.executeWithRetry(subject, handler, event);
          msg.ack();
          this.recordMetric(subject, true);
          this.prometheus?.eventConsumedTotal.inc({ event_type: subject });
          this.prometheus?.eventProcessingDuration.observe(
            { event_type: subject },
            (Date.now() - eventStart) / 1000,
          );
        } catch (error) {
          this.logger.error(`All retries exhausted for ${subject}: ${error}`);
          msg.ack(); // Ack to prevent infinite redelivery
          this.recordMetric(subject, false);
          this.prometheus?.eventFailedTotal.inc({ event_type: subject });
          // Publish to DLQ
          if (event) {
            await this.publishToDlq(subject, event, error);
          }
        }
      }
    })();
  }

  /**
   * Check if an event has already been processed (idempotency guard).
   * Returns true if the event is a duplicate and should be skipped.
   */
  isAlreadyProcessed(event: PlatformEvent): boolean {
    const eventId = event.eventId;
    if (!eventId) return false;
    if (this.processedEvents.has(eventId)) return true;
    this.processedEvents.set(eventId, Date.now());
    return false;
  }

  private async executeWithRetry(
    subject: string,
    handler: (event: PlatformEvent) => Promise<void>,
    event: PlatformEvent,
  ): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await handler(event);
        return;
      } catch (error) {
        if (attempt === MAX_RETRY_ATTEMPTS) throw error;
        const backoff = RETRY_BACKOFF_MS[attempt] ?? 4000;
        this.logger.warn(
          `Retry ${attempt + 1}/${MAX_RETRY_ATTEMPTS} for ${subject} in ${backoff}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  private static readonly DLQ_SENSITIVE_KEYS = new Set([
    'password', 'secret', 'token', 'apikey', 'api_key', 'credential',
    'ssn', 'credit_card', 'creditcard', 'accesstoken', 'access_token',
    'refreshtoken', 'refresh_token', 'privatekey', 'private_key',
  ]);

  private redactDlqData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (EventBusService.DLQ_SENSITIVE_KEYS.has(key.toLowerCase())) {
        safe[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        safe[key] = this.redactDlqData(value);
      } else {
        safe[key] = value;
      }
    }
    return safe;
  }

  private async publishToDlq(
    subject: string,
    event: PlatformEvent,
    error: unknown,
  ): Promise<void> {
    if (!this.js) return;
    try {
      const dlqPayload = {
        originalSubject: subject,
        event: {
          ...event,
          data: this.redactDlqData(event.data),
        },
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
      };
      await this.js.publish(
        `privacyops-dlq.${event.type}`,
        this.codec.encode(dlqPayload),
      );
      this.logger.warn(`Event sent to DLQ: ${event.type}`);
      this.prometheus?.eventDlqTotal.inc({ event_type: event.type });
    } catch (dlqError) {
      this.logger.error(`Failed to publish to DLQ: ${dlqError}`);
    }
  }

  private recordMetric(subject: string, success: boolean) {
    const counts = this.eventCounts.get(subject) ?? { success: 0, failure: 0 };
    if (success) counts.success++;
    else counts.failure++;
    this.eventCounts.set(subject, counts);
  }

  getMetrics(): Record<string, { success: number; failure: number }> {
    return Object.fromEntries(this.eventCounts);
  }
}
