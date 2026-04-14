import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class OptimizationAnalyzer {
  private readonly logger = new Logger(OptimizationAnalyzer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Analyze performance and generate recommendations
  // ---------------------------------------------------------------------------

  async analyzePerformance(tenantId?: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Record<string, any> = {
      recordedAt: { gte: since },
    };
    if (tenantId) where.tenantId = tenantId;

    // Gather latency metrics grouped by service + handler
    const latencyMetrics = await this.prisma.serviceMetric.findMany({
      where: {
        ...where,
        metricName: 'request_latency_ms',
      },
      orderBy: { metricValue: 'desc' },
    });

    const errorMetrics = await this.prisma.serviceMetric.findMany({
      where: {
        ...where,
        metricName: 'request_error',
      },
    });

    // Group latency by service+handler
    const endpointStats: Record<
      string,
      { latencies: number[]; errors: number }
    > = {};

    for (const m of latencyMetrics) {
      const tags = m.tags as Record<string, any> | null;
      const key = `${m.serviceName}::${tags?.handler || 'unknown'}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { latencies: [], errors: 0 };
      }
      endpointStats[key].latencies.push(Number(m.metricValue));
    }

    for (const m of errorMetrics) {
      const tags = m.tags as Record<string, any> | null;
      const key = `${m.serviceName}::${tags?.handler || 'unknown'}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { latencies: [], errors: 0 };
      }
      endpointStats[key].errors += 1;
    }

    const recommendations = [];

    for (const [endpoint, stats] of Object.entries(endpointStats)) {
      const sorted = stats.latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95 = sorted[p95Index] || 0;
      const totalCalls = stats.latencies.length + stats.errors;
      const errorRate =
        totalCalls > 0
          ? Math.round((stats.errors / totalCalls) * 10000) / 100
          : 0;

      // Slow endpoints: p95 > 500ms
      if (p95 > 500 && sorted.length >= 5) {
        recommendations.push({
          tenantId: tenantId || null,
          category: 'query_performance',
          target: endpoint,
          description: `Endpoint ${endpoint} has p95 latency of ${p95}ms (threshold: 500ms). Consider query optimization, caching, or pagination improvements.`,
          currentMetric: { p95LatencyMs: p95, sampleSize: sorted.length },
          expectedImprovement: {
            targetP95Ms: 500,
            reductionPercent: Math.round(((p95 - 500) / p95) * 100),
          },
          implementation: {
            type: 'query_optimization',
            suggestions: [
              'Add database indexes',
              'Implement response caching',
              'Review query N+1 patterns',
            ],
          },
          priority: p95 > 2000 ? 'critical' : p95 > 1000 ? 'high' : 'medium',
          status: 'proposed',
        });
      }

      // High error rates: > 5%
      if (errorRate > 5 && totalCalls >= 10) {
        recommendations.push({
          tenantId: tenantId || null,
          category: 'resource_usage',
          target: endpoint,
          description: `Endpoint ${endpoint} has an error rate of ${errorRate}% (threshold: 5%). Investigate error causes and add resilience patterns.`,
          currentMetric: {
            errorRate,
            totalCalls,
            errorCount: stats.errors,
          },
          expectedImprovement: {
            targetErrorRate: 1,
            reductionPercent: Math.round(((errorRate - 1) / errorRate) * 100),
          },
          implementation: {
            type: 'error_reduction',
            suggestions: [
              'Add circuit breaker pattern',
              'Implement retry logic',
              'Review error handling',
            ],
          },
          priority: errorRate > 20 ? 'critical' : errorRate > 10 ? 'high' : 'medium',
          status: 'proposed',
        });
      }
    }

    // Persist recommendations
    const created = [];
    for (const rec of recommendations) {
      const existing = await this.prisma.optimizationRecommendation.findFirst({
        where: {
          target: rec.target,
          category: rec.category,
          status: 'proposed',
        },
      });

      if (!existing) {
        const record =
          await this.prisma.optimizationRecommendation.create({
            data: rec,
          });
        created.push(record);
      }
    }

    await this.events.publish({
      type: 'platform.optimization_analysis_completed',
      tenantId: tenantId || '',
      data: {
        endpointsAnalyzed: Object.keys(endpointStats).length,
        recommendationsGenerated: created.length,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Performance analysis completed: ${Object.keys(endpointStats).length} endpoints analyzed, ${created.length} new recommendations`,
    );

    return {
      endpointsAnalyzed: Object.keys(endpointStats).length,
      newRecommendations: created.length,
      recommendations: created,
    };
  }

  // ---------------------------------------------------------------------------
  // Get recommendations with pagination
  // ---------------------------------------------------------------------------

  async getRecommendations(filters: {
    tenantId?: string;
    category?: string;
    status?: string;
    priority?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    const [data, totalItems] = await Promise.all([
      this.prisma.optimizationRecommendation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.optimizationRecommendation.count({ where }),
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
  // Apply a recommendation
  // ---------------------------------------------------------------------------

  async applyRecommendation(id: string, tenantId: string, userId: string) {
    // Tenant-scoped lookup: recommendations without a tenantId are
    // platform-global and readable only by platform admins (controller
    // enforces `platform:admin`).
    const recommendation =
      await this.prisma.optimizationRecommendation.findFirst({
        where: {
          id,
          OR: [{ tenantId }, { tenantId: null }],
        },
      });

    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }

    const { count } = await this.prisma.optimizationRecommendation.updateMany({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
      data: {
        status: 'applied',
        appliedAt: new Date(),
        appliedBy: userId,
      },
    });

    if (count === 0) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }

    const updated =
      await this.prisma.optimizationRecommendation.findUnique({
        where: { id },
      });

    await this.audit.log({
      tenantId: recommendation.tenantId || undefined,
      actorId: userId,
      actorType: 'user',
      action: 'optimization_recommendation.applied',
      entityType: 'optimization_recommendation',
      entityId: id,
      changes: {
        before: { status: recommendation.status },
        after: { status: 'applied', appliedBy: userId },
      },
    });

    await this.events.publish({
      type: 'platform.recommendation_applied',
      tenantId: recommendation.tenantId || undefined,
      data: {
        recommendationId: id,
        category: recommendation.category,
        target: recommendation.target,
      },
      timestamp: new Date(),
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Revert a recommendation
  // ---------------------------------------------------------------------------

  async revertRecommendation(id: string, tenantId: string) {
    const recommendation =
      await this.prisma.optimizationRecommendation.findFirst({
        where: {
          id,
          OR: [{ tenantId }, { tenantId: null }],
        },
      });

    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }

    const { count } = await this.prisma.optimizationRecommendation.updateMany({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
      data: {
        status: 'reverted',
      },
    });

    if (count === 0) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }

    return this.prisma.optimizationRecommendation.findUnique({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Get all performance baselines
  // ---------------------------------------------------------------------------

  async getBaselines() {
    return this.prisma.performanceBaseline.findMany({
      orderBy: { calculatedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Upsert a performance baseline
  // ---------------------------------------------------------------------------

  async updateBaseline(
    serviceName: string,
    operationName: string,
    metrics: {
      latencyMs: number;
      throughput: number;
      errorRate: number;
      sampleSize: number;
    },
  ) {
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const baseline = await this.prisma.performanceBaseline.upsert({
      where: {
        serviceName_operationName: {
          serviceName,
          operationName,
        },
      },
      update: {
        baselineLatencyMs: metrics.latencyMs,
        baselineThroughput: metrics.throughput,
        baselineErrorRate: metrics.errorRate,
        sampleSize: metrics.sampleSize,
        calculatedAt: new Date(),
        validUntil,
      },
      create: {
        serviceName,
        operationName,
        baselineLatencyMs: metrics.latencyMs,
        baselineThroughput: metrics.throughput,
        baselineErrorRate: metrics.errorRate,
        sampleSize: metrics.sampleSize,
        validUntil,
      },
    });

    return baseline;
  }

  // ---------------------------------------------------------------------------
  // Health report: combined view
  // ---------------------------------------------------------------------------

  async getHealthReport(tenantId?: string) {
    const where: Record<string, any> = {};
    if (tenantId) where.tenantId = tenantId;

    // Recommendations by priority
    const byPriority = await this.prisma.optimizationRecommendation.groupBy({
      by: ['priority'],
      where: { ...where, status: 'proposed' },
      _count: { id: true },
    });

    // Baselines and drift detection
    const baselines = await this.prisma.performanceBaseline.findMany({
      orderBy: { calculatedAt: 'desc' },
    });

    const now = new Date();
    const expiredBaselines = baselines.filter(
      (b) => new Date(b.validUntil) < now,
    );

    // Top slow endpoints from recent metrics
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const slowMetrics = await this.prisma.serviceMetric.findMany({
      where: {
        metricName: 'request_latency_ms',
        recordedAt: { gte: since },
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { metricValue: 'desc' },
      take: 10,
    });

    return {
      recommendations: {
        byPriority: byPriority.reduce(
          (acc, item) => {
            acc[item.priority] = item._count.id;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      baselines: {
        total: baselines.length,
        expired: expiredBaselines.length,
        active: baselines.length - expiredBaselines.length,
      },
      topSlowEndpoints: slowMetrics.map((m) => ({
        serviceName: m.serviceName,
        latencyMs: Number(m.metricValue),
        tags: m.tags,
        recordedAt: m.recordedAt,
      })),
    };
  }
}
