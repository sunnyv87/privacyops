import { AbacEngine, AbacContext, AbacPolicy } from '@/core/auth/policies/abac-engine';
import { ConfigService } from '@nestjs/config';

describe('AbacEngine', () => {
  let engine: AbacEngine;

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => defaultValue),
  } as unknown as ConfigService;

  beforeEach(() => {
    engine = new AbacEngine(mockConfig);
  });

  function makeContext(overrides: Partial<AbacContext> = {}): AbacContext {
    return {
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@example.com',
        roles: ['tenant-admin'],
        permissions: ['*'],
        clearanceLevel: 3,
      },
      resource: {
        type: 'DataSource',
        id: 'resource-1',
        tenantId: 'tenant-1',
        ownerId: 'user-1',
        sensitivity: 3,
      },
      action: 'read',
      environment: {},
      ...overrides,
    };
  }

  it('should allow access when no policies are violated', () => {
    const ctx = makeContext();
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should deny cross-tenant access', () => {
    const ctx = makeContext({
      resource: {
        type: 'DataSource',
        id: 'resource-1',
        tenantId: 'different-tenant',
        sensitivity: 1,
      },
    });
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('tenant');
  });

  it('should deny when classification exceeds clearance', () => {
    const ctx = makeContext({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@example.com',
        roles: ['analyst'],
        permissions: ['dspm:findings:read'],
        clearanceLevel: 2,
      },
      resource: {
        type: 'DataSource',
        id: 'resource-1',
        tenantId: 'tenant-1',
        sensitivity: 5,
      },
    });
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('clearance');
  });

  it('should allow owner access when no higher-priority deny matches', () => {
    const ctx = makeContext({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@example.com',
        roles: ['analyst'],
        permissions: ['dspm:findings:read'],
        clearanceLevel: 3,
      },
      resource: {
        type: 'DataSource',
        id: 'resource-1',
        tenantId: 'tenant-1',
        ownerId: 'user-1',
        sensitivity: 3,
      },
    });
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe('owner-access');
  });

  it('should allow registering custom policies', () => {
    const customPolicy: AbacPolicy = {
      name: 'block-weekends',
      description: 'Block all write access on weekends',
      effect: 'deny',
      priority: 100,
      condition: (ctx) => {
        const day = new Date().getDay();
        return (day === 0 || day === 6) && ctx.action === 'write';
      },
    };

    engine.registerPolicy(customPolicy);
    const ctx = makeContext({ action: 'read' });
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('should respect deny-overrides (deny takes priority over allow at same level)', () => {
    engine.registerPolicy({
      name: 'explicit-allow',
      description: 'Allow everything',
      effect: 'allow',
      priority: 50,
      condition: () => true,
    });
    engine.registerPolicy({
      name: 'explicit-deny',
      description: 'Deny cross-tenant',
      effect: 'deny',
      priority: 50,
      condition: (ctx) => ctx.resource.tenantId !== ctx.user.tenantId,
    });

    const ctx = makeContext({
      resource: { type: 'Asset', tenantId: 'other-tenant', sensitivity: 1 },
    });
    const result = engine.evaluate(ctx);
    expect(result.allowed).toBe(false);
  });
});
