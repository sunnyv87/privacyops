import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { LineageFilterDto } from './dto/lineage.dto';

@Injectable()
export class LineageService {
  private readonly logger = new Logger(LineageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async recordLineage(
    tenantId: string,
    sourceAssetId: string,
    targetAssetId: string,
    transformType: string,
    dataCategories: string[],
    metadata?: Record<string, any>,
  ) {
    const record = await this.prisma.dataLineageRecord.create({
      data: {
        tenantId,
        sourceAssetId,
        targetAssetId,
        transformType,
        dataCategories,
        metadata: metadata || {},
      },
    });

    await this.events.publish({
      type: 'lineage.recorded',
      tenantId,
      data: { recordId: record.id, sourceAssetId, targetAssetId, transformType },
      timestamp: new Date(),
    });

    return record;
  }

  async getUpstream(tenantId: string, assetId: string, depth = 3) {
    const visited = new Set<string>();
    const nodes: any[] = [];
    const edges: any[] = [];

    await this.traceDirection(tenantId, assetId, 'upstream', depth, visited, nodes, edges);

    return { assetId, direction: 'upstream', depth, nodes, edges };
  }

  async getDownstream(tenantId: string, assetId: string, depth = 3) {
    const visited = new Set<string>();
    const nodes: any[] = [];
    const edges: any[] = [];

    await this.traceDirection(tenantId, assetId, 'downstream', depth, visited, nodes, edges);

    return { assetId, direction: 'downstream', depth, nodes, edges };
  }

  async getFullLineage(tenantId: string, assetId: string) {
    const [upstream, downstream] = await Promise.all([
      this.getUpstream(tenantId, assetId),
      this.getDownstream(tenantId, assetId),
    ]);

    // Merge nodes and edges, deduplicating by id
    const nodeMap = new Map<string, any>();
    const edgeMap = new Map<string, any>();

    for (const node of [...upstream.nodes, ...downstream.nodes]) {
      nodeMap.set(node.id, node);
    }
    for (const edge of [...upstream.edges, ...downstream.edges]) {
      edgeMap.set(edge.id, edge);
    }

    return {
      assetId,
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }

  async findRecords(tenantId: string, filters: LineageFilterDto = {}) {
    const { page = 1, pageSize = 20, sourceAssetId, targetAssetId, transformType } = filters;

    const where: any = {
      tenantId,
      ...(sourceAssetId && { sourceAssetId }),
      ...(targetAssetId && { targetAssetId }),
      ...(transformType && { transformType }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.dataLineageRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dataLineageRecord.count({ where }),
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

  private async traceDirection(
    tenantId: string,
    assetId: string,
    direction: 'upstream' | 'downstream',
    depth: number,
    visited: Set<string>,
    nodes: any[],
    edges: any[],
    currentDepth = 0,
  ) {
    if (currentDepth >= depth || visited.has(assetId)) return;
    visited.add(assetId);

    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      select: { id: true, name: true, type: true, path: true, dataSourceId: true },
    });

    if (asset) {
      nodes.push(asset);
    }

    const whereClause = direction === 'upstream'
      ? { tenantId, targetAssetId: assetId }
      : { tenantId, sourceAssetId: assetId };

    const records = await this.prisma.dataLineageRecord.findMany({
      where: whereClause,
    });

    for (const record of records) {
      edges.push({
        id: record.id,
        sourceAssetId: record.sourceAssetId,
        targetAssetId: record.targetAssetId,
        transformType: record.transformType,
        dataCategories: record.dataCategories,
      });

      const nextAssetId = direction === 'upstream'
        ? record.sourceAssetId
        : record.targetAssetId;

      await this.traceDirection(
        tenantId,
        nextAssetId,
        direction,
        depth,
        visited,
        nodes,
        edges,
        currentDepth + 1,
      );
    }
  }
}
