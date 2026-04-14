import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '@/core/events/event-bus.service';
import { CorrelationIdMiddleware } from '@/core/telemetry/correlation-id.middleware';

/**
 * Metering service — records per-tenant usage events for billing /
 * licensing / quota enforcement.
 *
 * Design goals:
 *   1. Fire-and-forget in the hot path. Recording must never block a
 *      request or raise an exception — all failures are logged and
 *      swallowed.
 *   2. Off-request persistence. Events are published on the existing
 *      NATS JetStream event bus. The `usage-event.consumer` subscribes
 *      and persists rows into `usage_events`. This keeps the request
 *      path lock-free.
 *   3. Env-flag controlled. When `METERING_ENABLED=false` every call
 *      becomes a no-op and no events are published.
 *
 * Dependencies are all already present in the container — this file
 * adds no new transitive imports.
 */
@Injectable()
export class MeteringService {
  private readonly logger = new Logger(MeteringService.name);
  private readonly enabled: boolean;
  private static readonly PUBLISH_TIMEOUT_MS = 50;

  constructor(
    private readonly events: EventBusService,
    private readonly config: ConfigService,
  ) {
    const flag = this.config.get<string>('METERING_ENABLED', 'true');
    this.enabled = flag !== 'false' && flag !== '0';
  }

  /**
   * Record a metered event. Safe to call from any service/controller;
   * never throws and never awaits longer than PUBLISH_TIMEOUT_MS.
   */
  record(
    tenantId: string,
    metric: string,
    value: number = 1,
    options: { source?: string; correlationId?: string; metadata?: Record<string, any> } = {},
  ): void {
    if (!this.enabled) return;
    if (!tenantId || !metric) return;

    // Fire-and-forget: do not block, do not throw.
    const publishPromise = this.events.publish({
      type: 'usage.recorded',
      tenantId,
      data: {
        metric,
        value,
        source: options.source,
        metadata: options.metadata,
      },
      timestamp: new Date(),
      correlationId: options.correlationId ?? CorrelationIdMiddleware.getCorrelationId() ?? undefined,
    });

    // Bound the wait so a slow/broken bus cannot back-pressure request
    // processing. We do NOT surface timeouts as errors.
    Promise.race([
      publishPromise,
      new Promise<void>((resolve) =>
        setTimeout(resolve, MeteringService.PUBLISH_TIMEOUT_MS),
      ),
    ]).catch((err) => {
      this.logger.debug(`Metering publish failed: ${err?.message ?? err}`);
    });
  }

  /**
   * Synchronous no-throw record used for tight loops (e.g. bulk asset
   * discovery). Collapses multiple increments into a single published
   * event.
   */
  recordBatch(
    tenantId: string,
    metric: string,
    count: number,
    source?: string,
  ): void {
    if (!this.enabled) return;
    if (!tenantId || !metric || count <= 0) return;
    this.record(tenantId, metric, count, { source });
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
