import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ============================================================================
// ABAC Context & Policy Interfaces
// ============================================================================

export interface AbacUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  department?: string;
  clearanceLevel?: number;
}

export interface AbacResource {
  type: string;
  id?: string;
  tenantId?: string;
  ownerId?: string;
  classification?: string;
  sensitivity?: number;
  department?: string;
  dataSourceId?: string;
}

export interface AbacEnvironment {
  ip?: string;
  time?: Date;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AbacContext {
  user: AbacUser;
  resource: AbacResource;
  action: string;
  environment: AbacEnvironment;
}

export interface AbacPolicy {
  name: string;
  description: string;
  condition: (ctx: AbacContext) => boolean;
  effect: 'allow' | 'deny';
  priority: number; // higher = evaluated first
}

export interface AbacEvaluationResult {
  allowed: boolean;
  reason: string;
  matchedPolicy?: string;
}

// ============================================================================
// Destructive actions for time-based restriction
// ============================================================================

const DESTRUCTIVE_ACTIONS = new Set([
  'delete',
  'purge',
  'destroy',
  'drop',
  'truncate',
  'wipe',
  'bulk_delete',
  'retention.purge',
  'data_source.delete',
  'user.delete',
]);

// ============================================================================
// AbacEngine — Attribute-Based Access Control Engine
// ============================================================================

@Injectable()
export class AbacEngine {
  private readonly logger = new Logger(AbacEngine.name);
  private readonly policies: AbacPolicy[] = [];

  /** Business hours configuration (configurable via env) */
  private readonly businessHoursStart: number;
  private readonly businessHoursEnd: number;
  private readonly businessHoursTimezone: string;

  constructor(private readonly config: ConfigService) {
    this.businessHoursStart = parseInt(
      this.config.get('ABAC_BUSINESS_HOURS_START', '9'),
      10,
    );
    this.businessHoursEnd = parseInt(
      this.config.get('ABAC_BUSINESS_HOURS_END', '18'),
      10,
    );
    this.businessHoursTimezone = this.config.get(
      'ABAC_BUSINESS_HOURS_TZ',
      'UTC',
    );

    this.registerBuiltInPolicies();
  }

  /**
   * Register a custom ABAC policy at runtime.
   */
  registerPolicy(policy: AbacPolicy): void {
    // Prevent duplicate registrations by name
    const existing = this.policies.findIndex((p) => p.name === policy.name);
    if (existing !== -1) {
      this.policies[existing] = policy;
      this.logger.log(`Policy "${policy.name}" replaced`);
    } else {
      this.policies.push(policy);
      this.logger.log(`Policy "${policy.name}" registered (priority=${policy.priority})`);
    }
  }

  /**
   * Evaluate all registered policies against the given context.
   *
   * Strategy: deny-overrides
   * 1. Sort policies by priority descending (higher priority first).
   * 2. Evaluate each policy whose condition matches.
   * 3. If ANY matching policy has effect='deny', access is denied immediately.
   * 4. If at least one matching policy has effect='allow', access is granted.
   * 5. If no policy matches, access is denied by default.
   */
  evaluate(ctx: AbacContext): AbacEvaluationResult {
    const sorted = [...this.policies].sort((a, b) => b.priority - a.priority);

    let allowPolicy: AbacPolicy | null = null;

    for (const policy of sorted) {
      let matches: boolean;
      try {
        matches = policy.condition(ctx);
      } catch (err) {
        this.logger.warn(
          `Policy "${policy.name}" condition threw: ${(err as Error).message}`,
        );
        continue;
      }

      if (!matches) {
        continue;
      }

      // Deny-overrides: any deny match immediately rejects
      if (policy.effect === 'deny') {
        this.logger.debug(
          `DENY by policy "${policy.name}" for user=${ctx.user.id} action=${ctx.action} resource=${ctx.resource.type}:${ctx.resource.id ?? '*'}`,
        );
        return {
          allowed: false,
          reason: `Denied by policy: ${policy.description}`,
          matchedPolicy: policy.name,
        };
      }

      // Track first allow match
      if (policy.effect === 'allow' && !allowPolicy) {
        allowPolicy = policy;
      }
    }

    if (allowPolicy) {
      this.logger.debug(
        `ALLOW by policy "${allowPolicy.name}" for user=${ctx.user.id} action=${ctx.action}`,
      );
      return {
        allowed: true,
        reason: `Allowed by policy: ${allowPolicy.description}`,
        matchedPolicy: allowPolicy.name,
      };
    }

    // Default deny — no policy matched
    return {
      allowed: false,
      reason: 'No matching policy found — access denied by default',
    };
  }

  // --------------------------------------------------------------------------
  // Built-in Policies
  // --------------------------------------------------------------------------

  private registerBuiltInPolicies(): void {
    // a) Tenant isolation — deny if resource belongs to a different tenant
    this.registerPolicy({
      name: 'tenant-isolation',
      description:
        'Cross-tenant access is forbidden. Resource tenant must match user tenant.',
      priority: 1000,
      effect: 'deny',
      condition: (ctx) => {
        // Only applicable when the resource has a tenantId
        if (!ctx.resource.tenantId) return false;
        return ctx.resource.tenantId !== ctx.user.tenantId;
      },
    });

    // b) Owner access — allow if user owns the resource
    this.registerPolicy({
      name: 'owner-access',
      description: 'Resource owner has access to their own resources.',
      priority: 900,
      effect: 'allow',
      condition: (ctx) => {
        if (!ctx.resource.ownerId) return false;
        return ctx.resource.ownerId === ctx.user.id;
      },
    });

    // c) Classification clearance — deny if resource sensitivity exceeds user clearance
    this.registerPolicy({
      name: 'classification-clearance',
      description:
        'Access denied: resource sensitivity exceeds user clearance level.',
      priority: 950,
      effect: 'deny',
      condition: (ctx) => {
        // Only enforce when both values are present
        if (
          ctx.resource.sensitivity == null ||
          ctx.user.clearanceLevel == null
        ) {
          return false;
        }
        return ctx.resource.sensitivity > ctx.user.clearanceLevel;
      },
    });

    // d) Time-based restriction — deny destructive actions outside business hours
    this.registerPolicy({
      name: 'time-based-restriction',
      description:
        'Destructive actions are only permitted during business hours.',
      priority: 800,
      effect: 'deny',
      condition: (ctx) => {
        // Only apply to destructive actions
        const actionBase = ctx.action.split('.').pop() ?? ctx.action;
        if (
          !DESTRUCTIVE_ACTIONS.has(ctx.action) &&
          !DESTRUCTIVE_ACTIONS.has(actionBase)
        ) {
          return false;
        }

        const now = ctx.environment.time ?? new Date();
        const hour = this.getHourInTimezone(now, this.businessHoursTimezone);

        // Outside business hours => condition matches => deny
        return hour < this.businessHoursStart || hour >= this.businessHoursEnd;
      },
    });
  }

  /**
   * Get the current hour in the configured timezone.
   */
  private getHourInTimezone(date: Date, tz: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(date);
      const hourPart = parts.find((p) => p.type === 'hour');
      return hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
    } catch {
      // Fallback to UTC if timezone is invalid
      return date.getUTCHours();
    }
  }
}
