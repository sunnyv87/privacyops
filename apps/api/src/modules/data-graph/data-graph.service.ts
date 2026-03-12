import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class DataGraphService {
  private readonly logger = new Logger(DataGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNode(
    tenantId: string,
    nodeType: string,
    entityId: string,
    label: string,
    metadata?: Record<string, unknown>,
  ) {
    const node = await this.prisma.dataGraphNode.upsert({
      where: {
        tenantId_nodeType_entityId: { tenantId, nodeType, entityId },
      },
      create: {
        tenantId,
        nodeType,
        entityId,
        label,
        metadata: metadata || {},
      },
      update: {
        label,
        metadata: metadata || {},
      },
    });

    this.logger.log(`Graph node upserted: ${node.id} (${nodeType}:${entityId})`);
    return node;
  }

  async createEdge(
    tenantId: string,
    sourceNodeId: string,
    targetNodeId: string,
    relationshipType: string,
    metadata?: Record<string, unknown>,
    confidence?: number,
  ) {
    const edge = await this.prisma.dataGraphEdge.create({
      data: {
        tenantId,
        sourceNodeId,
        targetNodeId,
        relationshipType,
        metadata: metadata || {},
        confidence: confidence ?? null,
      },
    });

    this.logger.log(
      `Graph edge created: ${edge.id} (${sourceNodeId} -[${relationshipType}]-> ${targetNodeId})`,
    );
    return edge;
  }

  async getNodeById(tenantId: string, id: string) {
    const node = await this.prisma.dataGraphNode.findFirst({
      where: { id, tenantId },
      include: {
        outgoingEdges: {
          include: { targetNode: true },
        },
        incomingEdges: {
          include: { sourceNode: true },
        },
      },
    });

    if (!node) throw new NotFoundException(`Graph node ${id} not found`);
    return node;
  }

  async findNodes(
    tenantId: string,
    filters: { nodeType?: string; search?: string; page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, nodeType, search } = filters;
    const where: any = { tenantId };
    if (nodeType) where.nodeType = nodeType;
    if (search) where.label = { contains: search, mode: 'insensitive' };

    const [data, totalItems] = await Promise.all([
      this.prisma.dataGraphNode.findMany({
        where,
        include: {
          _count: { select: { outgoingEdges: true, incomingEdges: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataGraphNode.count({ where }),
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

  async getNeighbors(tenantId: string, nodeId: string, depth = 1) {
    // Verify node exists
    const node = await this.prisma.dataGraphNode.findFirst({
      where: { id: nodeId, tenantId },
    });
    if (!node) throw new NotFoundException(`Graph node ${nodeId} not found`);

    // Get 1-hop neighbors via outgoing and incoming edges
    const [outgoing, incoming] = await Promise.all([
      this.prisma.dataGraphEdge.findMany({
        where: { tenantId, sourceNodeId: nodeId },
        include: { targetNode: true },
      }),
      this.prisma.dataGraphEdge.findMany({
        where: { tenantId, targetNodeId: nodeId },
        include: { sourceNode: true },
      }),
    ]);

    const neighbors = [
      ...outgoing.map((e) => ({
        node: e.targetNode,
        edge: {
          id: e.id,
          relationshipType: e.relationshipType,
          direction: 'outgoing' as const,
          confidence: e.confidence,
        },
      })),
      ...incoming.map((e) => ({
        node: e.sourceNode,
        edge: {
          id: e.id,
          relationshipType: e.relationshipType,
          direction: 'incoming' as const,
          confidence: e.confidence,
        },
      })),
    ];

    return { node, neighbors };
  }

  async findPaths(
    tenantId: string,
    fromNodeId: string,
    toNodeId: string,
    maxDepth = 5,
  ) {
    // Verify both nodes exist
    const [fromNode, toNode] = await Promise.all([
      this.prisma.dataGraphNode.findFirst({ where: { id: fromNodeId, tenantId } }),
      this.prisma.dataGraphNode.findFirst({ where: { id: toNodeId, tenantId } }),
    ]);
    if (!fromNode) throw new NotFoundException(`Source node ${fromNodeId} not found`);
    if (!toNode) throw new NotFoundException(`Target node ${toNodeId} not found`);

    // Preload all edges for the tenant into an in-memory adjacency list.
    // This replaces the N+1 per-node query pattern with 1 bulk query.
    const allEdges = await this.prisma.dataGraphEdge.findMany({
      where: { tenantId },
      select: { id: true, sourceNodeId: true, targetNodeId: true, relationshipType: true },
    });

    const adjacency = new Map<string, { nodeId: string; edgeId: string; relationshipType: string }[]>();
    for (const edge of allEdges) {
      // Bidirectional: add to both source and target
      if (!adjacency.has(edge.sourceNodeId)) adjacency.set(edge.sourceNodeId, []);
      adjacency.get(edge.sourceNodeId)!.push({
        nodeId: edge.targetNodeId,
        edgeId: edge.id,
        relationshipType: edge.relationshipType,
      });
      if (!adjacency.has(edge.targetNodeId)) adjacency.set(edge.targetNodeId, []);
      adjacency.get(edge.targetNodeId)!.push({
        nodeId: edge.sourceNodeId,
        edgeId: edge.id,
        relationshipType: edge.relationshipType,
      });
    }

    // BFS path finding on in-memory adjacency list
    const visited = new Set<string>();
    const queue: { nodeId: string; path: { nodeId: string; edgeId: string; relationshipType: string }[] }[] = [
      { nodeId: fromNodeId, path: [] },
    ];
    visited.add(fromNodeId);

    const paths: { nodeId: string; edgeId: string; relationshipType: string }[][] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.path.length >= maxDepth) continue;

      const neighbors = adjacency.get(current.nodeId) ?? [];

      for (const neighbor of neighbors) {
        const newPath = [...current.path, neighbor];

        if (neighbor.nodeId === toNodeId) {
          paths.push(newPath);
          continue;
        }

        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          queue.push({ nodeId: neighbor.nodeId, path: newPath });
        }
      }
    }

    return { from: fromNode, to: toNode, paths };
  }

  async getSubgraph(tenantId: string, entityType: string, entityId: string) {
    // Find the root node
    const rootNode = await this.prisma.dataGraphNode.findFirst({
      where: { tenantId, nodeType: entityType, entityId },
    });
    if (!rootNode) {
      throw new NotFoundException(
        `Graph node for ${entityType}:${entityId} not found`,
      );
    }

    // BFS up to 3 hops
    const maxHops = 3;
    const visitedNodeIds = new Set<string>([rootNode.id]);
    const allNodes: any[] = [rootNode];
    const allEdges: any[] = [];
    let frontier = [rootNode.id];

    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const edges = await this.prisma.dataGraphEdge.findMany({
        where: {
          tenantId,
          OR: [
            { sourceNodeId: { in: frontier } },
            { targetNodeId: { in: frontier } },
          ],
        },
        include: { sourceNode: true, targetNode: true },
      });

      const nextFrontier: string[] = [];

      for (const edge of edges) {
        allEdges.push(edge);

        for (const neighborNode of [edge.sourceNode, edge.targetNode]) {
          if (!visitedNodeIds.has(neighborNode.id)) {
            visitedNodeIds.add(neighborNode.id);
            allNodes.push(neighborNode);
            nextFrontier.push(neighborNode.id);
          }
        }
      }

      frontier = nextFrontier;
    }

    return {
      rootNode,
      nodes: allNodes,
      edges: allEdges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        relationshipType: e.relationshipType,
        confidence: e.confidence,
      })),
    };
  }

  async deleteNode(tenantId: string, nodeId: string) {
    const node = await this.prisma.dataGraphNode.findFirst({
      where: { id: nodeId, tenantId },
    });
    if (!node) throw new NotFoundException(`Graph node ${nodeId} not found`);

    // Delete edges first, then node
    await this.prisma.dataGraphEdge.deleteMany({
      where: {
        tenantId,
        OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
      },
    });

    await this.prisma.dataGraphNode.delete({
      where: { id: nodeId },
    });

    this.logger.log(`Graph node ${nodeId} and associated edges deleted`);

    return { deleted: true, nodeId };
  }
}
