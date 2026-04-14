import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { EventBusService, PlatformEvent } from '@/core/events/event-bus.service';

/**
 * Persists `usage.recorded` events from the NATS JetStream bus into
 * the `usage_events` table. Runs outside the request path, so a slow
 * DB does not back-pressure API traffic.
 *
 * Writes are idempotent via the existing `eventId` tracking in
 * `EventBusService.subscribe` — duplicate deliveries are deduped
 * before handler execution.
 *
 * Cross-tenant write: the consumer must bypass RLS to insert rows for
 * arbitrary tenants. It sets `app.platform_admin = true` for the
 * duration of each insert using the `is_platform_admin()` bypass
 * policy defined in scripts/rls-extension.sql.
 */
@Injectable()
export class UsageEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(UsageEventConsumer.name);

  constructor(
    private readonly events: EventBusService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      await this.events.subscribe(
        'usage.recorded',
        'usage-event-consumer',
        async (event: PlatformEvent) => this.handle(event),
      );
    } catch (err: any) {
      // Non-fatal: during local dev NATS may be offline. Metering
      // degrades gracefully without the consumer.
      this.logger.warn(
        `UsageEventConsumer failed to subscribe: ${err?.message ?? err}`,
      );
    }
  }

  private async handle(event: PlatformEvent): Promise<void> {
    const { tenantId, data, correlationId } = event;
    if (!tenantId || !data || typeof data !== 'object') return;

    const metric = String(data.metric ?? '').slice(0, 100);
    const value = BigInt(Number(data.value ?? 1));
    const source = data.source ? String(data.source).slice(0, 100) : undefined;
    const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined;

    if (!metric) return;
    if (value <= 0n) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Enable platform_admin bypass for this transaction so the
        // cross-tenant INSERT passes the RLS policy.
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.platform_admin', 'true', true)`,
        );
        await tx.usageEvent.create({
          data: {
            tenantId,
            metric,
            value,
            source,
            correlationId: correlationId ?? null,
            metadata: metadata as any,
          },
        });
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to persist usage event (${metric} for ${tenantId}): ${err?.message ?? err}`,
      );
      // Re-throw so the event bus retries / DLQs.
      throw err;
    }
  }
}
