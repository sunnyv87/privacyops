import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataGraphService } from './data-graph.service';
import { DataGraphSyncService } from './data-graph-sync.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Data Graph')
@ApiBearerAuth()
@Controller('data-graph')
export class DataGraphController {
  constructor(
    private readonly graphService: DataGraphService,
    private readonly syncService: DataGraphSyncService,
  ) {}

  @Get('nodes')
  @RequirePermissions('dspm:data-graph:read')
  @ApiOperation({ summary: 'Find graph nodes with optional filters' })
  async findNodes(
    @CurrentUser('tenantId') tenantId: string,
    @Query('node_type') nodeType?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.graphService.findNodes(tenantId, {
      nodeType,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('nodes/:id')
  @RequirePermissions('dspm:data-graph:read')
  @ApiOperation({ summary: 'Get a graph node by ID with connected edges' })
  async getNodeById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const node = await this.graphService.getNodeById(tenantId, id);
    return { data: node };
  }

  @Get('nodes/:id/neighbors')
  @RequirePermissions('dspm:data-graph:read')
  @ApiOperation({ summary: 'Get neighboring nodes (1 hop)' })
  async getNeighbors(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') nodeId: string,
    @Query('depth') depth?: number,
  ) {
    const result = await this.graphService.getNeighbors(
      tenantId,
      nodeId,
      depth ? Number(depth) : 1,
    );
    return { data: result };
  }

  @Get('paths')
  @RequirePermissions('dspm:data-graph:read')
  @ApiOperation({ summary: 'Find paths between two graph nodes (BFS)' })
  async findPaths(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('max_depth') maxDepth?: number,
  ) {
    const result = await this.graphService.findPaths(
      tenantId,
      from,
      to,
      maxDepth ? Number(maxDepth) : 5,
    );
    return { data: result };
  }

  @Get('subgraph')
  @RequirePermissions('dspm:data-graph:read')
  @ApiOperation({ summary: 'Get subgraph around an entity (up to 3 hops)' })
  async getSubgraph(
    @CurrentUser('tenantId') tenantId: string,
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
  ) {
    const result = await this.graphService.getSubgraph(
      tenantId,
      entityType,
      entityId,
    );
    return { data: result };
  }

  @Post('sync')
  @RequirePermissions('dspm:data-graph:admin')
  @ApiOperation({ summary: 'Sync all entities into the data graph' })
  async syncAll(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.syncService.syncAll(tenantId);
    return { data: result };
  }
}
