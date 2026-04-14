import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { OptimizationAnalyzer } from './optimization-analyzer.service';

@ApiTags('Platform Optimization')
@ApiBearerAuth()
@Controller('platform-optimization')
export class PlatformOptimizationController {
  constructor(private readonly analyzer: OptimizationAnalyzer) {}

  @Post('analyze')
  @RequirePermissions('platform:admin')
  @ApiOperation({ summary: 'Run performance analysis and generate recommendations' })
  async analyze(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const result = await this.analyzer.analyzePerformance(tenantId);
    return { data: result };
  }

  @Get('recommendations')
  @RequirePermissions('platform:read')
  @ApiOperation({ summary: 'Get optimization recommendations' })
  async getRecommendations(
    @CurrentUser('tenantId') tenantId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.analyzer.getRecommendations({
      tenantId,
      category,
      status,
      priority,
      page,
      pageSize,
    });
  }

  @Post('recommendations/:id/apply')
  @RequirePermissions('platform:admin')
  @ApiOperation({ summary: 'Apply an optimization recommendation' })
  async applyRecommendation(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.analyzer.applyRecommendation(id, tenantId, userId);
    return { data: result };
  }

  @Post('recommendations/:id/revert')
  @RequirePermissions('platform:admin')
  @ApiOperation({ summary: 'Revert an optimization recommendation' })
  async revertRecommendation(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const result = await this.analyzer.revertRecommendation(id, tenantId);
    return { data: result };
  }

  @Get('baselines')
  @RequirePermissions('platform:read')
  @ApiOperation({ summary: 'Get performance baselines' })
  async getBaselines() {
    const baselines = await this.analyzer.getBaselines();
    return { data: baselines };
  }

  @Get('health-report')
  @RequirePermissions('platform:read')
  @ApiOperation({ summary: 'Get platform health report' })
  async getHealthReport(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const report = await this.analyzer.getHealthReport(tenantId);
    return { data: report };
  }
}
