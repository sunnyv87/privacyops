import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClassificationService } from './classification.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  ClassifyAssetDto,
  CreateLabelDto,
  BulkClassifyDto,
} from './dto/classification.dto';

@ApiTags('Classification')
@ApiBearerAuth()
@Controller('classification')
export class ClassificationController {
  constructor(
    private readonly classificationService: ClassificationService,
  ) {}

  @Post('classify')
  @RequirePermissions('classification:classify:execute')
  @ApiOperation({ summary: 'Classify fields of an asset using the classification engine' })
  async classifyAsset(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ClassifyAssetDto,
  ) {
    const result = await this.classificationService.classifyAsset(
      tenantId,
      userId,
      dto,
    );
    return { data: result };
  }

  @Get('results')
  @RequirePermissions('classification:results:read')
  @ApiOperation({ summary: 'List classifications with filters' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('asset_id') assetId?: string,
    @Query('label_id') labelId?: string,
    @Query('category') category?: string,
    @Query('min_confidence') minConfidence?: number,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.classificationService.findAll(tenantId, {
      assetId,
      labelId,
      category,
      minConfidence: minConfidence ? Number(minConfidence) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('assets/:assetId')
  @RequirePermissions('classification:results:read')
  @ApiOperation({ summary: 'Get all classifications for an asset' })
  async findByAsset(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    const classifications = await this.classificationService.findByAsset(
      tenantId,
      assetId,
    );
    return { data: classifications };
  }

  @Post('labels')
  @RequirePermissions('classification:labels:create')
  @ApiOperation({ summary: 'Create a custom classification label' })
  async createLabel(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const label = await this.classificationService.createLabel(
      tenantId,
      userId,
      dto,
    );
    return { data: label };
  }

  @Get('labels')
  @RequirePermissions('classification:labels:read')
  @ApiOperation({ summary: 'List all classification labels' })
  async findAllLabels(@CurrentUser('tenantId') tenantId: string) {
    const labels = await this.classificationService.findAllLabels(tenantId);
    return { data: labels };
  }

  @Get('stats')
  @RequirePermissions('classification:stats:read')
  @ApiOperation({ summary: 'Get classification statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.classificationService.getStats(tenantId);
    return { data: stats };
  }

  @Post('bulk-classify')
  @RequirePermissions('classification:classify:execute')
  @ApiOperation({ summary: 'Classify multiple assets in bulk' })
  async bulkClassify(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkClassifyDto,
  ) {
    const result = await this.classificationService.bulkClassify(
      tenantId,
      dto.assetIds,
      userId,
    );
    return { data: result };
  }

  @Get('coverage')
  @RequirePermissions('classification:stats:read')
  @ApiOperation({ summary: 'Get classification coverage across all assets' })
  async getClassificationCoverage(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const coverage = await this.classificationService.getClassificationCoverage(tenantId);
    return { data: coverage };
  }

  @Get('toxic-combinations')
  @RequirePermissions('classification:results:read')
  @ApiOperation({ summary: 'Detect toxic data combinations across assets' })
  async getToxicCombinations(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const results = await this.classificationService.getToxicCombinations(tenantId);
    return { data: results };
  }
}
