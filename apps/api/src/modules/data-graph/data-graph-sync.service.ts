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

    // Post-sync: identity-access edges and external sharing
    const [identityAccessStats, externalSharingStats] = await Promise.all([
      this.syncIdentityAccess(tenantId),
      this.syncExternalSharing(tenantId),
    ]);

    const summary = {
      assets: assetStats,
      vendors: vendorStats,
      users: userStats,
      identityAccess: identityAccessStats,
      externalSharing: externalSharingStats,
    };

    this.logger.log(
      `Graph sync completed for tenant ${tenantId}: ` +
      `${assetStats.nodesCreated} asset nodes, ` +
      `${vendorStats.nodesCreated} vendor nodes, ` +
      `${userStats.nodesCreated} user nodes, ` +
      `${identityAccessStats.edgesCreated} access edges, ` +
      `${externalSharingStats.edgesCreated} sharing edges`,
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

  /**
   * Sync identity-access mappings into the graph as ACCESSIBLE_BY edges.
   */
  async syncIdentityAccess(tenantId: string) {
    const mappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId },
      select: {
        identityId: true,
        identityName: true,
        identityType: true,
        assetId: true,
        permissionLevel: true,
        accessSource: true,
        isExcessive: true,
        isInactive: true,
      },
    });

    let edgesCreated = 0;

    for (const mapping of mappings) {
      // Ensure identity node exists
      const identityNode = await this.graphService.createNode(
        tenantId,
        'identity',
        mapping.identityId,
        mapping.identityName,
        { identityType: mapping.identityType },
      );

      // Find asset node
      const assetNode = await this.prisma.dataGraphNode.findFirst({
        where: { tenantId, nodeType: 'asset', entityId: mapping.assetId },
      });

      if (assetNode) {
        // Check if edge already exists
        const existingEdge = await this.prisma.dataGraphEdge.findFirst({
          where: {
            tenantId,
            sourceNodeId: assetNode.id,
            targetNodeId: identityNode.id,
            relationshipType: 'ACCESSIBLE_BY',
          },
        });

        if (!existingEdge) {
          await this.graphService.createEdge(
            tenantId,
            assetNode.id,
            identityNode.id,
            'ACCESSIBLE_BY',
            {
              permissionLevel: mapping.permissionLevel,
              source: mapping.accessSource,
              isExcessive: mapping.isExcessive,
              isInactive: mapping.isInactive,
            },
          );
          edgesCreated++;
        }
      }
    }

    return { edgesCreated };
  }

  /**
   * Detect external/public sharing and create SHARED_WITH edges to a synthetic external node.
   */
  async syncExternalSharing(tenantId: string) {
    const publicMappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, identityType: 'public' },
      select: { assetId: true },
    });

    // Also check assets with public access in accessPermissions JSON
    const assetsWithPublicAccess = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, accessPermissions: true },
    });

    const publicAssetIds = new Set<string>(publicMappings.map((m) => m.assetId));
    for (const asset of assetsWithPublicAccess) {
      const perms = (asset.accessPermissions as any[]) || [];
      if (perms.some((p) => p.principalType === 'public')) {
        publicAssetIds.add(asset.id);
      }
    }

    let edgesCreated = 0;

    if (publicAssetIds.size > 0) {
      // Create a synthetic "external/public" node
      const externalNode = await this.graphService.createNode(
        tenantId,
        'identity',
        `${tenantId}:public`,
        'Public / External Access',
        { synthetic: true, identityType: 'public' },
      );

      for (const assetId of publicAssetIds) {
        const assetNode = await this.prisma.dataGraphNode.findFirst({
          where: { tenantId, nodeType: 'asset', entityId: assetId },
        });

        if (assetNode) {
          const existingEdge = await this.prisma.dataGraphEdge.findFirst({
            where: {
              tenantId,
              sourceNodeId: assetNode.id,
              targetNodeId: externalNode.id,
              relationshipType: 'SHARED_WITH',
            },
          });

          if (!existingEdge) {
            await this.graphService.createEdge(
              tenantId,
              assetNode.id,
              externalNode.id,
              'SHARED_WITH',
              { sharingType: 'public_access' },
            );
            edgesCreated++;
          }
        }
      }
    }

    return { edgesCreated };
  }
}
