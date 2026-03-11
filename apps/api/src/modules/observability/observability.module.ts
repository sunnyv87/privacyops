import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { MetricsCollectorService } from './metrics-collector.service';
import { ConnectorHealthService } from './connector-health.service';
import { PlatformAlertService } from './platform-alert.service';
import { MetricsInterceptor } from './metrics.interceptor';

@Module({
  controllers: [ObservabilityController],
  providers: [MetricsCollectorService, ConnectorHealthService, PlatformAlertService, MetricsInterceptor],
  exports: [MetricsCollectorService, ConnectorHealthService, PlatformAlertService, MetricsInterceptor],
})
export class ObservabilityModule {}
