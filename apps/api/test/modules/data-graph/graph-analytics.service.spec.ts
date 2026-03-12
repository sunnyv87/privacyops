import { Test, TestingModule } from '@nestjs/testing';
import { GraphAnalyticsService } from '../../../src/modules/data-graph/graph-analytics.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('GraphAnalyticsService', () => {
  let service: GraphAnalyticsService;

  const mockPrisma = {
    dataGraphNode: { findMany: jest.fn(), findFirst: jest.fn() },
    dataGraphEdge: { findMany: jest.fn() },
    graphAnalyticsResult: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    entityRiskProfile: { findMany: jest.fn() },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<GraphAnalyticsService>(GraphAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('computeCentrality', () => {
    it('should return empty results for tenant with no nodes', async () => {
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([]);

      const result = await service.computeCentrality('tenant-1');

      expect(result).toEqual({ nodes: [], nodeCount: 0, edgeCount: 0 });
    });

    it('should compute degree centrality correctly', async () => {
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([
        { id: 'n1', nodeType: 'asset', label: 'DB1' },
        { id: 'n2', nodeType: 'asset', label: 'DB2' },
        { id: 'n3', nodeType: 'user', label: 'User1' },
      ]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([
        { sourceNodeId: 'n1', targetNodeId: 'n2' },
        { sourceNodeId: 'n1', targetNodeId: 'n3' },
      ]);
      mockPrisma.graphAnalyticsResult.create.mockResolvedValue({ id: 'result-1' });

      const result = await service.computeCentrality('tenant-1');

      expect(result.nodeCount).toBe(3);
      expect(result.edgeCount).toBe(2);
      expect(result.data).toHaveLength(3);

      // n1 has 2 outgoing edges → totalDegree=2 → centrality=2/2=1.0
      const n1 = result.data!.find((n: any) => n.nodeId === 'n1');
      expect(n1!.outDegree).toBe(2);
      expect(n1!.inDegree).toBe(0);
      expect(n1!.centrality).toBe(1.0);

      // Results should be sorted by centrality descending
      expect(result.data![0].centrality).toBeGreaterThanOrEqual(result.data![1].centrality);
    });

    it('should store result in graphAnalyticsResult', async () => {
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([
        { id: 'n1', nodeType: 'asset', label: 'DB1' },
      ]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([]);
      mockPrisma.graphAnalyticsResult.create.mockResolvedValue({ id: 'result-1' });

      await service.computeCentrality('tenant-1');

      expect(mockPrisma.graphAnalyticsResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            analysisType: 'centrality',
          }),
        }),
      );
    });
  });

  describe('computeRiskPropagation', () => {
    it('should throw NotFoundException for non-existent node', async () => {
      mockPrisma.dataGraphNode.findFirst.mockResolvedValue(null);

      await expect(
        service.computeRiskPropagation('tenant-1', 'bad-node'),
      ).rejects.toThrow('Graph node bad-node not found');
    });

    it('should use batched queries instead of per-node queries', async () => {
      mockPrisma.dataGraphNode.findFirst.mockResolvedValue({
        id: 'n1',
        nodeType: 'asset',
        label: 'Start',
      });
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([
        { id: 'n1', entityId: 'e1', nodeType: 'asset', label: 'Start' },
        { id: 'n2', entityId: 'e2', nodeType: 'asset', label: 'Mid' },
        { id: 'n3', entityId: 'e3', nodeType: 'user', label: 'End' },
      ]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([
        { sourceNodeId: 'n1', targetNodeId: 'n2' },
        { sourceNodeId: 'n2', targetNodeId: 'n3' },
      ]);
      mockPrisma.entityRiskProfile.findMany.mockResolvedValue([
        { entityId: 'e1', compositeScore: 80 },
        { entityId: 'e2', compositeScore: 60 },
        { entityId: 'e3', compositeScore: 40 },
      ]);

      const result = await service.computeRiskPropagation('tenant-1', 'n1');

      // 3 batch queries total: findFirst + 3 findMany calls (via Promise.all)
      expect(mockPrisma.dataGraphNode.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.dataGraphEdge.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.entityRiskProfile.findMany).toHaveBeenCalledTimes(1);

      // BFS should traverse all 3 nodes
      expect(result.nodesAnalyzed).toBe(3);
      expect(result.propagationPath).toHaveLength(3);
    });

    it('should attenuate risk by 0.7^depth', async () => {
      mockPrisma.dataGraphNode.findFirst.mockResolvedValue({
        id: 'n1',
        nodeType: 'asset',
        label: 'Start',
      });
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([
        { id: 'n1', entityId: 'e1', nodeType: 'asset', label: 'Start' },
        { id: 'n2', entityId: 'e2', nodeType: 'asset', label: 'Next' },
      ]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([
        { sourceNodeId: 'n1', targetNodeId: 'n2' },
      ]);
      mockPrisma.entityRiskProfile.findMany.mockResolvedValue([
        { entityId: 'e1', compositeScore: 100 },
        { entityId: 'e2', compositeScore: 100 },
      ]);

      const result = await service.computeRiskPropagation('tenant-1', 'n1');

      // depth 0: 100 * 0.7^0 = 100
      // depth 1: 100 * 0.7^1 = 70
      // cumulative: 170
      expect(result.totalCumulativeRisk).toBe(170);
    });
  });

  describe('computeImpactRadius', () => {
    it('should throw NotFoundException for non-existent node', async () => {
      mockPrisma.dataGraphNode.findFirst.mockResolvedValue(null);

      await expect(
        service.computeImpactRadius('tenant-1', 'bad-node'),
      ).rejects.toThrow('Graph node bad-node not found');
    });

    it('should limit BFS to depth 3', async () => {
      // Setup a chain: n1 → n2 → n3 → n4 → n5
      let findFirstCallCount = 0;
      mockPrisma.dataGraphNode.findFirst.mockImplementation(({ where }: any) => {
        findFirstCallCount++;
        const nodes: Record<string, any> = {
          'n1': { id: 'n1', tenantId: 'tenant-1', nodeType: 'asset', label: 'N1' },
          'n2': { id: 'n2', tenantId: 'tenant-1', nodeType: 'asset', label: 'N2' },
          'n3': { id: 'n3', tenantId: 'tenant-1', nodeType: 'asset', label: 'N3' },
          'n4': { id: 'n4', tenantId: 'tenant-1', nodeType: 'asset', label: 'N4' },
          'n5': { id: 'n5', tenantId: 'tenant-1', nodeType: 'asset', label: 'N5' },
        };
        return Promise.resolve(nodes[where.id] || null);
      });

      mockPrisma.dataGraphEdge.findMany.mockImplementation(({ where }: any) => {
        const allEdges = [
          { sourceNodeId: 'n1', targetNodeId: 'n2', tenantId: 'tenant-1' },
          { sourceNodeId: 'n2', targetNodeId: 'n3', tenantId: 'tenant-1' },
          { sourceNodeId: 'n3', targetNodeId: 'n4', tenantId: 'tenant-1' },
          { sourceNodeId: 'n4', targetNodeId: 'n5', tenantId: 'tenant-1' },
        ];
        const nodeId = where.OR?.[0]?.sourceNodeId;
        return Promise.resolve(
          allEdges.filter(
            (e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId,
          ),
        );
      });
      mockPrisma.graphAnalyticsResult.create.mockResolvedValue({ id: 'r-1' });

      const result = await service.computeImpactRadius('tenant-1', 'n1');

      expect(result.maxDepth).toBe(3);
      // Should include n2 (depth 1), n3 (depth 2), n4 (depth 3) but NOT n5 (depth 4)
      expect(result.totalAffected).toBe(3);
      expect(result.affectedNodes.every((n: any) => n.depth <= 3)).toBe(true);
    });
  });

  describe('computeClusters', () => {
    it('should find connected components', async () => {
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([
        { id: 'n1', nodeType: 'asset', label: 'A' },
        { id: 'n2', nodeType: 'asset', label: 'B' },
        { id: 'n3', nodeType: 'asset', label: 'C' }, // isolated
      ]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([
        { sourceNodeId: 'n1', targetNodeId: 'n2' },
      ]);

      const result = await service.computeClusters('tenant-1');

      expect(result.totalClusters).toBe(2);
      expect(result.totalNodes).toBe(3);

      // Largest cluster first
      expect(result.data[0].size).toBe(2);
      expect(result.data[1].size).toBe(1);
    });

    it('should return empty for tenant with no nodes', async () => {
      mockPrisma.dataGraphNode.findMany.mockResolvedValue([]);
      mockPrisma.dataGraphEdge.findMany.mockResolvedValue([]);

      const result = await service.computeClusters('tenant-1');

      expect(result.totalClusters).toBe(0);
      expect(result.totalNodes).toBe(0);
    });
  });

  describe('getAnalyticsResults', () => {
    it('should return paginated results', async () => {
      mockPrisma.graphAnalyticsResult.findMany.mockResolvedValue([
        { id: 'r-1', analysisType: 'centrality' },
      ]);
      mockPrisma.graphAnalyticsResult.count.mockResolvedValue(1);

      const result = await service.getAnalyticsResults('tenant-1', {
        analysisType: 'centrality',
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });
  });
});
