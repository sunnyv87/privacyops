import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { DataGraphService } from './data-graph.service';

@Injectable()
export class DataGraphSyncService {
  private readonly logger = new Logger(DataGraphSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: DataGraphService,
  ) {}

  async syncAll(tenantId: string) {
    this.logger.log(`Starting full graph sync for tenant ${tenantId}`);

    const [assetStats, vendorStats, userStats] = await Promise.all([
      this.syncAssets(tenantId),
      this.syncVendors(tenantId),
      this.syncUsers(tenantId),
    ]);

    const summary = {
      assets: assetStats,
      vendors: vendorStats,
      users: userStats,
    };

    this.logger.log(
      `Graph sync completed for tenant ${tenantId}: ` +
      `${assetStats.nodesCreated} asset nodes, ` +
      `${vendorStats.nodesCreated} vendor nodes, ` +
      `${userStats.nodesCreated} user nodes`,
    );

    return summary;
  }

  async syncAssets(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        dataSourceId: true,
        parentAssetId: true,
        metadata: true,
      },
    });

    // Ensure data source nodes exist
    const dataSources = await this.prisma.dataSource.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });

    const dsNodeMap = new Map<string, string>();
    for (const ds of dataSources) {
      const node = await this.graphService.createNode(
        tenantId,
        'dataset',
        ds.id,
        ds.name,
        { type: ds.type },
      );
      dsNodeMap.set(ds.id, node.id);
    }

    let nodesCreated = 0;
    let edgesCreated = 0;

    for (const asset of assets) {
      const node = await this.graphService.createNode(
        tenantId,
        'asset',
        asset.id,
        asset.name,
        { type: asset.type },
      );
      nodesCreated++;

      // Create STORED_IN edge to data source node
      const dsNodeId = dsNodeMap.get(asset.dataSourceId);
      if (dsNodeId) {
        await this.graphService.createEdge(
          tenantId,
          node.id,
          dsNodeId,
          'STORED_IN',
        );
        edgesCreated++;
      }

      // Create CONTAINS edges to child assets (parent -> child)
      if (asset.parentAssetId) {
        // Find or create parent node (it should already exist from iteration)
        const parentAsset = assets.find((a) => a.id === asset.parentAssetId);
        if (parentAsset) {
          const parentNode = await this.graphService.createNode(
            tenantId,
            'asset',
            parentAsset.id,
            parentAsset.name,
            { type: parentAsset.type },
          );
          await this.graphService.createEdge(
            tenantId,
            parentNode.id,
            node.id,
            'CONTAINS',
          );
          edgesCreated++;
        }
      }
    }

    return { nodesCreated, edgesCreated };
  }

  async syncVendors(tenantId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        dataShared: true,
        status: true,
      },
    });

    let nodesCreated = 0;
    let edgesCreated = 0;

    for (const vendor of vendors) {
      const node = await this.graphService.createNode(
        tenantId,
        'vendor',
        vendor.id,
        vendor.name,
        { type: vendor.type, status: vendor.status },
      );
      nodesCreated++;

      // If vendor has dataShared, create SHARED_WITH edges
      if (vendor.dataShared && Array.isArray(vendor.dataShared)) {
        for (const shared of vendor.dataShared as any[]) {
          const assetId = shared.assetId || shared.id;
          if (!assetId) continue;

          // Find the asset node
          const assetNode = await this.prisma.dataGraphNode.findFirst({
            where: { tenantId, nodeType: 'asset', entityId: assetId },
          });

          if (assetNode) {
            await this.graphService.createEdge(
              tenantId,
              assetNode.id,
              node.id,
              'SHARED_WITH',
              { dataTypes: shared.dataTypes || [] },
            );
            edgesCreated++;
          }
        }
      }
    }

    return { nodesCreated, edgesCreated };
  }

  async syncUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'active', deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    let nodesCreated = 0;

    for (const user of users) {
      await this.graphService.createNode(
        tenantId,
        'identity',
        user.id,
        user.name,
        { email: user.email },
      );
      nodesCreated++;
    }

    return { nodesCreated, edgesCreated: 0 };
  }
}
