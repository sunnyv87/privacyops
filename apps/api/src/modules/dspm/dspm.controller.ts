import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DspmService } from './dspm.service';
import { NarrativeService } from '@/modules/co-pilot/narrative.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { FindingFilterDto, UpdateFindingStatusDto } from './dto/dspm.dto';

@ApiTags('DSPM')
@ApiBearerAuth()
@Controller('dspm')
export class DspmController {
  constructor(
    private readonly dspmService: DspmService,
    private readonly narrative: NarrativeService,
  ) {}

  @Get('findings')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'List risk findings with filters' })
  async findAllFindings(
    @CurrentUser('tenantId') tenantId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('asset_id') assetId?: string,
    @Query('data_source_id') dataSourceId?: string,
    @Query('min_score') minScore?: number,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dspmService.findAllFindings(tenantId, {
      severity,
      status,
      assetId,
      dataSourceId,
      minScore: minScore ? Number(minScore) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('findings/:id')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get risk finding details' })
  async findFindingById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('withNarrative') withNarrative?: string,
  ) {
    const finding = await this.dspmService.findFindingById(tenantId, id);
    // Opt-in narrative enrichment — default response shape unchanged.
    if (withNarrative === 'true' && finding) {
      const narrative = await this.narrative.explainRisk(finding as any);
      return { data: { ...(finding as any), narrative } };
    }
    return { data: finding };
  }

  @Patch('findings/:id/status')
  @RequirePermissions('dspm:findings:update')
  @ApiOperation({ summary: 'Update risk finding status' })
  async updateFindingStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFindingStatusDto,
  ) {
    const finding = await this.dspmService.updateFindingStatus(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: finding };
  }

  @Post('findings/:assetId/recalculate')
  @RequirePermissions('dspm:findings:create')
  @ApiOperation({ summary: 'Recalculate risk score for an asset' })
  async recalculateRisk(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    const result = await this.dspmService.recalculateRisk(tenantId, assetId);
    return { data: result };
  }

  @Get('risk-profiles')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'List entity risk profiles with filters' })
  async getRiskProfiles(
    @CurrentUser('tenantId') tenantId: string,
    @Query('entity_type') entityType?: string,
    @Query('min_score') minScore?: number,
    @Query('trend') trend?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dspmService.getRiskProfiles(tenantId, {
      entityType,
      minScore: minScore ? Number(minScore) : undefined,
      trend,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('risk-trends')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get risk score trends over time' })
  async getRiskTrends(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days') days?: number,
  ) {
    const result = await this.dspmService.getRiskTrends(
      tenantId,
      days ? Number(days) : undefined,
    );
    return { data: result };
  }

  @Post('risk/recalculate-all')
  @RequirePermissions('dspm:findings:create')
  @ApiOperation({ summary: 'Recalculate risk scores for all assets' })
  async recalculateAllRisks(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.dspmService.recalculateAllRisks(tenantId);
    return { data: result };
  }

  @Get('data-map')
  @RequirePermissions('dspm:data-map:read')
  @ApiOperation({ summary: 'Get data map visualization data' })
  async getDataMap(@CurrentUser('tenantId') tenantId: string) {
    const dataMap = await this.dspmService.getDataMap(tenantId);
    return { data: dataMap };
  }

  @Get('stats')
  @RequirePermissions('dspm:stats:read')
  @ApiOperation({ summary: 'Get DSPM statistics and severity distribution' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.dspmService.getStats(tenantId);
    return { data: stats };
  }
}
