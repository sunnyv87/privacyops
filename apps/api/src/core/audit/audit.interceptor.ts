import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditAction = (action: string) =>
  Reflect.metadata(AUDIT_ACTION_KEY, action);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async (response) => {
        if (!request.user?.tenantId) return;

        await this.auditService.log({
          tenantId: request.user.tenantId,
          actorId: request.user.id,
          actorType: 'user',
          action,
          entityType: response?.entityType || 'unknown',
          entityId: response?.id || response?.data?.id || 'unknown',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }
}
