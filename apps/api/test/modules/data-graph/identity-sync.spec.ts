import { Test, TestingModule } from '@nestjs/testing';
import { DataGraphSyncService } from '@/modules/data-graph/data-graph-sync.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { DataGraphService } from '@/modules/data-graph/data-graph.service';

describe('DataGraphSyncService — Identity Access & External Sharing Sync', () => {
  let service: DataGraphSyncService;
  let prisma: any;
  let graphService: any;

  const tenantId = 'tenant-graph-1';

  beforeEach(async () => {
    graphService = {
      createNode: jest.fn().mockImplementation((_t, _type, entityId, name) => ({
        id: `node-${entityId}`,
        entityId,
        name,
      })),
      createEdge: jest.fn().mockResolvedValue({ id: 'edge-1' }),
    };

    prisma = {
      identityAccessMapping: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      asset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dataGraphNode: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dataGraphEdge: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataGraphSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: DataGraphService, useValue: graphService },
      ],
    }).compile();

    service = module.get<DataGraphSyncService>(DataGraphSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncIdentityAccess', () => {
    it('should create identity nodes and ACCESSIBLE_BY edges', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        {
          identityId: 'user-1',
          identityName: 'alice@corp.com',
          identityType: 'user',
          assetId: 'asset-1',
          permissionLevel: 'write',
          accessSource: 'iam',
          isExcessive: false,
          isInactive: false,
        },
      ]);

      prisma.dataGraphNode.findFirst.mockResolvedValue({ id: 'node-asset-1' });

      const result = await service.syncIdentityAccess(tenantId);

      expect(graphService.createNode).toHaveBeenCalledWith(
        tenantId,
        'identity',
        'user-1',
        'alice@corp.com',
        { identityType: 'user' },
      );

      expect(graphService.createEdge).toHaveBeenCalledWith(
        tenantId,
        'node-asset-1',
        'node-user-1',
        'ACCESSIBLE_BY',
        expect.objectContaining({
          permissionLevel: 'write',
          source: 'iam',
          isExcessive: false,
        }),
      );

      expect(result.edgesCreated).toBe(1);
    });

    it('should skip edge creation when asset node does not exist in graph', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        {
          identityId: 'user-1',
          identityName: 'alice@corp.com',
          identityType: 'user',
          assetId: 'missing-asset',
          permissionLevel: 'read',
          accessSource: 'iam',
          isExcessive: false,
          isInactive: false,
        },
      ]);

      prisma.dataGraphNode.findFirst.mockResolvedValue(null);

      const result = await service.syncIdentityAccess(tenantId);

      expect(graphService.createNode).toHaveBeenCalled(); // identity node still created
      expect(graphService.createEdge).not.toHaveBeenCalled();
      expect(result.edgesCreated).toBe(0);
    });

    it('should not create duplicate ACCESSIBLE_BY edges', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        {
          identityId: 'user-1',
          identityName: 'alice@corp.com',
          identityType: 'user',
          assetId: 'asset-1',
          permissionLevel: 'read',
          accessSource: 'iam',
          isExcessive: false,
          isInactive: false,
        },
      ]);

      prisma.dataGraphNode.findFirst.mockResolvedValue({ id: 'node-asset-1' });
      prisma.dataGraphEdge.findFirst.mockResolvedValue({ id: 'existing-edge' }); // edge already exists

      const result = await service.syncIdentityAccess(tenantId);

      expect(graphService.createEdge).not.toHaveBeenCalled();
      expect(result.edgesCreated).toBe(0);
    });

    it('should handle multiple identity mappings', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        {
          identityId: 'user-1',
          identityName: 'alice@corp.com',
          identityType: 'user',
          assetId: 'asset-1',
          permissionLevel: 'admin',
          accessSource: 'iam',
          isExcessive: true,
          isInactive: false,
        },
        {
          identityId: 'svc-1',
          identityName: 'pipeline-svc',
          identityType: 'service_account',
          assetId: 'asset-2',
          permissionLevel: 'read',
          accessSource: 'k8s_rbac',
          isExcessive: false,
          isInactive: true,
        },
      ]);

      prisma.dataGraphNode.findFirst
        .mockResolvedValueOnce({ id: 'node-asset-1' })
        .mockResolvedValueOnce({ id: 'node-asset-2' });

      const result = await service.syncIdentityAccess(tenantId);

      expect(graphService.createNode).toHaveBeenCalledTimes(2);
      expect(graphService.createEdge).toHaveBeenCalledTimes(2);
      expect(result.edgesCreated).toBe(2);
    });
  });

  describe('syncExternalSharing', () => {
    it('should create synthetic public node and SHARED_WITH edges for public mappings', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        { assetId: 'asset-public-1' },
      ]);

      prisma.asset.findMany.mockResolvedValue([]);
      prisma.dataGraphNode.findFirst.mockResolvedValue({ id: 'node-asset-public-1' });

      const result = await service.syncExternalSharing(tenantId);

      // Should create synthetic public node
      expect(graphService.createNode).toHaveBeenCalledWith(
        tenantId,
        'identity',
        `${tenantId}:public`,
        'Public / External Access',
        { synthetic: true, identityType: 'public' },
      );

      // Should create SHARED_WITH edge
      expect(graphService.createEdge).toHaveBeenCalledWith(
        tenantId,
        'node-asset-public-1',
        expect.any(String),
        'SHARED_WITH',
        { sharingType: 'public_access' },
      );

      expect(result.edgesCreated).toBe(1);
    });

    it('should detect public access from accessPermissions JSON', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([]);
      prisma.asset.findMany.mockResolvedValue([
        {
          id: 'asset-json-public',
          accessPermissions: [
            { principalType: 'public', permissions: ['read'] },
          ],
        },
      ]);

      prisma.dataGraphNode.findFirst.mockResolvedValue({ id: 'node-asset-json-public' });

      const result = await service.syncExternalSharing(tenantId);

      expect(graphService.createEdge).toHaveBeenCalled();
      expect(result.edgesCreated).toBe(1);
    });

    it('should not create edges when no public access exists', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([]);
      prisma.asset.findMany.mockResolvedValue([
        {
          id: 'asset-private',
          accessPermissions: [
            { principalType: 'user', permissions: ['read'] },
          ],
        },
      ]);

      const result = await service.syncExternalSharing(tenantId);

      expect(graphService.createEdge).not.toHaveBeenCalled();
      expect(result.edgesCreated).toBe(0);
    });

    it('should deduplicate assets from both mappings and accessPermissions', async () => {
      prisma.identityAccessMapping.findMany.mockResolvedValue([
        { assetId: 'asset-both' },
      ]);

      prisma.asset.findMany.mockResolvedValue([
        {
          id: 'asset-both',
          accessPermissions: [{ principalType: 'public', permissions: ['read'] }],
        },
      ]);

      prisma.dataGraphNode.findFirst.mockResolvedValue({ id: 'node-asset-both' });

      const result = await service.syncExternalSharing(tenantId);

      // Only one edge despite appearing in both sources
      expect(graphService.createEdge).toHaveBeenCalledTimes(1);
      expect(result.edgesCreated).toBe(1);
    });
  });
});
