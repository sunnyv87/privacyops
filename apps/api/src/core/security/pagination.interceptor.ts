import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

const MAX_PAGE_SIZE = 100;
const PAGE_SIZE_KEYS = ['page_size', 'pageSize', 'pagesize', 'limit'];

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.query) {
      for (const key of PAGE_SIZE_KEYS) {
        if (request.query[key] !== undefined) {
          const parsed = parseInt(request.query[key], 10);
          if (!isNaN(parsed)) {
            request.query[key] = String(Math.min(Math.max(parsed, 1), MAX_PAGE_SIZE));
          }
        }
      }
    }
    return next.handle();
  }
}
