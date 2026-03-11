import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures tenant context is set on every request.
 * Works alongside the TenantGuard for additional safety.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    // Tenant ID MUST come from authenticated JWT only — never from request headers
    const tenantId = request.user?.tenantId;

    if (tenantId) {
      await this.prisma.setTenantContext(tenantId);
    }

    return next.handle();
  }
}
