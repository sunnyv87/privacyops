import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Global interceptor that enforces a request-level timeout.
 * Prevents long-running handlers from tying up connections indefinitely.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          const req = context.switchToHttp().getRequest();
          this.logger.warn(
            `Request timeout: ${req?.method} ${req?.url} exceeded ${DEFAULT_TIMEOUT_MS}ms`,
          );
          return throwError(() => new RequestTimeoutException('Request timeout'));
        }
        return throwError(() => err);
      }),
    );
  }
}
