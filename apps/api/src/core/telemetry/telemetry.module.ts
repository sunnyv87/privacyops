import { Module, Global } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { PrometheusController } from './prometheus.controller';

/**
 * Global telemetry module.
 *
 * Provides:
 * - PrometheusService  — metric registry, histograms, counters, gauges
 * - PrometheusController — GET /metrics endpoint for Prometheus scraping
 *
 * Correlation-ID middleware and StructuredLogger are registered in main.ts
 * (they must be applied before NestJS DI boots).
 */
@Global()
@Module({
  controllers: [PrometheusController],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class TelemetryModule {}
