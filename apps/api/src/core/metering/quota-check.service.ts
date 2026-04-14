import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

export interface QuotaResult {
  metric: string;
  limit: number;       // -1 = unlimited
  used: number;
  remaining: number;   // -1 = unlimited
  exceeded: boolean;
  percentUsed: number; // 0-100+
}

/**
 * Quota check service — reads the current month's UsageAggregate
 * row for a tenant/metric and compares it against the tenant's
 * active PlanLimit. Used by LicensingService when a request touches
 * a quota'd feature.
 *
 * Reads only; never writes. Falls back to an "unlimited" result when
 * metering is off or no subscription is attached so existing dev
 * deployments are never blocked.
 */
@Injectable()
export class QuotaCheckService {
  private readonly logger = new Logger(QuotaCheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(tenantId: string, metric: string): Promise<QuotaResult> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        include: {
          plan: {
            include: { limits: { where: { metric } } },
          },
        },
      });

      const planLimit = subscription?.plan?.limits?.[0];
      if (!planLimit || Number(planLimit.limitValue) < 0) {
        return this.unlimited(metric);
      }

      const now = new Date();
      const periodStart =
        planLimit.period === 'day'
          ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
          : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const aggregate = await this.prisma.usageAggregate.findUnique({
        where: {
          tenantId_metric_period_periodStart: {
            tenantId,
            metric,
            period: planLimit.period,
            periodStart,
          },
        },
      });

      const limit = Number(planLimit.limitValue);
      const used = aggregate ? Number(aggregate.value) : 0;
      const remaining = Math.max(0, limit - used);
      const exceeded = used >= limit;
      const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

      return { metric, limit, used, remaining, exceeded, percentUsed };
    } catch (err: any) {
      // Fail open: never block traffic on a quota read error.
      this.logger.warn(
        `Quota check failed for ${tenantId}/${metric}: ${err?.message ?? err}`,
      );
      return this.unlimited(metric);
    }
  }

  /**
   * True when the tenant's usage of `metric` is below its plan limit,
   * OR the plan has no limit for this metric, OR quota enforcement is
   * disabled for the limit.
   */
  async isWithinQuota(tenantId: string, metric: string): Promise<boolean> {
    const result = await this.check(tenantId, metric);
    return !result.exceeded;
  }

  private unlimited(metric: string): QuotaResult {
    return { metric, limit: -1, used: 0, remaining: -1, exceeded: false, percentUsed: 0 };
  }
}
