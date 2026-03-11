import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class ContextAssemblerService {
  private readonly logger = new Logger(ContextAssemblerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assemble(
    tenantId: string,
    intent: string,
    entities: string[],
    filters: Record<string, any>,
  ): Promise<Record<string, any>> {
    switch (intent) {
      case 'risk_query':
        return this.assembleRiskContext(tenantId, filters);
      case 'data_location':
        return this.assembleDataLocationContext(tenantId, filters);
      case 'compliance_check':
        return this.assembleComplianceContext(tenantId, filters);
      case 'access_audit':
        return this.assembleAccessAuditContext(tenantId, filters);
      case 'attack_path':
        return this.assembleAttackPathContext(tenantId, filters);
      case 'vendor_risk':
        return this.assembleVendorRiskContext(tenantId, filters);
      case 'lineage_trace':
        return this.assembleLineageContext(tenantId, entities);
      case 'remediation_advice':
        return this.assembleRemediationContext(tenantId, filters);
      case 'general_summary':
      default:
        return this.assembleGeneralSummary(tenantId);
    }
  }

  private async assembleRiskContext(tenantId: string, filters: Record<string, any>) {
    const severityFilter = filters.severity ? { severity: filters.severity } : {};

    const [bySeverity, topRiskProfiles] = await Promise.all([
      this.prisma.riskFinding.groupBy({
        by: ['severity'],
        where: { tenantId, ...severityFilter },
        _count: { id: true },
      }),
      this.prisma.entityRiskProfile.findMany({
        where: { tenantId },
        orderBy: { compositeScore: 'desc' },
        take: filters.limit || 5,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          compositeScore: true,
          riskLevel: true,
        },
      }),
    ]);

    return {
      type: 'risk_query',
      findingsBySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
      topRiskProfiles: topRiskProfiles,
    };
  }

  private async assembleDataLocationContext(tenantId: string, filters: Record<string, any>) {
    const [byType, byDataSource] = await Promise.all([
      this.prisma.asset.groupBy({
        by: ['type'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.asset.groupBy({
        by: ['dataSourceId'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
    ]);

    return {
      type: 'data_location',
      assetsByType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
      assetsByDataSource: byDataSource.map((d) => ({
        dataSourceId: d.dataSourceId,
        count: d._count.id,
      })),
    };
  }

  private async assembleComplianceContext(tenantId: string, filters: Record<string, any>) {
    const [regulationCount, controlGapCount] = await Promise.all([
      this.prisma.regulation.count({ where: { tenantId } }),
      this.prisma.controlGap.count({ where: { tenantId } }),
    ]);

    return {
      type: 'compliance_check',
      regulationCount,
      controlGapCount,
    };
  }

  private async assembleAccessAuditContext(tenantId: string, filters: Record<string, any>) {
    const [excessiveCount, inactiveCount, totalMappings] = await Promise.all([
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isExcessive: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isInactive: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId },
      }),
    ]);

    return {
      type: 'access_audit',
      totalMappings,
      excessiveCount,
      inactiveCount,
    };
  }

  private async assembleAttackPathContext(tenantId: string, filters: Record<string, any>) {
    const bySeverity = await this.prisma.attackPath.groupBy({
      by: ['severity'],
      where: { tenantId },
      _count: { id: true },
    });

    return {
      type: 'attack_path',
      attackPathsBySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
    };
  }

  private async assembleVendorRiskContext(tenantId: string, filters: Record<string, any>) {
    const [vendorCount, assessments] = await Promise.all([
      this.prisma.vendor.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.vendorAssessment.aggregate({
        where: { tenantId },
        _avg: { riskScore: true },
        _count: { id: true },
      }),
    ]);

    return {
      type: 'vendor_risk',
      vendorCount,
      assessmentCount: assessments._count.id,
      averageRiskScore: assessments._avg.riskScore,
    };
  }

  private async assembleLineageContext(tenantId: string, entities: string[]) {
    const totalNodes = await this.prisma.lineageNode.count({
      where: { tenantId },
    });

    const totalEdges = await this.prisma.lineageEdge.count({
      where: { tenantId },
    });

    return {
      type: 'lineage_trace',
      totalNodes,
      totalEdges,
      queriedEntities: entities,
    };
  }

  private async assembleRemediationContext(tenantId: string, filters: Record<string, any>) {
    const byStatus = await this.prisma.remediationAction.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    return {
      type: 'remediation_advice',
      actionsByStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  }

  private async assembleGeneralSummary(tenantId: string) {
    const [
      assetCount,
      riskFindingCount,
      vendorCount,
      identityMappingCount,
      attackPathCount,
      regulationCount,
    ] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.riskFinding.count({ where: { tenantId } }),
      this.prisma.vendor.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.identityAccessMapping.count({ where: { tenantId } }),
      this.prisma.attackPath.count({ where: { tenantId } }),
      this.prisma.regulation.count({ where: { tenantId } }),
    ]);

    return {
      type: 'general_summary',
      assetCount,
      riskFindingCount,
      vendorCount,
      identityMappingCount,
      attackPathCount,
      regulationCount,
    };
  }
}
