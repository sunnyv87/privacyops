import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async getStats(tenantId: string) {
    const [
      criticalFindings,
      totalFindings,
      openDsarRequests,
      dsarDueSoon,
      connectedSources,
      totalAssets,
    ] = await Promise.all([
      this.prisma.riskFinding.count({
        where: {
          tenantId,
          deletedAt: null,
          severity: 'critical',
          status: { in: ['open', 'acknowledged'] },
        },
      }),
      this.prisma.riskFinding.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['open', 'acknowledged'] },
        },
      }),
      this.prisma.dsarRequest.count({
        where: {
          tenantId,
          status: { in: ['submitted', 'in_progress', 'verified'] },
        },
      }),
      this.prisma.dsarRequest.count({
        where: {
          tenantId,
          status: { in: ['submitted', 'in_progress', 'verified'] },
          dueDate: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // next 3 days
          },
        },
      }),
      this.prisma.dataSource.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'connected',
        },
      }),
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null },
      }),
    ]);

    // Calculate DSAR SLA compliance
    const [completedOnTime, completedTotal] = await Promise.all([
      this.prisma.dsarRequest.count({
        where: {
          tenantId,
          status: 'completed',
          completedAt: { not: null },
        },
      }),
      this.prisma.dsarRequest.count({
        where: { tenantId, status: 'completed' },
      }),
    ]);

    const dsarSlaCompliance =
      completedTotal > 0
        ? Math.round((completedOnTime / completedTotal) * 100)
        : 100;

    // Privacy health score: weighted combination of metrics
    // Lower critical findings = better, higher DSAR SLA = better
    const findingPenalty = Math.min(50, criticalFindings * 10);
    const privacyHealthScore = Math.max(
      0,
      Math.min(100, 100 - findingPenalty + (dsarSlaCompliance > 90 ? 10 : 0) - (dsarDueSoon > 0 ? 5 : 0)),
    );

    return {
      privacyHealthScore,
      criticalFindings,
      totalOpenFindings: totalFindings,
      dsarSlaCompliance,
      openDsarRequests,
      dsarDueSoon,
      connectedSources,
      totalAssets,
    };
  }

  async getRiskDistribution(tenantId: string) {
    const distribution = await this.prisma.riskFinding.groupBy({
      by: ['severity'],
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['open', 'acknowledged'] },
      },
      _count: { id: true },
    });

    // Ensure all severity levels are represented
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const distributionMap = new Map(
      distribution.map((d) => [d.severity, d._count.id]),
    );

    return severityOrder.map((severity) => ({
      severity,
      count: distributionMap.get(severity) || 0,
    }));
  }

  async getTopRiskyAssets(tenantId: string, limit: number = 10) {
    const findings = await this.prisma.riskFinding.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['open', 'acknowledged'] },
        assetId: { not: null },
      },
      orderBy: { riskScore: 'desc' },
      take: limit,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true,
            dataSourceId: true,
          },
        },
      },
    });

    return findings.map((f) => ({
      findingId: f.id,
      assetId: f.assetId,
      assetName: f.asset?.name,
      assetType: f.asset?.type,
      riskScore: f.riskScore,
      severity: f.severity,
      title: f.title,
    }));
  }

  async getRecentActivity(tenantId: string, limit: number = 20) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        actorId: true,
        actorType: true,
        action: true,
        entityType: true,
        entityId: true,
        timestamp: true,
      },
    });

    return logs;
  }

  async getComplianceOverview(tenantId: string) {
    const regulations = await this.prisma.regulation.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        obligations: {
          include: {
            controls: {
              include: {
                control: {
                  select: {
                    id: true,
                    implementationStatus: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return regulations.map((reg) => {
      const allControls = reg.obligations.flatMap((o) =>
        o.controls.map((oc) => oc.control),
      );
      const totalControls = allControls.length;
      const implementedControls = allControls.filter(
        (c) => c.implementationStatus === 'implemented',
      ).length;

      const score =
        totalControls > 0
          ? Math.round((implementedControls / totalControls) * 100)
          : 0;

      return {
        regulationId: reg.id,
        regulationName: reg.shortName,
        jurisdiction: reg.jurisdiction,
        complianceScore: score,
        totalObligations: reg.obligations.length,
        totalControls,
        implementedControls,
      };
    });
  }

  // ========================================================================
  // Module 21: Extended Dashboard Views
  // ========================================================================

  async getShadowDataSummary(tenantId: string) {
    const [totalShadowAssets, alertsByType, alertsByStatus] = await Promise.all([
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null, isShadowData: true },
      }),
      this.prisma.shadowDataAlert.groupBy({
        by: ['alertType'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.shadowDataAlert.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    return {
      totalShadowAssets,
      alertsByType: alertsByType.map((a) => ({ type: a.alertType, count: a._count.id })),
      alertsByStatus: alertsByStatus.map((a) => ({ status: a.status, count: a._count.id })),
    };
  }

  async getIdentityAccessOverview(tenantId: string) {
    const [totalMappings, byType, excessiveCount, inactiveCount] = await Promise.all([
      this.prisma.identityAccessMapping.count({ where: { tenantId } }),
      this.prisma.identityAccessMapping.groupBy({
        by: ['identityType'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isExcessive: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isInactive: true },
      }),
    ]);

    return {
      totalMappings,
      byType: byType.map((t) => ({ type: t.identityType, count: t._count.id })),
      excessiveCount,
      inactiveCount,
    };
  }

  async getAttackPathSummary(tenantId: string) {
    const [total, bySeverity, byStatus] = await Promise.all([
      this.prisma.attackPath.count({ where: { tenantId } }),
      this.prisma.attackPath.groupBy({
        by: ['severity'],
        where: { tenantId, status: 'active' },
        _count: { id: true },
      }),
      this.prisma.attackPath.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    return {
      total,
      activeBySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    };
  }

  async getDataRiskHeatmap(tenantId: string) {
    const profiles = await this.prisma.entityRiskProfile.findMany({
      where: { tenantId, entityType: 'asset' },
      orderBy: { compositeScore: 'desc' },
      take: 50,
    });

    return profiles.map((p) => ({
      entityId: p.entityId,
      entityType: p.entityType,
      score: p.compositeScore,
      trend: p.trend,
    }));
  }

  async getConnectorCoverage(tenantId: string) {
    const [dataSources, healthLogs] = await Promise.all([
      this.prisma.dataSource.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, type: true, status: true, lastScanAt: true, healthStatus: true },
      }),
      this.prisma.connectorHealthLog.findMany({
        where: { tenantId },
        orderBy: { checkedAt: 'desc' },
        distinct: ['dataSourceId'],
        select: { dataSourceId: true, healthStatus: true, checkedAt: true },
      }),
    ]);

    const healthMap = new Map(healthLogs.map((h) => [h.dataSourceId, h]));
    const assetCounts = await this.prisma.asset.groupBy({
      by: ['dataSourceId'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });
    const assetCountMap = new Map(assetCounts.map((a) => [a.dataSourceId, a._count.id]));

    const connectors = dataSources.map((ds) => {
      const health = healthMap.get(ds.id);
      return {
        dataSourceId: ds.id,
        name: ds.name,
        type: ds.type,
        status: ds.status,
        healthStatus: health?.healthStatus || ds.healthStatus || 'unknown',
        lastScanAt: ds.lastScanAt,
        lastHealthCheck: health?.checkedAt,
        assetCount: assetCountMap.get(ds.id) || 0,
      };
    });

    // Group by type
    const byType: Record<string, { count: number; healthy: number; total_assets: number }> = {};
    for (const c of connectors) {
      if (!byType[c.type]) byType[c.type] = { count: 0, healthy: 0, total_assets: 0 };
      byType[c.type].count++;
      if (c.healthStatus === 'healthy') byType[c.type].healthy++;
      byType[c.type].total_assets += c.assetCount;
    }

    // Data coverage metrics
    const [totalAssets, assetsWithSchema, assetsWithSamples, assetsWithAccess] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null, fields: { some: {} } },
      }),
      this.prisma.assetField.groupBy({
        by: ['assetId'],
        where: { tenantId, sampleValues: { not: null } },
      }).then((r) => r.length),
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null, accessPermissions: { not: null } },
      }),
    ]);

    return {
      totalConfigured: dataSources.length,
      connectors,
      byType,
      dataCoverage: {
        totalAssets,
        assetsWithSchema,
        assetsWithSamples,
        assetsWithAccess,
        schemaPercent: totalAssets > 0 ? Math.round((assetsWithSchema / totalAssets) * 100) : 0,
        samplingPercent: totalAssets > 0 ? Math.round((assetsWithSamples / totalAssets) * 100) : 0,
        accessPercent: totalAssets > 0 ? Math.round((assetsWithAccess / totalAssets) * 100) : 0,
      },
    };
  }

  async getRiskBySourceType(tenantId: string) {
    const findings = await this.prisma.riskFinding.findMany({
      where: { tenantId, deletedAt: null, status: { in: ['open', 'acknowledged'] } },
      include: {
        asset: {
          include: { dataSource: { select: { type: true } } },
        },
      },
    });

    const bySourceType: Record<string, { count: number; critical: number; high: number; avgScore: number; totalScore: number }> = {};

    for (const f of findings) {
      const sourceType = f.asset?.dataSource?.type || 'unknown';
      if (!bySourceType[sourceType]) {
        bySourceType[sourceType] = { count: 0, critical: 0, high: 0, avgScore: 0, totalScore: 0 };
      }
      bySourceType[sourceType].count++;
      bySourceType[sourceType].totalScore += Number(f.riskScore);
      if (f.severity === 'critical') bySourceType[sourceType].critical++;
      if (f.severity === 'high') bySourceType[sourceType].high++;
    }

    for (const type of Object.keys(bySourceType)) {
      const entry = bySourceType[type];
      entry.avgScore = entry.count > 0 ? Math.round(entry.totalScore / entry.count) : 0;
    }

    return bySourceType;
  }

  async getAiGovernanceOverview(tenantId: string) {
    const [totalSystems, byRiskCategory, byStatus, datasetUsageCount] = await Promise.all([
      this.prisma.aiSystem.count({ where: { tenantId } }),
      this.prisma.aiSystem.groupBy({
        by: ['riskCategory'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.aiSystem.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.aiDatasetUsage.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      totalSystems,
      byRiskCategory: byRiskCategory.map((r) => ({ category: r.riskCategory, count: r._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      activeDatasetUsages: datasetUsageCount,
    };
  }
}
