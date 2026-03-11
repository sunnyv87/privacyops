import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsCollectorService } from './metrics-collector.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsCollectorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.metrics.recordMetric(
            req?.tenantId || null,
            controller,
            'request_latency_ms',
            duration,
            { handler, method: req?.method, path: req?.path },
          ).catch(() => {});
        },
        error: () => {
          const duration = Date.now() - start;
          this.metrics.recordMetric(
            req?.tenantId || null,
            controller,
            'request_error',
            duration,
            { handler, method: req?.method, path: req?.path },
          ).catch(() => {});
        },
      }),
    );
  }
}
