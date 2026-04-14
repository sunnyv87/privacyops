import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { MetricsCollectorService } from './metrics-collector.service';
import { ConnectorHealthService } from './connector-health.service';
import { PlatformAlertService } from './platform-alert.service';

@ApiTags('Observability')
@ApiBearerAuth()
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metricsCollector: MetricsCollectorService,
    private readonly connectorHealth: ConnectorHealthService,
    private readonly platformAlert: PlatformAlertService,
  ) {}

  @Get('metrics')
  @RequirePermissions('observability:read')
  @ApiOperation({ summary: 'Query service metrics' })
  async getMetrics(
    @CurrentUser('tenantId') tenantId: string,
    @Query('service_name') serviceName?: string,
    @Query('metric_name') metricName?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.metricsCollector.getMetrics({
      serviceName,
      metricName,
      tenantId,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  @Get('connector-health')
  @RequirePermissions('observability:read')
  @ApiOperation({ summary: 'Get connector health logs' })
  async getConnectorHealth(
    @CurrentUser('tenantId') tenantId: string,
    @Query('data_source_id') dataSourceId?: string,
    @Query('health_status') healthStatus?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.connectorHealth.getHealthLogs(tenantId, {
      dataSourceId,
      healthStatus,
      page,
      pageSize,
    });
  }

  @Get('alerts')
  @RequirePermissions('observability:read')
  @ApiOperation({ summary: 'Get platform alerts' })
  async getAlerts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('alert_type') alertType?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.platformAlert.getAlerts({
      tenantId,
      alertType,
      severity,
      status,
      page,
      pageSize,
    });
  }

  @Patch('alerts/:id/acknowledge')
  @RequirePermissions('observability:admin')
  @ApiOperation({ summary: 'Acknowledge a platform alert' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const alert = await this.platformAlert.acknowledgeAlert(id, tenantId, userId);
    return { data: alert };
  }

  @Patch('alerts/:id/resolve')
  @RequirePermissions('observability:admin')
  @ApiOperation({ summary: 'Resolve a platform alert' })
  async resolveAlert(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const alert = await this.platformAlert.resolveAlert(id, tenantId);
    return { data: alert };
  }

  @Get('dashboard')
  @RequirePermissions('observability:read')
  @ApiOperation({ summary: 'Get combined observability dashboard' })
  async getDashboard(
    @CurrentUser('tenantId') tenantId: string,
    @Query('service_name') serviceName?: string,
  ) {
    const [performance, health, alertStats] = await Promise.all([
      this.metricsCollector.getPerformanceSummary(serviceName),
      this.connectorHealth.getHealthSummary(tenantId),
      this.platformAlert.getAlertStats(tenantId),
    ]);

    return {
      data: {
        performance,
        connectorHealth: health,
        alerts: alertStats,
      },
    };
  }
}
