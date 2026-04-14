import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ============================================================================
// Decorator — @MaskFields(entityType)
// ============================================================================

export const MASK_FIELDS_KEY = 'maskFieldsEntityType';

/**
 * Annotate an endpoint to enable field-level masking on the response.
 *
 * @param entityType - The entity type name used to look up masking rules.
 *                     Pass '*' to apply all rules (auto-detect entity type).
 */
export const MaskFields = (entityType: string) =>
  SetMetadata(MASK_FIELDS_KEY, entityType);

// ============================================================================
// Field Mask Rule
// ============================================================================

export interface FieldMaskRule {
  /** The entity/model type this rule applies to (e.g. 'DataSource', 'User') */
  entityType: string;
  /** The field name to mask (supports nested dot paths) */
  field: string;
  /** Permission required to see the unmasked value. null = always mask */
  requiredPermission: string | null;
  /** Value to replace the field with. undefined = remove the field entirely */
  maskValue: string | undefined;
}

// ============================================================================
// FieldMaskInterceptor
// ============================================================================

/**
 * Fields that are ALWAYS stripped from every outbound response,
 * regardless of whether the route carries `@MaskFields()`. This is the
 * fail-closed guarantee: if a developer forgets the decorator on a new
 * endpoint, sensitive credentials are still removed. Service-layer
 * queries should still use `select` whitelists; this interceptor is the
 * belt-and-braces backstop.
 *
 * Deletions are keyed by field name and walk every nested plain object
 * in the response tree — so `{ user: { passwordHash: '…' } }` is
 * scrubbed identically to a bare user object.
 */
const ALWAYS_STRIPPED_FIELDS: ReadonlySet<string> = new Set([
  'passwordHash',
  'password_hash',
  'mfaSecret',
  'mfa_secret',
  'mfaRecoveryCodes',
  'mfa_recovery_codes',
  'apiKeyHash',
  'api_key_hash',
  'hashedRefreshToken',
  'hashed_refresh_token',
  'resetPasswordToken',
  'reset_password_token',
  'secretKey',
  'secret_key',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
]);

