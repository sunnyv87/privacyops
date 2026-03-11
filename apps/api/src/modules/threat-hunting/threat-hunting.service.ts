import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { AccessPatternAnalyzer } from './access-pattern-analyzer.service';

@Injectable()
export class ThreatHuntingService {
  private readonly logger = new Logger(ThreatHuntingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly accessPatternAnalyzer: AccessPatternAnalyzer,
  ) {}

  async startHunt(
    tenantId: string,
    huntType: string,
    query: any,
    userId?: string,
  ) {
    const hunt = await this.prisma.threatHunt.create({
      data: {
        tenantId,
        huntType,
        query: query || {},
        status: 'running',
        startedAt: new Date(),
        ...(userId && { startedBy: userId }),
      },
    });

    let findings: any[] = [];

    try {
      switch (huntType) {
        case 'abnormal_access':
          findings = await this.accessPatternAnalyzer.detectAnomalies(tenantId);
          break;

        case 'credential_misuse':
          findings = await this.huntCredentialMisuse(tenantId);
          break;

        case 'shadow_ai':
          findings = await this.huntShadowAi(tenantId);
          break;

        default:
          this.logger.warn(`Unknown hunt type: ${huntType}`);
      }

      await this.prisma.threatHunt.update({
        where: { id: hunt.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          findingCount: findings.length,
          findings: findings.map((f) => f.id || f),
        },
      });
    } catch (error) {
      await this.prisma.threatHunt.update({
        where: { id: hunt.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error.message,
        },
      });
      throw error;
    }

    await this.audit.log({
      tenantId,
      actorId: userId || 'system',
      actorType: userId ? 'user' : 'system',
      action: 'threat_hunt.completed',
      entityType: 'threat_hunt',
      entityId: hunt.id,
      changes: {
        after: { huntType, findingCount: findings.length },
      },
    });

    this.logger.log(
      `Threat hunt ${hunt.id} (${huntType}) completed with ${findings.length} findings`,
    );

    return {
      ...hunt,
      status: 'completed',
      findingCount: findings.length,
      findings,
    };
  }

  async getHunts(
    tenantId: string,
    filters: {
      huntType?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, huntType, status } = filters;

    const where: any = {
      tenantId,
      ...(huntType && { huntType }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.threatHunt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.threatHunt.count({ where }),
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

  async getHuntById(tenantId: string, id: string) {
    const hunt = await this.prisma.threatHunt.findFirst({
      where: { id, tenantId },
    });

    if (!hunt) {
      throw new NotFoundException(`Threat hunt ${id} not found`);
    }

    return hunt;
  }

  async runFullDetection(tenantId: string) {
    this.logger.log(`Running full threat detection for tenant ${tenantId}`);

    // Compute baselines first
    await this.accessPatternAnalyzer.computeBaselines(tenantId);

    // Run all hunt types
    const results = await Promise.allSettled([
      this.startHunt(tenantId, 'abnormal_access', {}),
      this.startHunt(tenantId, 'credential_misuse', {}),
      this.startHunt(tenantId, 'shadow_ai', {}),
    ]);

    const allIndicators: any[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.findings) {
        allIndicators.push(...result.value.findings);
      }
    }

    // Publish events for each indicator
    for (const indicator of allIndicators) {
      await this.events.publish({
        type: 'threat.indicator.detected',
        tenantId,
        data: {
          indicatorId: indicator.id,
          indicatorType: indicator.indicatorType,
          severity: indicator.severity,
        },
        timestamp: new Date(),
      });
    }

    this.logger.log(
      `Full detection completed: ${allIndicators.length} indicators found`,
    );

    return {
      huntsExecuted: results.length,
      totalIndicators: allIndicators.length,
      indicators: allIndicators,
    };
  }

  async getIndicators(
    tenantId: string,
    filters: {
      indicatorType?: string;
      status?: string;
      severity?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, indicatorType, status, severity } = filters;

    const where: any = {
      tenantId,
      ...(indicatorType && { indicatorType }),
      ...(status && { status }),
      ...(severity && { severity }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.threatIndicator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.threatIndicator.count({ where }),
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

  async updateIndicatorStatus(
    tenantId: string,
    id: string,
    status: string,
    userId: string,
  ) {
    const indicator = await this.prisma.threatIndicator.findFirst({
      where: { id, tenantId },
    });

    if (!indicator) {
      throw new NotFoundException(`Threat indicator ${id} not found`);
    }

    const previousStatus = indicator.status;

    const updated = await this.prisma.threatIndicator.update({
      where: { id },
      data: {
        status,
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'threat_indicator.status_changed',
      entityType: 'threat_indicator',
      entityId: id,
      changes: {
        before: { status: previousStatus },
        after: { status },
      },
    });

    return updated;
  }

  async getBaselines(tenantId: string, page = 1, pageSize = 20) {
    const where = { tenantId };

    const [data, totalItems] = await Promise.all([
      this.prisma.accessBaseline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.accessBaseline.count({ where }),
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

  private async huntCredentialMisuse(tenantId: string) {
    // Find inactive access mappings with admin-level access
    const inactiveAdmin = await this.prisma.identityAccessMapping.findMany({
      where: {
        tenantId,
        isInactive: true,
        accessLevel: { in: ['admin', 'owner', 'write'] },
      },
      take: 100,
    });

    const indicators: any[] = [];

    for (const mapping of inactiveAdmin) {
      const indicator = await this.prisma.threatIndicator.create({
        data: {
          tenantId,
          indicatorType: 'credential_misuse',
          severity: 'high',
          status: 'open',
          identityId: mapping.identityId,
          description: `Inactive identity ${mapping.identityId} retains ${mapping.accessLevel} access to asset ${mapping.assetId}`,
          metadata: {
            accessLevel: mapping.accessLevel,
            assetId: mapping.assetId,
            lastAccessed: mapping.lastAccessed,
          },
        },
      });
      indicators.push(indicator);
    }

    return indicators;
  }

  private async huntShadowAi(tenantId: string) {
    // Find assets matching AI patterns without AiDatasetUsage records
    const aiAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: 'model', mode: 'insensitive' } },
          { name: { contains: 'training', mode: 'insensitive' } },
          { name: { contains: 'embeddings', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });

    const indicators: any[] = [];

    for (const asset of aiAssets) {
      // Check if this asset has an AiDatasetUsage record
      const usage = await this.prisma.aiDatasetUsage.findFirst({
        where: { tenantId, assetId: asset.id },
      });

      if (!usage) {
        const indicator = await this.prisma.threatIndicator.create({
          data: {
            tenantId,
            indicatorType: 'shadow_ai',
            severity: 'medium',
            status: 'open',
            description: `Asset "${asset.name}" matches AI patterns but has no registered AI dataset usage`,
            metadata: {
              assetId: asset.id,
              assetName: asset.name,
            },
          },
        });
        indicators.push(indicator);
      }
    }

    return indicators;
  }
}
