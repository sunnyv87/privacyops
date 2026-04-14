import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by FeatureGateGuard. Do not consume directly;
 * use the `@RequireFeature(...)` decorator instead.
 */
export const REQUIRE_FEATURE_KEY = 'licensing:require-feature';

/**
 * Decorator to gate a controller or handler behind a feature flag
 * resolved from the tenant's active plan + per-tenant overrides.
 *
 * Usage:
 *   @RequireFeature('ai_copilot')
 *   @Controller('co-pilot')
 *   export class CoPilotController { ... }
 *
 * You can supply multiple feature keys — the request passes if ANY
 * of them are enabled for the tenant. This mirrors @RequirePermissions
 * semantics for composability.
 *
 * The guard runs AFTER PermissionsGuard, so RBAC is evaluated first
 * and licensing is a second-stage check — a user who lacks permission
 * is denied with 403 before we reveal whether the feature is licensed.
 */
export const RequireFeature = (...featureKeys: string[]) =>
  SetMetadata(REQUIRE_FEATURE_KEY, featureKeys);

/**
 * Combined decorator: gate by feature + enforce quota on a metric
 * as the same request. Consumed by FeatureGateGuard in a single
 * reflection pass.
 */
export const REQUIRE_QUOTA_KEY = 'licensing:require-quota';
export const RequireQuota = (metric: string) =>
  SetMetadata(REQUIRE_QUOTA_KEY, metric);
