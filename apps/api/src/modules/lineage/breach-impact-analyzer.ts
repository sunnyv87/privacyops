import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class BreachImpactAnalyzer {
  private readonly logger = new Logger(BreachImpactAnalyzer.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeImpact(tenantId: string, assetId: string) {
    const visited = new Set<string>();
    const affectedAssets: any[] = [];
    const affectedDataTypes = new Set<string>();
    const affectedVendors = new Set<string>();

    await this.traceDownstream(tenantId, assetId, visited, affectedAssets, affectedDataTypes);

    // Get the breached asset info
    const breachedAsset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      include: {
        classifications: { include: { label: true } },
        dataSource: { select: { id: true, name: true, type: true } },
      },
    });

    // Collect vendors from affected assets' data sources
    for (const affected of affectedAssets) {
      if (affected.dataSource?.name) {
        affectedVendors.add(affected.dataSource.name);
      }
    }

    return {
      breachedAssetId: assetId,
      breachedAsset: breachedAsset
        ? { id: breachedAsset.id, name: breachedAsset.name, type: breachedAsset.type }
        : null,
      impactSummary: {
        affectedAssetCount: affectedAssets.length,
        affectedDataTypes: Array.from(affectedDataTypes),
        affectedVendors: Array.from(affectedVendors),
      },
      affectedAssets: affectedAssets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        dataSource: a.dataSource?.name,
        transformPath: a.transformPath,
      })),
    };
  }

  private async traceDownstream(
    tenantId: string,
    assetId: string,
    visited: Set<string>,
    affectedAssets: any[],
    affectedDataTypes: Set<string>,
    transformPath: string[] = [],
  ) {
    if (visited.has(assetId)) return;
    visited.add(assetId);

    const records = await this.prisma.dataLineageRecord.findMany({
      where: { tenantId, sourceAssetId: assetId },
    });

    for (const record of records) {
      const dataCategories = (record.dataCategories as string[]) || [];
      for (const cat of dataCategories) {
        affectedDataTypes.add(cat);
      }

      const asset = await this.prisma.asset.findFirst({
        where: { id: record.targetAssetId, tenantId, deletedAt: null },
        include: {
          dataSource: { select: { id: true, name: true, type: true } },
        },
      });

      if (asset) {
        const path = [...transformPath, record.transformType];
        affectedAssets.push({ ...asset, transformPath: path });

        await this.traceDownstream(
          tenantId,
          record.targetAssetId,
          visited,
          affectedAssets,
          affectedDataTypes,
          path,
        );
      }
    }
  }
}
