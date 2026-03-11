import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LineageService } from './lineage.service';
import { BreachImpactAnalyzer } from './breach-impact-analyzer';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { RecordLineageDto } from './dto/lineage.dto';

@ApiTags('Data Lineage')
@ApiBearerAuth()
@Controller('lineage')
export class LineageController {
  constructor(
    private readonly lineageService: LineageService,
    private readonly breachImpactAnalyzer: BreachImpactAnalyzer,
  ) {}

  @Get('asset/:assetId/upstream')
  @RequirePermissions('dspm:lineage:read')
  @ApiOperation({ summary: 'Get upstream lineage for an asset' })
  async getUpstream(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Query('depth') depth?: number,
  ) {
    const result = await this.lineageService.getUpstream(
      tenantId,
      assetId,
      depth ? Number(depth) : undefined,
    );
    return { data: result };
  }

  @Get('asset/:assetId/downstream')
  @RequirePermissions('dspm:lineage:read')
  @ApiOperation({ summary: 'Get downstream lineage for an asset' })
  async getDownstream(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Query('depth') depth?: number,
  ) {
    const result = await this.lineageService.getDownstream(
      tenantId,
      assetId,
      depth ? Number(depth) : undefined,
    );
    return { data: result };
  }

  @Get('asset/:assetId/full')
  @RequirePermissions('dspm:lineage:read')
  @ApiOperation({ summary: 'Get full lineage graph for an asset' })
  async getFullLineage(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    const result = await this.lineageService.getFullLineage(tenantId, assetId);
    return { data: result };
  }

  @Get('breach-impact/:assetId')
  @RequirePermissions('dspm:lineage:read')
  @ApiOperation({ summary: 'Analyze breach impact from a compromised asset' })
  async analyzeBreachImpact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    const result = await this.breachImpactAnalyzer.analyzeImpact(tenantId, assetId);
    return { data: result };
  }

  @Post('record')
  @RequirePermissions('dspm:lineage:create')
  @ApiOperation({ summary: 'Record a data lineage relationship' })
  async recordLineage(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: RecordLineageDto,
  ) {
    const record = await this.lineageService.recordLineage(
      tenantId,
      dto.sourceAssetId,
      dto.targetAssetId,
      dto.transformType,
      dto.dataCategories,
      dto.metadata,
    );
    return { data: record };
  }
}
