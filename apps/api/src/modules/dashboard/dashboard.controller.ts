import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions('dashboard:stats:read')
  @ApiOperation({ summary: 'Get KPI stats for the privacy dashboard' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.dashboardService.getStats(tenantId);
    return { data: stats };
  }

  @Get('risk-distribution')
  @RequirePermissions('dashboard:risk:read')
  @ApiOperation({ summary: 'Get risk findings distribution by severity' })
  async getRiskDistribution(@CurrentUser('tenantId') tenantId: string) {
    const distribution = await this.dashboardService.getRiskDistribution(tenantId);
    return { data: distribution };
  }

  @Get('top-risky-assets')
  @RequirePermissions('dashboard:risk:read')
  @ApiOperation({ summary: 'Get top N risky assets' })
  async getTopRiskyAssets(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const assets = await this.dashboardService.getTopRiskyAssets(
      tenantId,
      limit ? Number(limit) : undefined,
    );
    return { data: assets };
  }

  @Get('recent-activity')
  @RequirePermissions('dashboard:activity:read')
  @ApiOperation({ summary: 'Get recent audit log activity' })
  async getRecentActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const activity = await this.dashboardService.getRecentActivity(
      tenantId,
      limit ? Number(limit) : undefined,
    );
    return { data: activity };
  }

  @Get('compliance-overview')
  @RequirePermissions('dashboard:compliance:read')
  @ApiOperation({ summary: 'Get compliance scores by regulation' })
  async getComplianceOverview(@CurrentUser('tenantId') tenantId: string) {
    const overview = await this.dashboardService.getComplianceOverview(tenantId);
    return { data: overview };
  }
}
