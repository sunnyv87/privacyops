import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class GraphAnalyticsService {
  private readonly logger = new Logger(GraphAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async computeCentrality(tenantId: string) {
    this.logger.log(`Computing centrality for tenant ${tenantId}`);

    const nodes = await this.prisma.dataGraphNode.findMany({
      where: { tenantId },
      select: { id: true, nodeType: true, label: true },
    });

    const edges = await this.prisma.dataGraphEdge.findMany({
      where: { tenantId },
      select: { sourceNodeId: true, targetNodeId: true },
    });

    const totalNodes = nodes.length;
    if (totalNodes === 0) {
      return { nodes: [], nodeCount: 0, edgeCount: 0 };
    }

    // Calculate degree centrality for each node (in+out edges / total nodes)
    const degreeMap = new Map<string, { inDegree: number; outDegree: number }>();
    for (const node of nodes) {
      degreeMap.set(node.id, { inDegree: 0, outDegree: 0 });
    }

    for (const edge of edges) {
      const source = degreeMap.get(edge.sourceNodeId);
      if (source) source.outDegree++;
      const target = degreeMap.get(edge.targetNodeId);
      if (target) target.inDegree++;
    }

    const centralityResults = nodes.map((node) => {
      const degree = degreeMap.get(node.id)!;
      const totalDegree = degree.inDegree + degree.outDegree;
      const centrality = totalNodes > 1 ? totalDegree / (totalNodes - 1) : 0;
      return {
        nodeId: node.id,
        nodeType: node.nodeType,
        label: node.label,
        inDegree: degree.inDegree,
        outDegree: degree.outDegree,
        totalDegree,
        centrality: Number(centrality.toFixed(4)),
      };
    });

    // Sort by centrality descending
    centralityResults.sort((a, b) => b.centrality - a.centrality);

    // Store result
    await this.prisma.graphAnalyticsResult.create({
      data: {
        tenantId,
        analysisType: 'centrality',
        parameters: {},
        results: centralityResults,
        nodeCount: totalNodes,
        edgeCount: edges.length,
      },
    });

    return {
      data: centralityResults,
      nodeCount: totalNodes,
      edgeCount: edges.length,
    };
  }

  async computeRiskPropagation(tenantId: string, nodeId: string) {
    this.logger.log(
      `Computing risk propagation from node ${nodeId} for tenant ${tenantId}`,
    );

    const startNode = await this.prisma.dataGraphNode.findFirst({
      where: { id: nodeId, tenantId },
    });

    if (!startNode) {
      throw new NotFoundException(`Graph node ${nodeId} not found`);
    }

    // Preload all nodes, edges, and risk profiles for the tenant in 3 queries
    // instead of N queries per BFS iteration.
    const [allNodes, allEdges, allRiskProfiles] = await Promise.all([
      this.prisma.dataGraphNode.findMany({
        where: { tenantId },
        select: { id: true, entityId: true, nodeType: true, label: true },
      }),
      this.prisma.dataGraphEdge.findMany({
        where: { tenantId },
        select: { sourceNodeId: true, targetNodeId: true },
      }),
      this.prisma.entityRiskProfile.findMany({
        where: { tenantId },
        select: { entityId: true, compositeScore: true },
      }),
    ]);

    // Build lookup maps
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const riskMap = new Map(allRiskProfiles.map((r) => [r.entityId, Number(r.compositeScore)]));
    const adjacency = new Map<string, string[]>();
    for (const edge of allEdges) {
      if (!adjacency.has(edge.sourceNodeId)) adjacency.set(edge.sourceNodeId, []);
      adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }

    // BFS from node following edges, collect risk scores
    const visited = new Set<string>([nodeId]);
    const queue: { nodeId: string; depth: number; path: string[] }[] = [
      { nodeId, depth: 0, path: [nodeId] },
    ];

    const propagationPath: {
      nodeId: string;
      nodeType: string;
      label: string;
      depth: number;
      riskScore: number | null;
      cumulativeRisk: number;
      path: string[];
    }[] = [];

    let cumulativeRisk = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = nodeMap.get(current.nodeId);
      if (!node) continue;

      const riskScore = riskMap.get(node.entityId) ?? null;

      if (riskScore !== null) {
        const attenuatedRisk = riskScore * Math.pow(0.7, current.depth);
        cumulativeRisk += attenuatedRisk;
      }

      propagationPath.push({
        nodeId: node.id,
        nodeType: node.nodeType,
        label: node.label,
        depth: current.depth,
        riskScore,
        cumulativeRisk: Number(cumulativeRisk.toFixed(2)),
        path: current.path,
      });

      const neighbors = adjacency.get(current.nodeId) ?? [];
      for (const targetId of neighbors) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push({
            nodeId: targetId,
            depth: current.depth + 1,
            path: [...current.path, targetId],
          });
        }
      }
    }

    return {
      startNode: {
        id: startNode.id,
        nodeType: startNode.nodeType,
        label: startNode.label,
      },
      propagationPath,
      totalCumulativeRisk: Number(cumulativeRisk.toFixed(2)),
      nodesAnalyzed: propagationPath.length,
    };
  }

  async computeImpactRadius(tenantId: string, nodeId: string) {
    this.logger.log(
      `Computing impact radius for node ${nodeId} in tenant ${tenantId}`,
    );

    const startNode = await this.prisma.dataGraphNode.findFirst({
      where: { id: nodeId, tenantId },
    });

    if (!startNode) {
      throw new NotFoundException(`Graph node ${nodeId} not found`);
    }

    // BFS with depth limit 3
    const maxDepth = 3;
    const visited = new Set<string>([nodeId]);
    const queue: { nodeId: string; depth: number }[] = [
      { nodeId, depth: 0 },
    ];

    const affectedByType: Record<string, number> = {};
    const affectedNodes: {
      nodeId: string;
      nodeType: string;
      label: string;
      depth: number;
    }[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > 0) {
        const node = await this.prisma.dataGraphNode.findFirst({
          where: { id: current.nodeId, tenantId },
        });

        if (node) {
          affectedByType[node.nodeType] =
            (affectedByType[node.nodeType] || 0) + 1;
          affectedNodes.push({
            nodeId: node.id,
            nodeType: node.nodeType,
            label: node.label,
            depth: current.depth,
          });
        }
      }

      if (current.depth >= maxDepth) continue;

      const edges = await this.prisma.dataGraphEdge.findMany({
        where: {
          tenantId,
          OR: [
            { sourceNodeId: current.nodeId },
            { targetNodeId: current.nodeId },
          ],
        },
      });

      for (const edge of edges) {
        const nextNodeId =
          edge.sourceNodeId === current.nodeId
            ? edge.targetNodeId
            : edge.sourceNodeId;

        if (!visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
        }
      }
    }

    // Store result
    await this.prisma.graphAnalyticsResult.create({
      data: {
        tenantId,
        analysisType: 'impact_radius',
        parameters: { nodeId, maxDepth },
        results: { affectedByType, affectedNodes },
        nodeCount: affectedNodes.length,
        edgeCount: 0,
      },
    });

    return {
      startNode: {
        id: startNode.id,
        nodeType: startNode.nodeType,
        label: startNode.label,
      },
      maxDepth,
      totalAffected: affectedNodes.length,
      affectedByType,
      affectedNodes,
    };
  }

  async computeClusters(tenantId: string) {
    this.logger.log(`Computing clusters for tenant ${tenantId}`);

    const nodes = await this.prisma.dataGraphNode.findMany({
      where: { tenantId },
      select: { id: true, nodeType: true, label: true },
    });

    const edges = await this.prisma.dataGraphEdge.findMany({
      where: { tenantId },
      select: { sourceNodeId: true, targetNodeId: true },
    });

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) {
      adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
      adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }

    // Simple connected components via BFS
    const visited = new Set<string>();
    const clusters: {
      clusterId: number;
      nodes: { nodeId: string; nodeType: string; label: string }[];
      size: number;
    }[] = [];
    let clusterId = 0;

    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      clusterId++;
      const clusterNodes: { nodeId: string; nodeType: string; label: string }[] = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentNode = nodes.find((n) => n.id === currentId);
        if (currentNode) {
          clusterNodes.push({
            nodeId: currentNode.id,
            nodeType: currentNode.nodeType,
            label: currentNode.label,
          });
        }

        const neighbors = adjacency.get(currentId) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      clusters.push({
        clusterId,
        nodes: clusterNodes,
        size: clusterNodes.length,
      });
    }

    // Sort clusters by size descending
    clusters.sort((a, b) => b.size - a.size);

    return {
      data: clusters,
      totalClusters: clusters.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    };
  }

  async getAnalyticsResults(
    tenantId: string,
    filters: {
      analysisType?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, analysisType } = filters;

    const where: any = {
      tenantId,
      ...(analysisType && { analysisType }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.graphAnalyticsResult.findMany({
        where,
        orderBy: { computedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.graphAnalyticsResult.count({ where }),
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
}
