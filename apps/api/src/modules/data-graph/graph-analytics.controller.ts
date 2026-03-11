import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GraphAnalyticsService } from './graph-analytics.service';
import { GraphEnrichmentService } from './graph-enrichment.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Data Graph - Analytics')
@ApiBearerAuth()
@Controller('data-graph')
export class GraphAnalyticsController {
  constructor(
    private readonly analyticsService: GraphAnalyticsService,
    private readonly enrichmentService: GraphEnrichmentService,
  ) {}

  @Post('enrich')
  @RequirePermissions('data-graph:admin')
  @ApiOperation({ summary: 'Enrich graph with risk signals, attack vectors, and controls' })
  async enrich(@CurrentUser('tenantId') tenantId: string) {
    const [riskSignals, attackVectors, controls] = await Promise.all([
      this.enrichmentService.enrichWithRiskSignals(tenantId),
      this.enrichmentService.enrichWithAttackVectors(tenantId),
      this.enrichmentService.enrichWithControls(tenantId),
    ]);

    return {
      data: {
        riskSignals,
        attackVectors,
        controls,
      },
    };
  }

  @Get('analytics/centrality')
  @RequirePermissions('data-graph:read')
  @ApiOperation({ summary: 'Compute degree centrality for all graph nodes' })
  async getCentrality(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.analyticsService.computeCentrality(tenantId);
    return { data: result };
  }

  @Get('analytics/risk-propagation/:nodeId')
  @RequirePermissions('data-graph:read')
  @ApiOperation({ summary: 'Compute risk propagation from a node' })
  async getRiskPropagation(
    @CurrentUser('tenantId') tenantId: string,
    @Param('nodeId') nodeId: string,
  ) {
    const result = await this.analyticsService.computeRiskPropagation(
      tenantId,
      nodeId,
    );
    return { data: result };
  }

  @Get('analytics/impact-radius/:nodeId')
  @RequirePermissions('data-graph:read')
  @ApiOperation({ summary: 'Compute impact radius for a node (up to 3 hops)' })
  async getImpactRadius(
    @CurrentUser('tenantId') tenantId: string,
    @Param('nodeId') nodeId: string,
  ) {
    const result = await this.analyticsService.computeImpactRadius(
      tenantId,
      nodeId,
    );
    return { data: result };
  }

  @Get('analytics/clusters')
  @RequirePermissions('data-graph:read')
  @ApiOperation({ summary: 'Compute connected component clusters in the graph' })
  async getClusters(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.analyticsService.computeClusters(tenantId);
    return { data: result };
  }

  @Post('sync')
  @RequirePermissions('data-graph:admin')
  @ApiOperation({ summary: 'Sync all entities into the data graph' })
  async syncEntities(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.enrichmentService.syncEntities(tenantId);
    return { data: result };
  }
}
