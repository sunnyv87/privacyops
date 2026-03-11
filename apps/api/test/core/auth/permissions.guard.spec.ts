import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import { PERMISSIONS_KEY } from '@/core/auth/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/core/auth/decorators/public.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get(PermissionsGuard);
    reflector = module.get(Reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  it('should allow public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const ctx = createMockContext(null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when no permissions required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce([]);
    const ctx = createMockContext({ permissions: ['dspm:*'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has exact permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['dspm:findings:read']);
    const ctx = createMockContext({ permissions: ['dspm:findings:read'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has wildcard permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['dspm:findings:read']);
    const ctx = createMockContext({ permissions: ['dspm:*'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow super admin with * permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin:users:manage']);
    const ctx = createMockContext({ permissions: ['*'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny when user lacks permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['admin:users:manage']);
    const ctx = createMockContext({ permissions: ['dspm:findings:read'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when user has no permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce(['dspm:findings:read']);
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should require all permissions when multiple specified', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    jest.spyOn(reflector, 'getAllAndMerge').mockReturnValueOnce([
      'dspm:findings:read',
      'dspm:findings:update',
    ]);
    const ctx = createMockContext({ permissions: ['dspm:findings:read'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
