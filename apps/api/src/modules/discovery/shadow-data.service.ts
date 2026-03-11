import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class ShadowDataService {
  private readonly logger = new Logger(ShadowDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeShadowSignals(tenantId: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        dataSourceId: true,
        fingerprint: true,
        ownerEmail: true,
        ownerUserId: true,
        lastScannedAt: true,
        isShadowData: true,
        path: true,
      },
    });

    const signals: {
      assetId: string;
      assetName: string;
      signal: string;
      severity: 'low' | 'medium' | 'high';
    }[] = [];

    // Build fingerprint cross-source map
    const fingerprintMap = new Map<string, string[]>();
    for (const asset of assets) {
      if (asset.fingerprint) {
        const sources = fingerprintMap.get(asset.fingerprint) || [];
        if (!sources.includes(asset.dataSourceId)) {
          sources.push(asset.dataSourceId);
        }
        fingerprintMap.set(asset.fingerprint, sources);
      }
    }

    for (const asset of assets) {
      // Cross-source fingerprint match
      if (asset.fingerprint) {
        const sources = fingerprintMap.get(asset.fingerprint) || [];
        if (sources.length > 1) {
          signals.push({
            assetId: asset.id,
            assetName: asset.name,
            signal: 'duplicate_across_sources',
            severity: 'high',
          });
        }
      }

      // No owner
      if (!asset.ownerEmail && !asset.ownerUserId) {
        signals.push({
          assetId: asset.id,
          assetName: asset.name,
          signal: 'no_owner_assigned',
          severity: 'medium',
        });
      }

      // Stale scan
      if (!asset.lastScannedAt || asset.lastScannedAt < cutoffDate) {
        signals.push({
          assetId: asset.id,
          assetName: asset.name,
          signal: 'stale_not_scanned_180_days',
          severity: 'low',
        });
      }
    }

    this.logger.log(
      `Shadow signal analysis for tenant ${tenantId}: ${signals.length} signal(s) detected`,
    );

    return signals;
  }

  async getStats(tenantId: string) {
    const [totalAssets, shadowAssets, unownedCount, staleCount] = await Promise.all([
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null, isShadowData: true },
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          deletedAt: null,
          ownerEmail: null,
          ownerUserId: null,
        },
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { lastScannedAt: null },
            {
              lastScannedAt: {
                lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      }),
    ]);

    return {
      totalAssets,
      shadowAssets,
      shadowPercent: totalAssets > 0 ? Math.round((shadowAssets / totalAssets) * 10000) / 100 : 0,
      unownedCount,
      staleCount,
    };
  }
}
