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
   *   - 'dspm:*' matches 'dspm:read' but NOT 'dspm:admin:reset' (single-level)
   *   - '*' matches everything
   *   - Exact match: 'classification:read' matches 'classification:read'
   */
  private matchesPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    const requiredLower = required.toLowerCase();
    for (const perm of userPermissions) {
      const permLower = perm.toLowerCase();

      // Exact match (case-insensitive)
      if (permLower === requiredLower) return true;

      // Superadmin wildcard
      if (permLower === '*') return true;

      // Single-level namespace wildcard: 'dspm:*' matches 'dspm:read'
      // but NOT 'dspm:admin:reset' — wildcard spans one segment only.
      if (permLower.endsWith(':*')) {
        const namespace = permLower.slice(0, -1); // 'dspm:'
        if (requiredLower.startsWith(namespace)) {
          const remainder = requiredLower.slice(namespace.length);
          if (!remainder.includes(':')) return true;
        }
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
   * Fail-closed semantics: a user with a non-empty scope is only permitted
   * on routes that have either (a) produced a resource context this guard
   * can evaluate, or (b) been explicitly flagged as scope-exempt via
   * `request.scopeExempt = true`. Routes that do neither are refused,
   * because a silent allow here turns scope into advisory metadata that
   * can be bypassed by simply omitting the filter field.
   */
  private evaluateScope(scope: RoleScope, request: any): boolean {
    const hasAnyScope =
      (scope.departments && scope.departments.length > 0) ||
      (scope.dataSourceIds && scope.dataSourceIds.length > 0) ||
      (scope.classifications && scope.classifications.length > 0);

    // Users without any scope restrictions are unrestricted.
    if (!hasAnyScope) return true;

    // Explicit opt-out set by the controller or an upstream middleware
    // when the route is known to have no scopable resource (e.g. listing
    // your own profile, global dashboards the user is explicitly allowed
    // to see). This must be set server-side and cannot be spoofed from
    // the request body.
    if (request.scopeExempt === true) return true;

    const resourceCtx = this.extractResourceContext(request);

    // Fail closed: a scoped user on an unscoped route is refused. The
    // calling handler must attach a resourceContext (e.g. via a
    // per-module scope-loader middleware) or mark the route as exempt.
    if (!resourceCtx) {
      this.logger.warn(
        `Scope-enforcement fail-closed: route has no resource context for scoped user`,
      );
      return false;
    }

    // Check department scope
    if (scope.departments && scope.departments.length > 0) {
      if (
        !resourceCtx.department ||
        !scope.departments.includes(resourceCtx.department)
      ) {
        return false;
      }
    }

    // Check data source scope
    if (scope.dataSourceIds && scope.dataSourceIds.length > 0) {
      if (
        !resourceCtx.dataSourceId ||
        !scope.dataSourceIds.includes(resourceCtx.dataSourceId)
      ) {
        return false;
      }
    }

    // Check classification scope
    if (scope.classifications && scope.classifications.length > 0) {
      if (
        !resourceCtx.classification ||
        !scope.classifications.includes(resourceCtx.classification)
      ) {
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
