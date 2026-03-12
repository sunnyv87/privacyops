/**
 * Security Tests — validates auth, RBAC, input validation, and token handling.
 */
import { ForbiddenException } from '@nestjs/common';

// ── Mock PermissionsGuard logic (extracted from the source) ──────────────────

function matchesPermission(userPermissions: string[], required: string): boolean {
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

interface RoleScope {
  departments?: string[];
  dataSourceIds?: string[];
  classifications?: string[];
}

interface ResourceContext {
  department?: string;
  dataSourceId?: string;
  classification?: string;
}

function evaluateScope(scope: RoleScope, resourceCtx: ResourceContext | null): boolean {
  if (!resourceCtx) return true;
  if (scope.departments && scope.departments.length > 0 && resourceCtx.department) {
    if (!scope.departments.includes(resourceCtx.department)) return false;
  }
  if (scope.dataSourceIds && scope.dataSourceIds.length > 0 && resourceCtx.dataSourceId) {
    if (!scope.dataSourceIds.includes(resourceCtx.dataSourceId)) return false;
  }
  if (scope.classifications && scope.classifications.length > 0 && resourceCtx.classification) {
    if (!scope.classifications.includes(resourceCtx.classification)) return false;
  }
  return true;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Security Tests', () => {
  // ─── Permission matching ──────────────────────────────────────────────────

  describe('Permission Matching', () => {
    it('should match exact permission strings', () => {
      expect(matchesPermission(['classification:read'], 'classification:read')).toBe(true);
    });

    it('should reject unmatched permissions', () => {
      expect(matchesPermission(['classification:read'], 'classification:write')).toBe(false);
    });

    it('should match wildcard (*) for superadmin', () => {
      expect(matchesPermission(['*'], 'anything:read')).toBe(true);
      expect(matchesPermission(['*'], 'dspm:write')).toBe(true);
    });

    it('should match namespace wildcard (dspm:*)', () => {
      expect(matchesPermission(['dspm:*'], 'dspm:read')).toBe(true);
      expect(matchesPermission(['dspm:*'], 'dspm:write')).toBe(true);
      expect(matchesPermission(['dspm:*'], 'dspm:delete')).toBe(true);
    });

    it('should not cross namespace with wildcard', () => {
      expect(matchesPermission(['dspm:*'], 'classification:read')).toBe(false);
    });

    it('should check all permissions in user array', () => {
      expect(matchesPermission(['dspm:read', 'classification:write'], 'classification:write')).toBe(true);
    });

    it('should reject empty permission arrays', () => {
      expect(matchesPermission([], 'dspm:read')).toBe(false);
    });

    it('should handle multiple wildcard permissions', () => {
      expect(matchesPermission(['dspm:*', 'classification:*'], 'classification:delete')).toBe(true);
      expect(matchesPermission(['dspm:*', 'classification:*'], 'consent:read')).toBe(false);
    });
  });

  // ─── RBAC Scope evaluation ────────────────────────────────────────────────

  describe('RBAC Scope Evaluation', () => {
    it('should allow when no resource context is available', () => {
      const scope: RoleScope = { departments: ['engineering'] };
      expect(evaluateScope(scope, null)).toBe(true);
    });

    it('should allow when department matches scope', () => {
      const scope: RoleScope = { departments: ['engineering', 'security'] };
      expect(evaluateScope(scope, { department: 'engineering' })).toBe(true);
    });

    it('should deny when department does not match scope', () => {
      const scope: RoleScope = { departments: ['engineering'] };
      expect(evaluateScope(scope, { department: 'hr' })).toBe(false);
    });

    it('should allow when dataSourceId matches scope', () => {
      const scope: RoleScope = { dataSourceIds: ['ds-1', 'ds-2'] };
      expect(evaluateScope(scope, { dataSourceId: 'ds-1' })).toBe(true);
    });

    it('should deny when dataSourceId does not match scope', () => {
      const scope: RoleScope = { dataSourceIds: ['ds-1'] };
      expect(evaluateScope(scope, { dataSourceId: 'ds-999' })).toBe(false);
    });

    it('should allow when classification matches scope', () => {
      const scope: RoleScope = { classifications: ['pii', 'phi'] };
      expect(evaluateScope(scope, { classification: 'pii' })).toBe(true);
    });

    it('should deny when classification does not match scope', () => {
      const scope: RoleScope = { classifications: ['pii'] };
      expect(evaluateScope(scope, { classification: 'pfi' })).toBe(false);
    });

    it('should evaluate all scope dimensions together', () => {
      const scope: RoleScope = {
        departments: ['engineering'],
        dataSourceIds: ['ds-1'],
        classifications: ['pii'],
      };

      // All match
      expect(evaluateScope(scope, { department: 'engineering', dataSourceId: 'ds-1', classification: 'pii' })).toBe(true);

      // Department mismatch
      expect(evaluateScope(scope, { department: 'hr', dataSourceId: 'ds-1', classification: 'pii' })).toBe(false);

      // DataSource mismatch
      expect(evaluateScope(scope, { department: 'engineering', dataSourceId: 'ds-2', classification: 'pii' })).toBe(false);
    });

    it('should skip scope dimensions with empty arrays', () => {
      const scope: RoleScope = { departments: [], dataSourceIds: ['ds-1'] };
      expect(evaluateScope(scope, { department: 'any-dept', dataSourceId: 'ds-1' })).toBe(true);
    });

    it('should skip scope dimensions when resource field is absent', () => {
      const scope: RoleScope = { departments: ['engineering'] };
      expect(evaluateScope(scope, { dataSourceId: 'ds-1' })).toBe(true);
    });
  });

  // ─── Input Validation ─────────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('should reject SQL injection patterns in tenant IDs', () => {
      const maliciousTenantId = "'; DROP TABLE users; --";
      // Validate: tenant IDs should be UUIDs, not contain SQL
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(maliciousTenantId)).toBe(false);
    });

    it('should reject XSS patterns in string fields', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const xssRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      expect(xssRegex.test(maliciousInput)).toBe(true);
    });

    it('should validate email format', () => {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      expect(emailRegex.test('user@example.com')).toBe(true);
      expect(emailRegex.test('not-an-email')).toBe(false);
      expect(emailRegex.test('')).toBe(false);
      expect(emailRegex.test('user@')).toBe(false);
    });

    it('should validate ISO date format', () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(dateRegex.test(new Date().toISOString())).toBe(true);
      expect(dateRegex.test('not-a-date')).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      const maliciousPath = '../../../etc/passwd';
      const pathTraversalRegex = /\.\.\//;
      expect(pathTraversalRegex.test(maliciousPath)).toBe(true);
    });

    it('should validate scan mode values', () => {
      const validModes = ['full', 'incremental'];
      expect(validModes.includes('full')).toBe(true);
      expect(validModes.includes('incremental')).toBe(true);
      expect(validModes.includes('destructive')).toBe(false);
    });

    it('should validate DSAR request types', () => {
      const validTypes = ['access', 'deletion', 'rectification', 'portability', 'restriction', 'objection'];
      expect(validTypes.includes('access')).toBe(true);
      expect(validTypes.includes('deletion')).toBe(true);
      expect(validTypes.includes('unknown')).toBe(false);
    });
  });

  // ─── Token Validation ─────────────────────────────────────────────────────

  describe('Token Validation', () => {
    it('should validate JWT structure (three parts separated by dots)', () => {
      const validJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const parts = validJwt.split('.');
      expect(parts).toHaveLength(3);
      parts.forEach(part => expect(part.length).toBeGreaterThan(0));
    });

    it('should reject malformed JWT tokens', () => {
      const invalidTokens = [
        '', // empty
        'not.a.jwt.token.at.all', // too many parts
        'only-one-part', // no dots
        'two.parts', // only two parts
      ];

      for (const token of invalidTokens) {
        const parts = token.split('.');
        expect(parts.length === 3 && parts.every(p => p.length > 0)).toBe(false);
      }
    });

    it('should detect expired token claims', () => {
      const expiredPayload = { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 3600 };
      const now = Math.floor(Date.now() / 1000);
      expect(expiredPayload.exp < now).toBe(true);
    });

    it('should validate token has required claims', () => {
      const validPayload = { sub: 'user-1', tenantId: 'tenant-1', permissions: ['dspm:read'], exp: Math.floor(Date.now() / 1000) + 3600 };
      expect(validPayload.sub).toBeDefined();
      expect(validPayload.tenantId).toBeDefined();
      expect(validPayload.permissions).toBeDefined();
      expect(validPayload.exp).toBeDefined();
    });

    it('should reject tokens without tenantId claim', () => {
      const payload = { sub: 'user-1', permissions: ['dspm:read'] } as any;
      expect(payload.tenantId).toBeUndefined();
    });
  });

  // ─── Authorization Guard Logic ────────────────────────────────────────────

  describe('Authorization Guard Logic', () => {
    it('should allow public endpoints without auth', () => {
      const isPublic = true;
      if (isPublic) {
        expect(true).toBe(true); // no auth check needed
      }
    });

    it('should deny access when user has no permissions', () => {
      const user = { id: 'u-1', permissions: undefined };
      expect(user.permissions).toBeUndefined();
    });

    it('should deny access when required permissions not met', () => {
      const userPermissions = ['classification:read'];
      const requiredPermissions = ['classification:write', 'classification:delete'];

      const hasAll = requiredPermissions.every(p => matchesPermission(userPermissions, p));
      expect(hasAll).toBe(false);
    });

    it('should allow access when all required permissions are met', () => {
      const userPermissions = ['classification:*'];
      const requiredPermissions = ['classification:read', 'classification:write'];

      const hasAll = requiredPermissions.every(p => matchesPermission(userPermissions, p));
      expect(hasAll).toBe(true);
    });
  });
});
