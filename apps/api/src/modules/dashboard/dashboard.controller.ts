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

  @Get('summary')
  @RequirePermissions('dashboard:summary:read')
  @ApiOperation({ summary: 'Get privacy dashboard summary' })
  async getSummary(@CurrentUser('tenantId') tenantId: string) {
    const summary = await this.dashboardService.getSummary(tenantId);
    return { data: summary };
  }

  @Get('metrics')
  @RequirePermissions('dashboard:metrics:read')
  @ApiOperation({ summary: 'Get privacy compliance metrics' })
  async getMetrics(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
  ) {
    const metrics = await this.dashboardService.getMetrics(tenantId, period);
    return { data: metrics };
  }

  @Get('alerts')
  @RequirePermissions('dashboard:alerts:read')
  @ApiOperation({ summary: 'Get active privacy alerts' })
  async getAlerts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dashboardService.getAlerts(tenantId, { page, pageSize });
  }

  @Get('activity')
  @RequirePermissions('dashboard:activity:read')
  @ApiOperation({ summary: 'Get recent activity feed' })
  async getActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dashboardService.getActivity(tenantId, { page, pageSize });
  }
}
