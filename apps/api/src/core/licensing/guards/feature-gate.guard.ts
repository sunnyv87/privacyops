import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '@/core/auth/decorators/public.decorator';
import {
  REQUIRE_FEATURE_KEY,
  REQUIRE_QUOTA_KEY,
} from '../decorators/require-feature.decorator';
import { LicensingService } from '../licensing.service';
import { QuotaCheckService } from '@/core/metering/quota-check.service';

/**
 * Global guard that enforces @RequireFeature and @RequireQuota
 * decorators. Runs AFTER PermissionsGuard in the global guard chain,
 * so a user without permission is rejected before licensing is
 * evaluated.
 *
 * Safety model:
 *   - If the handler has no @RequireFeature metadata, the guard
 *     returns true immediately — existing undecorated routes are
 *     unaffected.
 *   - If the tenant has no Subscription row, LicensingService returns
 *     a permissive default. This keeps dev / fresh migrations from
 *     breaking.
 *   - When `LICENSING_STRICT=false` (the default for dev), feature
 *     denials are LOGGED, not enforced. This lets operators roll out
 *     licensing in audit mode before flipping to enforcement.
 *   - In strict mode, 403 is returned with a machine-parseable error
 *     code so clients can prompt for upgrade.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  private readonly logger = new Logger(FeatureGateGuard.name);
  private readonly strict: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly licensing: LicensingService,
    private readonly quota: QuotaCheckService,
  ) {
    const flag = this.config.get<string>('LICENSING_STRICT', 'false');
    this.strict = flag === 'true' || flag === '1';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredFeatures = this.reflector.getAllAndMerge<string[]>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredQuota = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_QUOTA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Short-circuit: no licensing metadata means legacy route.
    if ((!requiredFeatures || requiredFeatures.length === 0) && !requiredQuota) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    // No authenticated tenant context should never reach this guard
    // because JwtAuthGuard + TenantGuard run first, but defensively
    // fail closed on strict mode and fail open on dev mode.
    if (!tenantId) {
      if (this.strict) {
        throw new ForbiddenException({
          code: 'LICENSING_NO_TENANT',
          message: 'tenant context required for feature gate',
        });
      }
      return true;
    }

    // Feature check
    if (requiredFeatures && requiredFeatures.length > 0) {
      const hasFeature = await this.licensing.hasAnyFeature(tenantId, requiredFeatures);
      if (!hasFeature) {
        const msg = `Tenant ${tenantId} denied access to features [${requiredFeatures.join(', ')}]`;
        if (this.strict) {
          throw new ForbiddenException({
            code: 'LICENSING_FEATURE_DENIED',
            message: 'This feature is not included in your current plan',
            features: requiredFeatures,
          });
        }
        this.logger.warn(`[audit-mode] ${msg}`);
      }
    }

    // Quota check
    if (requiredQuota) {
      const result = await this.quota.check(tenantId, requiredQuota);
      if (result.exceeded) {
        const msg = `Tenant ${tenantId} exceeded quota for ${requiredQuota} (${result.used}/${result.limit})`;
        if (this.strict) {
          throw new ForbiddenException({
            code: 'LICENSING_QUOTA_EXCEEDED',
            message: `Quota exceeded for ${requiredQuota}`,
            metric: requiredQuota,
            limit: result.limit,
            used: result.used,
          });
        }
        this.logger.warn(`[audit-mode] ${msg}`);
      }
    }

    return true;
  }
}
