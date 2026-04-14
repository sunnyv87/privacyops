import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

export interface TenantEntitlements {
  tenantId: string;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  features: Record<string, boolean>; // featureKey -> enabled
  limits: Array<{ metric: string; limitValue: number; period: string; quotaEnforced: boolean }>;
  overrides: Array<{ featureKey: string; enabled: boolean; expiresAt: Date | null }>;
  cachedAt: number;
}

/**
 * Licensing service — the single source of truth for "does tenant X
 * have access to feature Y?". Loads plan + plan features + per-tenant
 * overrides and caches the merged entitlement set in-process with a
 * short TTL.
 *
 * In-memory cache rationale:
 *   - Entitlements change rarely (on plan upgrade/downgrade or a
 *     manual override grant) so a 5-minute TTL is adequate.
 *   - Keeps LicensingModule self-contained with no transitive
 *     dependency on Redis (AuthModule's REDIS_CLIENT is scoped to
 *     AuthModule and would require re-importing the dynamic module).
 *   - Process-local caches diverge across replicas, but the worst
 *     case is a 5-minute window where a tenant temporarily sees
 *     stale entitlements after a plan change — acceptable for a
 *     first cut. Multi-replica consistency can be upgraded to Redis
 *     later without changing the public API of this service.
 *
 * Fail-open during dev: if a tenant has no Subscription row (the
 * state right after the SaaS migration runs and before the backfill
 * executes), the service returns a permissive entitlement set so
 * existing functionality keeps working. Strict mode is controlled
 * by the FeatureGateGuard via `LICENSING_STRICT`.
 */
@Injectable()
export class LicensingService {
  private readonly logger = new Logger(LicensingService.name);
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly CACHE_MAX_ENTRIES = 5_000;

  private readonly cache = new Map<string, TenantEntitlements>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the merged entitlement set for a tenant. Reads from the
   * in-memory cache if fresh, otherwise refreshes from the DB.
   */
  async getEntitlements(tenantId: string): Promise<TenantEntitlements> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < LicensingService.CACHE_TTL_MS) {
      return cached;
    }

    const entitlements = await this.loadFromDatabase(tenantId);
    this.putCache(tenantId, entitlements);
    return entitlements;
  }

  /**
   * Evict the cached entitlement set for a tenant. Called from
   * billing webhooks and from TenantService.provisionTenant when a
   * plan changes.
   */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /**
   * Evict all cached entitlements. Called on plan catalogue changes.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Returns true if the tenant has at least one of the requested
   * feature keys enabled. Case-sensitive exact match on keys.
   */
  async hasAnyFeature(tenantId: string, featureKeys: string[]): Promise<boolean> {
    if (!featureKeys || featureKeys.length === 0) return true;
    const entitlements = await this.getEntitlements(tenantId);
    return featureKeys.some((key) => entitlements.features[key] === true);
  }

  private putCache(tenantId: string, entitlements: TenantEntitlements): void {
    // Simple size cap: drop the oldest entry if we exceed the cap.
    if (this.cache.size >= LicensingService.CACHE_MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(tenantId, entitlements);
  }

  private async loadFromDatabase(tenantId: string): Promise<TenantEntitlements> {
    try {
      const [subscription, overrides] = await Promise.all([
        this.prisma.subscription.findUnique({
          where: { tenantId },
          include: {
            plan: {
              include: {
                features: true,
                limits: true,
              },
            },
          },
        }),
        this.prisma.featureOverride.findMany({
          where: {
            tenantId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);

      // Build feature map: start with plan features, then layer overrides.
      const features: Record<string, boolean> = {};

      if (subscription?.plan?.features) {
        for (const f of subscription.plan.features) {
          features[f.featureKey] = f.enabled;
        }
      } else {
        // No subscription yet — grant permissive defaults. The
        // FeatureGateGuard will decide whether to actually block
        // based on LICENSING_STRICT.
        features['ai_copilot'] = true;
        features['attack_path_analysis'] = true;
        features['shadow_data_detection'] = true;
        features['advanced_risk_analytics'] = true;
        features['api_access'] = true;
        features['scim_provisioning'] = true;
        features['sso_saml'] = true;
        features['custom_retention_rules'] = true;
      }

      for (const override of overrides) {
        features[override.featureKey] = override.enabled;
      }

      const limits = (subscription?.plan?.limits ?? []).map((l) => ({
        metric: l.metric,
        limitValue: Number(l.limitValue),
        period: l.period,
        quotaEnforced: l.quotaEnforced,
      }));

      return {
        tenantId,
        planCode: subscription?.plan?.code ?? null,
        planName: subscription?.plan?.name ?? null,
        subscriptionStatus: subscription?.status ?? null,
        features,
        limits,
        overrides: overrides.map((o) => ({
          featureKey: o.featureKey,
          enabled: o.enabled,
          expiresAt: o.expiresAt,
        })),
        cachedAt: Date.now(),
      };
    } catch (err: any) {
      // Fail open on DB errors — licensing is a secondary gate,
      // not the primary authz. RBAC + TenantGuard already ran.
      this.logger.warn(
        `Failed to load entitlements for ${tenantId}: ${err?.message ?? err}`,
      );
      return {
        tenantId,
        planCode: null,
        planName: null,
        subscriptionStatus: null,
        features: {},
        limits: [],
        overrides: [],
        cachedAt: Date.now(),
      };
    }
  }
}
