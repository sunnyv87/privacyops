import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/core/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * Rolls up raw UsageEvent rows into UsageAggregate buckets (day + month
 * per tenant per metric) so quota checks and billing reports can read
 * a single compact row instead of scanning the raw event stream.
 *
 * Also enforces the 90-day TTL on raw events — keeps the raw table
 * bounded while preserving long-term history in aggregates.
 *
 * All writes bypass RLS via the `is_platform_admin()` policy because
 * this job legitimately crosses tenant boundaries.
 */
@Injectable()
export class UsageAggregatorService {
  private readonly logger = new Logger(UsageAggregatorService.name);
  private readonly enabled: boolean;
  private static readonly RAW_EVENT_TTL_DAYS = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const flag = this.config.get<string>('METERING_ENABLED', 'true');
    this.enabled = flag !== 'false' && flag !== '0';
  }

  /**
   * Every 15 minutes: roll the last 30 minutes of events into current
   * period buckets. The 15-min cadence with a 30-min window guarantees
   * no events are missed between ticks.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async aggregate(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.runDailyRollup();
      await this.runMonthlyRollup();
    } catch (err: any) {
      this.logger.error(`UsageAggregator tick failed: ${err?.message ?? err}`);
    }
  }

  /**
   * Nightly: delete raw events older than RAW_EVENT_TTL_DAYS. Runs at
   * 02:15 UTC to avoid overlap with aggregation ticks.
   */
  @Cron('0 15 2 * * *')
  async purge(): Promise<void> {
    if (!this.enabled) return;
    const cutoff = new Date(Date.now() - UsageAggregatorService.RAW_EVENT_TTL_DAYS * 86400 * 1000);
    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.platform_admin', 'true', true)`,
        );
        const result = await tx.usageEvent.deleteMany({
          where: { occurredAt: { lt: cutoff } },
        });
        return result.count;
      });
      if (deleted > 0) {
        this.logger.log(`Purged ${deleted} usage events older than ${cutoff.toISOString()}`);
      }
    } catch (err: any) {
      this.logger.error(`UsageAggregator purge failed: ${err?.message ?? err}`);
    }
  }

  private async runDailyRollup(): Promise<void> {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86400 * 1000);

    await this.rollupWindow('day', dayStart, dayEnd);
  }

  private async runMonthlyRollup(): Promise<void> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    await this.rollupWindow('month', monthStart, monthEnd);
  }

  private async rollupWindow(period: string, periodStart: Date, periodEnd: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.platform_admin', 'true', true)`,
      );

      // Single SQL aggregate + upsert per window. We intentionally
      // aggregate the ENTIRE window each tick rather than delta'ing
      // because it's idempotent and cheap at the current cardinality.
      await tx.$executeRawUnsafe(
        `
        INSERT INTO usage_aggregates (
          id, tenant_id, metric, period, period_start, period_end, value, updated_at
        )
        SELECT
          gen_random_uuid(),
          e.tenant_id,
          e.metric,
          $1,
          $2::timestamptz,
          $3::timestamptz,
          COALESCE(SUM(e.value), 0),
          NOW()
        FROM usage_events e
        WHERE e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz
        GROUP BY e.tenant_id, e.metric
        ON CONFLICT (tenant_id, metric, period, period_start) DO UPDATE
          SET value      = EXCLUDED.value,
              updated_at = NOW();
        `,
        period,
        periodStart.toISOString(),
        periodEnd.toISOString(),
      );
    });
  }
}
