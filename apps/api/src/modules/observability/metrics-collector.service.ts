import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Record a single metric
  // ---------------------------------------------------------------------------

  async recordMetric(
    tenantId: string | null,
    serviceName: string,
    metricName: string,
    metricValue: number,
    tags?: Record<string, any>,
  ) {
    const metric = await this.prisma.serviceMetric.create({
      data: {
        tenantId,
        serviceName,
        metricName,
        metricValue,
        tags: tags || null,
      },
    });

    return metric;
  }

  // ---------------------------------------------------------------------------
  // Query metrics with filters and pagination
  // ---------------------------------------------------------------------------

  async getMetrics(filters: {
    serviceName?: string;
    metricName?: string;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = {};
    if (filters.serviceName) where.serviceName = filters.serviceName;
    if (filters.metricName) where.metricName = filters.metricName;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.startDate || filters.endDate) {
      where.recordedAt = {};
      if (filters.startDate) where.recordedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.recordedAt.lte = new Date(filters.endDate);
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.serviceMetric.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.serviceMetric.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Performance summary (last 24 hours)
  // ---------------------------------------------------------------------------

  async getPerformanceSummary(serviceName?: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Record<string, any> = {
      recordedAt: { gte: since },
    };
    if (serviceName) where.serviceName = serviceName;

    const latencyMetrics = await this.prisma.serviceMetric.aggregate({
      where: {
        ...where,
        metricName: 'request_latency_ms',
      },
      _avg: { metricValue: true },
      _count: { id: true },
    });

    const errorMetrics = await this.prisma.serviceMetric.count({
      where: {
        ...where,
        metricName: 'request_error',
      },
    });

    const totalRequests =
      (latencyMetrics._count?.id || 0) + errorMetrics;

    const errorRate =
      totalRequests > 0
        ? Math.round((errorMetrics / totalRequests) * 10000) / 100
        : 0;

    return {
      period: '24h',
      since: since.toISOString(),
      avgLatencyMs: latencyMetrics._avg?.metricValue
        ? Number(latencyMetrics._avg.metricValue)
        : 0,
      totalRequests,
      errorCount: errorMetrics,
      errorRate,
      serviceName: serviceName || 'all',
    };
  }

  // ---------------------------------------------------------------------------
  // Prune old metrics
  // ---------------------------------------------------------------------------

  async pruneOldMetrics(retentionDays: number) {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.serviceMetric.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });

    this.logger.log(
      `Pruned ${result.count} metrics older than ${retentionDays} days`,
    );

    return { deleted: result.count, cutoffDate: cutoff.toISOString() };
  }
}
