import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RiskIntelligenceService } from './risk-intelligence.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('DSPM - Risk Intelligence')
@ApiBearerAuth()
@Controller('dspm/risk-intelligence')
export class RiskIntelligenceController {
  constructor(
    private readonly riskIntelligenceService: RiskIntelligenceService,
  ) {}

  @Get('predictions')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'List risk predictions with filters' })
  async getPredictions(
    @CurrentUser('tenantId') tenantId: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.riskIntelligenceService.getPredictions(tenantId, {
      entityType,
      entityId,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('predictions/:entityType/:entityId')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get predictions for a specific entity' })
  async getEntityPredictions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const result = await this.riskIntelligenceService.getPredictions(tenantId, {
      entityType,
      entityId,
      status: 'active',
    });
    return { data: result.data };
  }

  @Post('analyze')
  @RequirePermissions('dspm:findings:create')
  @ApiOperation({ summary: 'Generate predictions and detect anomalies' })
  async analyze(@CurrentUser('tenantId') tenantId: string) {
    const predictions = await this.riskIntelligenceService.generatePredictions(tenantId);
    const anomalies = await this.riskIntelligenceService.detectAnomalies(tenantId);
    return { data: { predictions, anomalies } };
  }

  @Get('anomalies')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'List risk anomalies with filters' })
  async getAnomalies(
    @CurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('entity_type') entityType?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.riskIntelligenceService.getAnomalies(tenantId, {
      status,
      entityType,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('trends')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Analyze risk prediction trends' })
  async getTrends(
    @CurrentUser('tenantId') tenantId: string,
    @Query('entity_type') entityType?: string,
    @Query('days') days?: number,
  ) {
    const result = await this.riskIntelligenceService.analyzeTrends(
      tenantId,
      entityType,
      days ? Number(days) : undefined,
    );
    return { data: result };
  }

  @Get('impact/:entityId')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Assess business impact of an entity' })
  async getImpact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('entityId') entityId: string,
  ) {
    const result = await this.riskIntelligenceService.assessBusinessImpact(
      tenantId,
      entityId,
    );
    return { data: result };
  }
}