@Injectable()
export class FieldMaskInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FieldMaskInterceptor.name);

  /** Configurable masking rules per entity type */
  private readonly rules: FieldMaskRule[] = [
    {
      entityType: 'DataSource',
      field: 'connectionConfig',
      requiredPermission: 'admin:secrets:read',
      maskValue: '***REDACTED***',
    },
    {
      entityType: 'DataSubject',
      field: 'identityAttributes',
      requiredPermission: 'dsar:pii:read',
      maskValue: '***REDACTED***',
    },
    {
      entityType: 'DsarRequest',
      field: 'requestorInfo',
      requiredPermission: 'dsar:pii:read',
      maskValue: '***REDACTED***',
    },
    {
      entityType: 'ConsentRecord',
      field: 'ipAddress',
      requiredPermission: 'audit:pii:read',
      maskValue: '***',
    },
    {
      entityType: 'User',
      field: 'passwordHash',
      requiredPermission: null, // always remove
      maskValue: undefined,
    },
  ];

  constructor(private readonly reflector: Reflector) {}

  /**
   * Register additional masking rules at runtime.
   */
  addRule(rule: FieldMaskRule): void {
    this.rules.push(rule);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Read entity type from @MaskFields decorator
    const entityType = this.reflector.getAllAndOverride<string>(
      MASK_FIELDS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions || [];

    // Determine which permission-gated rules apply (if any)
    const applicableRules = entityType
      ? entityType === '*'
        ? this.rules
        : this.rules.filter((r) => r.entityType === entityType)
      : [];

    const rulesToApply = applicableRules.filter((rule) => {
      if (rule.requiredPermission === null) return true; // always mask
      return !this.hasPermission(userPermissions, rule.requiredPermission);
    });

    // Fail-closed: even if no @MaskFields decorator was set and no
    // explicit rules match, we ALWAYS run the global sensitive-field
    // stripper so credentials can never leak from a forgotten
    // annotation. The stripper is a cheap deep walk; for large
    // responses it's dominated by the existing JSON serialisation cost.
    return next.handle().pipe(
      map((data) => {
        if (data == null) return data;
        let result = data;
        if (rulesToApply.length > 0) {
          result = this.applyMasking(result, rulesToApply);
        }
        result = this.stripAlwaysSensitive(result);
        return result;
      }),
    );
  }

  /**
   * Walk the response payload and delete any key matching the
   * always-stripped set. This runs AFTER the rule-driven masking pass
   * so it catches fields the configured rules may have missed.
   */
  private stripAlwaysSensitive(data: any, seen = new WeakSet()): any {
    if (data == null || typeof data !== 'object') return data;
    if (seen.has(data)) return data;
    seen.add(data);

    if (Array.isArray(data)) {
      for (const item of data) this.stripAlwaysSensitive(item, seen);
      return data;
    }

    for (const key of Object.keys(data)) {
      if (ALWAYS_STRIPPED_FIELDS.has(key)) {
        delete data[key];
        continue;
      }
      const value = data[key];
      if (value != null && typeof value === 'object') {
        // Do not traverse Date / Buffer / Prisma Decimal / etc.
        if (
          value.constructor === Object ||
          value.constructor === undefined ||
          Array.isArray(value)
        ) {
          this.stripAlwaysSensitive(value, seen);
        }
      }
    }
    return data;
  }

  /**
   * Recursively apply masking rules to a response payload.
   * Handles single objects, arrays, and nested pagination wrappers.
   */
  private applyMasking(data: any, rules: FieldMaskRule[]): any {
    if (data == null || typeof data !== 'object') return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.applyMasking(item, rules));
    }

    // Deep clone to avoid mutating the original
    const result = { ...data };

    // Handle common pagination wrappers
    if (result.data && Array.isArray(result.data)) {
      result.data = result.data.map((item: any) =>
        this.applyMasking(item, rules),
      );
      return result;
    }
    if (result.items && Array.isArray(result.items)) {
      result.items = result.items.map((item: any) =>
        this.applyMasking(item, rules),
      );
      return result;
    }
    if (result.results && Array.isArray(result.results)) {
      result.results = result.results.map((item: any) =>
        this.applyMasking(item, rules),
      );
      return result;
    }

    // Apply rules to the current object
    for (const rule of rules) {
      this.maskField(result, rule.field, rule.maskValue);
    }

    // Recursively process nested objects that might contain entities
    for (const key of Object.keys(result)) {
      const val = result[key];
      if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        // Only recurse into plain objects (not Date, etc.)
        if (val.constructor === Object || val.constructor === undefined) {
          result[key] = this.applyMasking(val, rules);
        }
      } else if (Array.isArray(val)) {
        result[key] = val.map((item: any) =>
          typeof item === 'object' && item !== null
            ? this.applyMasking(item, rules)
            : item,
        );
      }
    }

    return result;
  }

  /**
   * Mask or remove a field on an object using dot-path notation.
   */
  private maskField(
    obj: any,
    fieldPath: string,
    maskValue: string | undefined,
  ): void {
    const parts = fieldPath.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (current == null || typeof current !== 'object') return;
      current = current[parts[i]];
    }

    const lastKey = parts[parts.length - 1];
    if (current == null || typeof current !== 'object') return;

    if (!(lastKey in current)) return;

    if (maskValue === undefined) {
      // Remove the field entirely
      delete current[lastKey];
    } else {
      current[lastKey] = maskValue;
    }
  }

  /**
   * Check if user permissions include the required permission (with wildcard support).
   */
  private hasPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    for (const perm of userPermissions) {
      if (perm === required) return true;
      if (perm === '*') return true;
      if (perm.endsWith(':*')) {
        const namespace = perm.slice(0, -1);
        if (required.startsWith(namespace)) return true;
      }
    }
    return false;
  }
}
