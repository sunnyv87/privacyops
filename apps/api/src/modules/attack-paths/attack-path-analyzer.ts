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

  /**
   * Multi-hop attack path analysis — follows lineage chains up to maxDepth hops
   * from exposed entry points to sensitive assets.
   */
  async analyzeMultiHopPaths(tenantId: string, maxDepth = 3) {
    this.logger.log(`Analyzing multi-hop attack paths (depth=${maxDepth}) for tenant ${tenantId}`);
    const paths: any[] = [];

    const exposedMappings = await this.prisma.identityAccessMapping.findMany({
      where: {
        tenantId,
        OR: [{ identityType: 'public' }, { isExcessive: true }],
      },
    });

    const sensitiveAssets = await this.prisma.riskFinding.findMany({
      where: {
        tenantId,
        deletedAt: null,
        severity: { in: ['critical', 'high'] },
        status: { in: ['open', 'acknowledged'] },
      },
      include: { asset: { select: { id: true, name: true, type: true } } },
    });

    const sensitiveAssetIds = new Set(sensitiveAssets.map((f) => f.assetId));
    const entryAssetIds = new Set(exposedMappings.map((m) => m.assetId));

    // BFS from each entry point
    for (const mapping of exposedMappings) {
      const visited = new Set<string>();
      const queue: { assetId: string; depth: number; path: string[] }[] = [
        { assetId: mapping.assetId, depth: 0, path: [mapping.assetId] },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.assetId) || current.depth > maxDepth) continue;
        visited.add(current.assetId);

        // Check if we reached a sensitive asset (and it's not the entry point itself)
        if (sensitiveAssetIds.has(current.assetId) && current.depth > 0) {
          const targetFinding = sensitiveAssets.find((f) => f.assetId === current.assetId);
          const baseRisk = this.calculatePathRisk(
            mapping.identityType === 'public',
            mapping.isExcessive,
            targetFinding?.severity || 'medium',
          );
          const hopPenalty = Math.max(0, (current.depth - 1) * 5);
          const riskScore = Math.max(10, baseRisk - hopPenalty);

          const severity = riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

          const attackPath = await this.prisma.attackPath.create({
            data: {
              tenantId,
              title: `${current.depth}-hop path from ${mapping.identityType} access to ${targetFinding?.asset?.name || current.assetId}`,
              description: `Multi-hop attack path via ${mapping.identityName} through ${current.depth} lineage hop(s)`,
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
                assetId: current.assetId,
                assetName: targetFinding?.asset?.name,
                assetType: targetFinding?.asset?.type,
              },
              pathSteps: current.path.map((aid, idx) => ({
                assetId: aid,
                action: idx === 0 ? `Entry via ${mapping.identityType}` : `Lineage hop ${idx}`,
              })),
            },
          });
          paths.push(attackPath);
        }

        // Enqueue downstream lineage
        if (current.depth < maxDepth) {
          const downstream = await this.prisma.dataLineageRecord.findMany({
            where: { tenantId, sourceAssetId: current.assetId, isActive: true },
          });
          for (const record of downstream) {
            if (!visited.has(record.targetAssetId)) {
              queue.push({
                assetId: record.targetAssetId,
                depth: current.depth + 1,
                path: [...current.path, record.targetAssetId],
              });
            }
          }
        }
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
