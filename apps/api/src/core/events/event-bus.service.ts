import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, JSONCodec, JetStreamManager, JetStreamClient } from 'nats';
import { CorrelationIdMiddleware } from '@/core/telemetry/correlation-id.middleware';
import { PrometheusService } from '@/core/telemetry/prometheus.service';

export interface PlatformEvent {
  type: string;
  tenantId: string;
  data: any;
  timestamp: Date;
  correlationId?: string;
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

  private prometheus: PrometheusService | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Late-bind PrometheusService to avoid circular DI during module init. */
  setPrometheus(prometheus: PrometheusService) {
    this.prometheus = prometheus;
  }

  async onModuleInit() {
    try {
      const natsUrl = this.config.get('NATS_URL', 'nats://localhost:4222');
      this.connection = await connect({ servers: natsUrl });

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
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  async publish(event: PlatformEvent): Promise<void> {
    // Auto-populate correlationId from request context if not set
    if (!event.correlationId) {
      event.correlationId = CorrelationIdMiddleware.getCorrelationId();
    }

    const subject = `privacyops.${event.type}`;
    const payload = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

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

  private async publishToDlq(
    subject: string,
    event: PlatformEvent,
    error: unknown,
  ): Promise<void> {
    if (!this.js) return;
    try {
      const dlqPayload = {
        originalSubject: subject,
        event,
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
