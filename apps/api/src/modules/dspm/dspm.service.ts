import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { RiskScorer, RiskScoringInput } from './engine/risk-scorer';
import { FindingFilterDto, UpdateFindingStatusDto } from './dto/dspm.dto';
import Redis from 'ioredis';

const RISK_CACHE_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class DspmService {
  private readonly logger = new Logger(DspmService.name);
  private readonly riskScorer = new RiskScorer();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findAllFindings(
    tenantId: string,
    filters?: FindingFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, severity, status, assetId, dataSourceId, minScore } = filters || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(severity && { severity }),
      ...(status && { status }),
      ...(assetId && { assetId }),
      ...(dataSourceId && { dataSourceId }),
      ...(minScore !== undefined && { riskScore: { gte: minScore } }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.riskFinding.findMany({
        where,
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
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.riskFinding.count({ where }),
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

  async findFindingById(tenantId: string, id: string) {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        asset: {
          include: {
            classifications: {
              include: { label: true },
            },
            fields: true,
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException(`Risk finding ${id} not found`);
    }

    return finding;
  }

  async updateFindingStatus(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateFindingStatusDto,
  ) {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!finding) {
      throw new NotFoundException(`Risk finding ${id} not found`);
    }

    const previousStatus = finding.status;

    const updated = await this.prisma.riskFinding.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'mitigated' && { resolvedAt: new Date() }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'finding.status_changed',
      entityType: 'risk_finding',
      entityId: id,
      changes: {
        before: { status: previousStatus },
        after: { status: dto.status, note: dto.note },
      },
    });

    await this.events.publish({
      type: 'finding.status.changed',
      tenantId,
      data: {
        findingId: id,
        previousStatus,
        newStatus: dto.status,
        actorId,
      },
      timestamp: new Date(),
    });

    return updated;
  }

  async recalculateRisk(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      include: {
        classifications: {
          include: { label: true },
        },
        fields: true,
        dataSource: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    const maxSensitivity = asset.classifications.reduce(
      (max, c) => Math.max(max, c.label.sensitivityLevel),
      1,
    );

    const metadata = (asset.metadata as Record<string, any>) || {};
    const dsMetadata = (asset.dataSource.metadata as Record<string, any>) || {};

    // Derive access signals from connector-populated accessPermissions
    const accessPerms = (asset.accessPermissions as any[]) || [];
    const derivedPrincipalCount = accessPerms.length > 0 ? accessPerms.length : (metadata.principalCount ?? 1);
    const derivedPublic = accessPerms.some((p) => p.principalType === 'public') || (metadata.isPubliclyAccessible ?? false);

    const scoringInput: RiskScoringInput = {
      sensitivityLevel: maxSensitivity,
      isPubliclyAccessible: derivedPublic,
      isCrossAccountAccessible: metadata.isCrossAccountAccessible ?? false,
      principalCount: derivedPrincipalCount,
      hasEncryption: metadata.hasEncryption ?? dsMetadata.hasEncryption ?? true,
      hasMfa: metadata.hasMfa ?? false,
      rowCount: Number(asset.rowCountEstimate ?? 0),
      isStale: asset.lastScannedAt
        ? Date.now() - asset.lastScannedAt.getTime() > 90 * 24 * 60 * 60 * 1000
        : false,
      hasRetentionPolicy: metadata.hasRetentionPolicy ?? false,
    };

    const result = this.riskScorer.score(scoringInput);

    // Update existing open findings for this asset or create new one
    const existingFinding = await this.prisma.riskFinding.findFirst({
      where: {
        tenantId,
        assetId,
        source: 'dspm',
        status: { in: ['open', 'acknowledged'] },
        deletedAt: null,
      },
    });

    let finding;
    if (existingFinding) {
      finding = await this.prisma.riskFinding.update({
        where: { id: existingFinding.id },
        data: {
          riskScore: result.score,
          severity: result.severity,
          evidence: {
            breakdown: result.breakdown,
            factors: result.factors,
          },
        },
      });
    } else {
      finding = await this.prisma.riskFinding.create({
        data: {
          tenantId,
          source: 'dspm',
          category: 'exposure',
          severity: result.severity,
          title: `Risk assessment for ${asset.name}`,
          description: `Automated risk scoring identified ${result.factors.length} risk factor(s): ${result.factors.join('; ')}`,
          assetId,
          dataSourceId: asset.dataSourceId,
          status: 'open',
          riskScore: result.score,
          remediationGuidance: this.generateRemediationGuidance(result.factors),
          evidence: {
            breakdown: result.breakdown,
            factors: result.factors,
          },
        },
      });

      await this.events.publish({
        type: 'finding.created',
        tenantId,
        data: { findingId: finding.id, severity: result.severity, assetId },
        timestamp: new Date(),
      });
    }

    await this.events.publish({
      type: 'risk.score.changed',
      tenantId,
      data: {
        assetId,
        findingId: finding.id,
        score: result.score,
        severity: result.severity,
      },
      timestamp: new Date(),
    });

    return { finding, riskResult: result };
  }

  async getDataMap(tenantId: string) {
    const dataSources = await this.prisma.dataSource.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        assets: {
          where: { deletedAt: null },
          include: {
            classifications: {
              include: { label: true },
            },
            riskFindings: {
              where: { deletedAt: null, status: { in: ['open', 'acknowledged'] } },
              select: { id: true, severity: true, riskScore: true },
            },
          },
        },
      },
    });

    return dataSources.map((ds) => ({
      dataSource: {
        id: ds.id,
        name: ds.name,
        type: ds.type,
        status: ds.status,
      },
      assets: ds.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        path: asset.path,
        classifications: asset.classifications.map((c) => ({
          labelId: c.labelId,
          labelName: c.label.name,
          category: c.label.category,
          sensitivityLevel: c.label.sensitivityLevel,
          confidence: c.confidence,
        })),
        riskSummary: {
          findingCount: asset.riskFindings.length,
          maxSeverity: this.getMaxSeverity(asset.riskFindings.map((f) => f.severity)),
          maxScore: asset.riskFindings.reduce(
            (max, f) => Math.max(max, Number(f.riskScore)),
            0,
          ),
        },
      })),
    }));
  }

  async getStats(tenantId: string) {
    const [severityDistribution, topRiskyAssets, statusDistribution] = await Promise.all([
      this.prisma.riskFinding.groupBy({
        by: ['severity'],
        where: { tenantId, deletedAt: null, status: { in: ['open', 'acknowledged'] } },
        _count: { id: true },
      }),
      this.prisma.riskFinding.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['open', 'acknowledged'] } },
        orderBy: { riskScore: 'desc' },
        take: 10,
        include: {
          asset: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.riskFinding.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
    ]);

    return {
      severityDistribution: severityDistribution.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      topRiskyAssets: topRiskyAssets.map((f) => ({
        findingId: f.id,
        assetId: f.assetId,
        assetName: f.asset?.name,
        assetType: f.asset?.type,
        riskScore: f.riskScore,
        severity: f.severity,
        title: f.title,
      })),
    };
  }

  async calculateEntityRisk(
    tenantId: string,
    entityType: string,
    entityId: string,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: entityId, tenantId, deletedAt: null },
      include: {
        classifications: { include: { label: true } },
        fields: true,
        dataSource: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${entityId} not found`);
    }

    const metadata = (asset.metadata as Record<string, any>) || {};

    // Compute all scoring dimensions
    const vendorScore = this.riskScorer.vendorExposureScore({
      vendorCount: metadata.vendorCount ?? 0,
      highRiskVendors: metadata.highRiskVendors ?? 0,
      dataSharedTypes: metadata.dataSharedTypes ?? 0,
    });

    const aiScore = this.riskScorer.aiUsageScore({
      isAiDataset: metadata.isAiDataset ?? false,
      hasConsent: metadata.hasAiConsent ?? false,
      modelCount: metadata.modelCount ?? 0,
    });

    const identityScore = this.riskScorer.identityAccessScore({
      principalCount: metadata.principalCount ?? 1,
      publicAccess: metadata.isPubliclyAccessible ?? false,
      excessivePermissions: metadata.excessivePermissions ?? 0,
      inactiveAccess: metadata.inactiveAccess ?? 0,
    });

    const retentionScore = this.riskScorer.retentionViolationScore({
      hasPolicy: metadata.hasRetentionPolicy ?? false,
      isOverdue: metadata.isRetentionOverdue ?? false,
      daysPastExpiry: metadata.daysPastExpiry ?? 0,
    });

    const securityScore = this.riskScorer.securityMisconfigScore({
      unencrypted: !(metadata.hasEncryption ?? true),
      publiclyAccessible: metadata.isPubliclyAccessible ?? false,
      noMfa: !(metadata.hasMfa ?? false),
      noAuditTrail: !(metadata.hasAuditTrail ?? true),
    });

    const compositeScore = Math.min(
      100,
      vendorScore + aiScore + identityScore + retentionScore + securityScore,
    );

    const severity = compositeScore >= 80
      ? 'critical'
      : compositeScore >= 60
        ? 'high'
        : compositeScore >= 40
          ? 'medium'
          : compositeScore >= 20
            ? 'low'
            : 'info';

    const breakdown = {
      vendorExposure: vendorScore,
      aiUsage: aiScore,
      identityAccess: identityScore,
      retentionViolation: retentionScore,
      securityMisconfig: securityScore,
    };

    const previousTrend = metadata.previousRiskScore
      ? compositeScore > metadata.previousRiskScore
        ? 'increasing'
        : compositeScore < metadata.previousRiskScore
          ? 'decreasing'
          : 'stable'
      : 'stable';

    // Upsert EntityRiskProfile
    const profile = await this.prisma.entityRiskProfile.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      create: {
        tenantId,
        entityType,
        entityId,
        compositeScore,
        severity,
        breakdown,
        trend: previousTrend,
        lastCalculatedAt: new Date(),
      },
      update: {
        compositeScore,
        severity,
        breakdown,
        trend: previousTrend,
        lastCalculatedAt: new Date(),
      },
    });

    await this.events.publish({
      type: 'entity.risk.calculated',
      tenantId,
      data: { entityType, entityId, compositeScore, severity, breakdown },
      timestamp: new Date(),
    });

    // Cache the computed risk profile
    const cacheKey = `risk_profile:${tenantId}:${entityType}:${entityId}`;
    try {
      await this.redis.setex(cacheKey, RISK_CACHE_TTL_SECONDS, JSON.stringify(profile));
    } catch {
      // Non-fatal: continue without caching
    }

    return profile;
  }

  async getRiskTrends(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const profiles = await this.prisma.entityRiskProfile.findMany({
      where: {
        tenantId,
        lastCalculatedAt: { gte: since },
      },
      orderBy: { lastCalculatedAt: 'asc' },
      select: {
        entityType: true,
        entityId: true,
        compositeScore: true,
        severity: true,
        trend: true,
        lastCalculatedAt: true,
      },
    });

    return { data: profiles, period: { days, since } };
  }

  async getRiskProfiles(
    tenantId: string,
    filters: {
      entityType?: string;
      minScore?: number;
      trend?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, entityType, minScore, trend } = filters;

    const where: any = {
      tenantId,
      ...(entityType && { entityType }),
      ...(minScore !== undefined && { compositeScore: { gte: minScore } }),
      ...(trend && { trend }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.entityRiskProfile.findMany({
        where,
        orderBy: [{ compositeScore: 'desc' }, { lastCalculatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.entityRiskProfile.count({ where }),
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

  async recalculateAllRisks(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, type: true },
    });

    this.logger.log(
      `Recalculating risk for ${assets.length} assets in tenant ${tenantId}`,
    );

    let processed = 0;
    let failed = 0;
    const CONCURRENCY = 10;

    // Process in parallel batches with concurrency limit
    for (let i = 0; i < assets.length; i += CONCURRENCY) {
      const chunk = assets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((asset) =>
          this.calculateEntityRisk(tenantId, asset.type, asset.id),
        ),
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          this.logger.warn(
            `Failed to recalculate risk for asset: ${result.reason?.message}`,
          );
          failed++;
        }
      }
    }

    return { processed, failed, total: assets.length };
  }

  private getMaxSeverity(severities: string[]): string | null {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const level of order) {
      if (severities.includes(level)) return level;
    }
    return null;
  }

  private generateRemediationGuidance(factors: string[]): string {
    const guidance: string[] = [];
    for (const factor of factors) {
      if (factor.includes('Publicly accessible')) {
        guidance.push('Restrict public access and implement network-level controls.');
      }
      if (factor.includes('No encryption')) {
        guidance.push('Enable encryption at rest using a managed encryption key.');
      }
      if (factor.includes('No MFA')) {
        guidance.push('Enforce multi-factor authentication for data access.');
      }
      if (factor.includes('Overly permissive')) {
        guidance.push('Review and reduce IAM principal access to least privilege.');
      }
      if (factor.includes('No retention policy')) {
        guidance.push('Apply an appropriate data retention policy.');
      }
      if (factor.includes('Stale data')) {
        guidance.push('Review stale data for archival or deletion.');
      }
    }
    return guidance.length > 0
      ? guidance.join(' ')
      : 'Review asset security posture and apply appropriate controls.';
  }
}
