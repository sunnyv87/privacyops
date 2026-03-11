import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class AccessPatternAnalyzer {
  private readonly logger = new Logger(AccessPatternAnalyzer.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeBaselines(tenantId: string) {
    const accessByIdentity = await this.prisma.identityAccessMapping.groupBy({
      by: ['identityId'],
      where: { tenantId },
      _count: { id: true },
    });

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    let computed = 0;

    for (const entry of accessByIdentity) {
      await this.prisma.accessBaseline.upsert({
        where: {
          tenantId_entityType_entityId: {
            tenantId,
            entityType: 'identity',
            entityId: entry.identityId,
          },
        },
        create: {
          tenantId,
          entityType: 'identity',
          entityId: entry.identityId,
          baselineData: { assetCount: entry._count.id },
          validUntil,
        },
        update: {
          baselineData: { assetCount: entry._count.id },
          validUntil,
        },
      });
      computed++;
    }

    this.logger.log(`Computed ${computed} access baselines for tenant ${tenantId}`);
    return { computed };
  }

  async detectAnomalies(tenantId: string) {
    const currentAccess = await this.prisma.identityAccessMapping.groupBy({
      by: ['identityId'],
      where: { tenantId },
      _count: { id: true },
    });

    const baselines = await this.prisma.accessBaseline.findMany({
      where: { tenantId, entityType: 'identity' },
    });

    const baselineMap = new Map<string, Record<string, any>>(
      baselines.map((b) => [b.entityId, b.baselineData as Record<string, any>]),
    );

    const indicators: any[] = [];

    for (const entry of currentAccess) {
      const baselineData = baselineMap.get(entry.identityId);
      if (!baselineData || !baselineData.assetCount) continue;

      const baselineCount = Number(baselineData.assetCount);
      if (entry._count.id > baselineCount * 2) {
        const indicator = await this.prisma.threatIndicator.create({
          data: {
            tenantId,
            indicatorType: 'access_anomaly',
            entityType: 'identity',
            entityId: entry.identityId,
            severity: 'high',
            confidence: 0.8,
            evidence: {
              currentCount: entry._count.id,
              baselineCount: baselineCount,
              ratio: (entry._count.id / baselineCount).toFixed(2),
            },
            status: 'open',
          },
        });
        indicators.push(indicator);
      }
    }

    this.logger.log(`Detected ${indicators.length} access anomalies for tenant ${tenantId}`);
    return indicators;
  }

  async detectExcessiveAccess(tenantId: string) {
    const excessiveByIdentity = await this.prisma.identityAccessMapping.groupBy({
      by: ['identityId'],
      where: { tenantId, isExcessive: true },
      _count: { id: true },
    });

    const indicators: any[] = [];

    for (const entry of excessiveByIdentity) {
      if (entry._count.id > 3) {
        const indicator = await this.prisma.threatIndicator.create({
          data: {
            tenantId,
            indicatorType: 'permission_escalation',
            entityType: 'identity',
            entityId: entry.identityId,
            severity: 'medium',
            confidence: 0.75,
            evidence: { excessiveCount: entry._count.id },
            status: 'open',
          },
        });
        indicators.push(indicator);
      }
    }

    this.logger.log(`Detected ${indicators.length} excessive access indicators for tenant ${tenantId}`);
    return indicators;
  }
}
