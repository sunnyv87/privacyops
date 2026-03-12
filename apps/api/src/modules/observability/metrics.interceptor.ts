import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsCollectorService } from './metrics-collector.service';
import { PrometheusService } from '@/core/telemetry/prometheus.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsCollectorService,
    private readonly prometheus: PrometheusService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const method = req?.method ?? 'UNKNOWN';
    const route = req?.route?.path ?? req?.path ?? '/';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = String(res?.statusCode ?? 200);

          // Prometheus metrics
          this.prometheus.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration / 1000,
          );
          this.prometheus.httpRequestsTotal.inc({ method, route, status_code: statusCode });

          // DB-backed metrics (existing — kept for backward compat)
          this.metrics.recordMetric(
            req?.tenantId || null,
            controller,
            'request_latency_ms',
            duration,
            { handler, method, path: req?.path },
          ).catch(() => {});
        },
        error: () => {
          const duration = Date.now() - start;
          const statusCode = String(res?.statusCode ?? 500);

          // Prometheus metrics
          this.prometheus.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration / 1000,
          );
          this.prometheus.httpRequestsTotal.inc({ method, route, status_code: statusCode });
          this.prometheus.httpErrorsTotal.inc({ method, route });

          // DB-backed metrics
          this.metrics.recordMetric(
            req?.tenantId || null,
            controller,
            'request_error',
            duration,
            { handler, method, path: req?.path },
          ).catch(() => {});
        },
      }),
    );
  }
}
