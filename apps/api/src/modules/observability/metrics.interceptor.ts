import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsCollectorService } from './metrics-collector.service';
import { PrometheusService } from '@/core/telemetry/prometheus.service';
import { MeteringService } from '@/core/metering/metering.service';

// Only meter write methods as "api_call" — metering every GET would create
// a usage_events row per read, which is prohibitively expensive at scale
// and doesn't reflect the quota model (writes cost money, reads are cheap).
const METERED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsCollectorService,
    private readonly prometheus: PrometheusService,
    private readonly metering: MeteringService,
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

          // SaaS usage metering: record one `api_call` per write request.
          // The call is fire-and-forget so it adds no latency to the
          // response. Reads are not metered — billing doesn't care about
          // them and they would overwhelm the event bus.
          const tenantId: string | undefined = req?.user?.tenantId;
          if (tenantId && METERED_METHODS.has(method)) {
            this.metering.record(tenantId, 'api_call', 1, {
              source: `${controller}.${handler}`,
              metadata: { method, route },
            });
          }
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
