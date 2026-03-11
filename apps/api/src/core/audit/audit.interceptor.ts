import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditService, AuditSeverity, AuditCategory } from './audit.service';
import { PrismaService } from '@/core/prisma/prisma.service';

export interface AuditActionOptions {
  severity?: AuditSeverity;
  category?: AuditCategory;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  /**
   * Prisma model name for loading the "before" state on PUT/PATCH.
   * Must match a key on PrismaClient (e.g. 'user', 'vendor', 'dataAsset').
   */
  entityModel?: string;
}

export const AUDIT_ACTION_KEY = 'auditAction';
export const AUDIT_OPTIONS_KEY = 'auditOptions';

/**
 * Decorator to mark a controller method for audit logging.
 * Supports a simple string action or an action with options.
 */
export function AuditAction(action: string, options?: AuditActionOptions) {
  return (target: any, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    if (options) {
      Reflect.defineMetadata(AUDIT_OPTIONS_KEY, options, descriptor.value);
    }
    return descriptor;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const action = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) return next.handle();

    const options: AuditActionOptions =
      this.reflector.get<AuditActionOptions>(
        AUDIT_OPTIONS_KEY,
        context.getHandler(),
      ) || {};

    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // For PUT/PATCH, capture "before" state if entityModel is specified
    let beforeState: any = undefined;
    if (
      (method === 'PUT' || method === 'PATCH') &&
      options.entityModel &&
      request.params?.id
    ) {
      try {
        const model = (this.prisma as any)[options.entityModel];
        if (model?.findUnique) {
          beforeState = await model.findUnique({
            where: { id: request.params.id },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load before state for ${options.entityModel}/${request.params.id}: ${error}`,
        );
      }
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (!request.user?.tenantId) return;

        try {
          const changes: { before?: any; after?: any } = {};

          if (beforeState) {
            changes.before = beforeState;
          }

          if (options.captureRequestBody && request.body) {
            changes.after = request.body;
          } else if (options.captureResponseBody && response) {
            changes.after = response?.data || response;
          } else if (beforeState) {
            // For PUT/PATCH with before state, capture the request body as after
            changes.after = request.body;
          }

          const hasChanges =
            changes.before !== undefined || changes.after !== undefined;

          await this.auditService.log({
            tenantId: request.user.tenantId,
            actorId: request.user.id,
            actorType: request.user.actorType || 'user',
            action: `${action} [${method} ${url}]`,
            entityType: response?.entityType || request.params?.entityType || 'unknown',
            entityId:
              response?.id ||
              response?.data?.id ||
              request.params?.id ||
              'unknown',
            ...(hasChanges ? { changes } : {}),
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            severity: options.severity,
            category: options.category,
          });
        } catch (error) {
          this.logger.error(`Failed to create audit log: ${error}`);
        }
      }),
    );
  }
}
