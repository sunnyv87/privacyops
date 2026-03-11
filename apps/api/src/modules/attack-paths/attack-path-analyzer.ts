import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class AttackPathAnalyzer {
  private readonly logger = new Logger(AttackPathAnalyzer.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeAttackPaths(tenantId: string) {
    this.logger.log(`Analyzing attack paths for tenant ${tenantId}`);
    const paths: any[] = [];

    // Find assets with public or excessive access
    const exposedMappings = await this.prisma.identityAccessMapping.findMany({
      where: {
        tenantId,
        OR: [
          { identityType: 'public' },
          { isExcessive: true },
        ],
      },
    });

    // Find sensitive assets (those with high-severity risk findings)
    const sensitiveAssets = await this.prisma.riskFinding.findMany({
      where: {
        tenantId,
        deletedAt: null,
        severity: { in: ['critical', 'high'] },
        status: { in: ['open', 'acknowledged'] },
      },
      include: {
        asset: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    const sensitiveAssetIds = new Set(sensitiveAssets.map((f) => f.assetId));

    // Build attack paths from exposed entry points to sensitive assets
    for (const mapping of exposedMappings) {
      // Check if this exposed asset leads to sensitive data via lineage
      const downstream = await this.prisma.dataLineageRecord.findMany({
        where: { tenantId, sourceAssetId: mapping.assetId },
      });

      for (const record of downstream) {
        if (sensitiveAssetIds.has(record.targetAssetId)) {
          const targetFinding = sensitiveAssets.find(
            (f) => f.assetId === record.targetAssetId,
          );

          const riskScore = this.calculatePathRisk(
            mapping.identityType === 'public',
            mapping.isExcessive,
            targetFinding?.severity || 'medium',
          );

          const severity = riskScore >= 80
            ? 'critical'
            : riskScore >= 60
              ? 'high'
              : riskScore >= 40
                ? 'medium'
                : 'low';

          const attackPath = await this.prisma.attackPath.create({
            data: {
              tenantId,
              title: `${mapping.identityType === 'public' ? 'Public' : 'Excessive'} access path to ${targetFinding?.asset?.name || record.targetAssetId}`,
              description: `Attack path from ${mapping.identityType} identity via ${mapping.identityName} through ${record.transformType} to sensitive asset`,
              severity,
              status: 'open',
              riskScore,
              entryPoint: {
                assetId: mapping.assetId,
                identityType: mapping.identityType,
                identityName: mapping.identityName,
                accessLevel: mapping.accessLevel,
              },
              targetAsset: {
                assetId: record.targetAssetId,
                assetName: targetFinding?.asset?.name,
                assetType: targetFinding?.asset?.type,
              },
              pathSteps: [
                {
                  assetId: mapping.assetId,
                  action: `${mapping.identityType} access via ${mapping.identityName}`,
                },
                {
                  assetId: record.targetAssetId,
                  action: `Data flow via ${record.transformType}`,
                },
              ],
            },
          });

          paths.push(attackPath);
        }
      }

      // Direct access to sensitive asset
      if (sensitiveAssetIds.has(mapping.assetId)) {
        const targetFinding = sensitiveAssets.find(
          (f) => f.assetId === mapping.assetId,
        );

        const riskScore = this.calculatePathRisk(
          mapping.identityType === 'public',
          mapping.isExcessive,
          targetFinding?.severity || 'medium',
        );

        const severity = riskScore >= 80
          ? 'critical'
          : riskScore >= 60
            ? 'high'
            : riskScore >= 40
              ? 'medium'
              : 'low';

        const attackPath = await this.prisma.attackPath.create({
          data: {
            tenantId,
            title: `Direct ${mapping.identityType === 'public' ? 'public' : 'excessive'} access to ${targetFinding?.asset?.name || mapping.assetId}`,
            description: `Direct ${mapping.identityType} access to sensitive asset via ${mapping.identityName}`,
            severity,
            status: 'open',
            riskScore,
            entryPoint: {
              assetId: mapping.assetId,
              identityType: mapping.identityType,
              identityName: mapping.identityName,
              accessLevel: mapping.accessLevel,
            },
            targetAsset: {
              assetId: mapping.assetId,
              assetName: targetFinding?.asset?.name,
              assetType: targetFinding?.asset?.type,
            },
            pathSteps: [
              {
                assetId: mapping.assetId,
                action: `Direct ${mapping.identityType} access via ${mapping.identityName}`,
              },
            ],
          },
        });

        paths.push(attackPath);
      }
    }

    return { pathsFound: paths.length, paths };
  }

  private calculatePathRisk(
    isPublic: boolean,
    isExcessive: boolean,
    targetSeverity: string,
  ): number {
    let score = 0;

    // Entry point risk
    if (isPublic) score += 40;
    else if (isExcessive) score += 25;

    // Target sensitivity
    const severityScores: Record<string, number> = {
      critical: 50,
      high: 40,
      medium: 25,
      low: 10,
    };
    score += severityScores[targetSeverity] || 10;

    return Math.min(100, score);
  }
}
