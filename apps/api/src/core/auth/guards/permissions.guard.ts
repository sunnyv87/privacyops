import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Scope restricts what subset of resources a user-role assignment applies to.
 * Stored in UserRole.scope JSON field.
 */
export interface RoleScope {
  departments?: string[];
  dataSourceIds?: string[];
  classifications?: string[];
}

/**
 * Resource context that can be attached to a request for scope checking.
 * Controllers or earlier middleware can set `request.resourceContext`.
 */
export interface ResourceContext {
  department?: string;
  dataSourceId?: string;
  classification?: string;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No specific permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.permissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Check permission strings — support wildcard matching (e.g. 'dspm:*')
    const hasPermission = requiredPermissions.every((required) =>
      this.matchesPermission(user.permissions, required),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Scope evaluation — if user has scope restrictions, enforce them
    if (user.scope) {
      const scopeAllowed = this.evaluateScope(user.scope, request);
      if (!scopeAllowed) {
        this.logger.debug(
          `Scope restriction denied access for user=${user.id}, scope=${JSON.stringify(user.scope)}`,
        );
        throw new ForbiddenException(
          'Access denied: resource is outside your assigned scope',
        );
      }
    }

    return true;
  }

  /**
   * Check if the user's permission array satisfies a required permission.
   * Supports wildcard permissions:
   *   - 'dspm:*' matches 'dspm:read', 'dspm:write', etc.
   *   - '*' matches everything
   *   - Exact match: 'classification:read' matches 'classification:read'
   */
  private matchesPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    for (const perm of userPermissions) {
      // Exact match
      if (perm === required) return true;

      // Superadmin wildcard
      if (perm === '*') return true;

      // Namespace wildcard (e.g. 'dspm:*' matches 'dspm:read')
      if (perm.endsWith(':*')) {
        const namespace = perm.slice(0, -1); // 'dspm:'
        if (required.startsWith(namespace)) return true;
      }
    }
    return false;
  }

  /**
   * Evaluate scope restrictions against the current request's resource context.
   *
   * The resource context can come from:
   * 1. `request.resourceContext` — set by middleware or earlier guards
   * 2. `request.abacResource` — set by AbacGuard after loading the entity
   * 3. `request.body` — for create operations
   * 4. `request.query` — for list/filter operations
   *
   * If no resource context is available, scope is not enforced (backward compatible).
   */
  private evaluateScope(scope: RoleScope, request: any): boolean {
    const resourceCtx = this.extractResourceContext(request);

    // If no resource context is determinable, allow (backward compatible)
    if (!resourceCtx) return true;

    // Check department scope
    if (scope.departments && scope.departments.length > 0 && resourceCtx.department) {
      if (!scope.departments.includes(resourceCtx.department)) {
        return false;
      }
    }

    // Check data source scope
    if (scope.dataSourceIds && scope.dataSourceIds.length > 0 && resourceCtx.dataSourceId) {
      if (!scope.dataSourceIds.includes(resourceCtx.dataSourceId)) {
        return false;
      }
    }

    // Check classification scope
    if (scope.classifications && scope.classifications.length > 0 && resourceCtx.classification) {
      if (!scope.classifications.includes(resourceCtx.classification)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract resource context from various request sources.
   */
  private extractResourceContext(request: any): ResourceContext | null {
    // Explicit resource context set by middleware or ABAC guard
    if (request.resourceContext) {
      return request.resourceContext;
    }

    // From ABAC-loaded resource
    if (request.abacResource) {
      const r = request.abacResource;
      return {
        department: r.department ?? r.metadata?.department,
        dataSourceId: r.dataSourceId ?? r.data_source_id,
        classification: r.classification ?? r.sensitivityLevel,
      };
    }

    // From request body (create / update operations)
    const body = request.body;
    const query = request.query;

    const department =
      body?.department ?? query?.department ?? undefined;
    const dataSourceId =
      body?.dataSourceId ?? query?.dataSourceId ?? undefined;
    const classification =
      body?.classification ?? query?.classification ?? undefined;

    // Only return context if at least one field is present
    if (department || dataSourceId || classification) {
      return { department, dataSourceId, classification };
    }

    return null;
  }
}
