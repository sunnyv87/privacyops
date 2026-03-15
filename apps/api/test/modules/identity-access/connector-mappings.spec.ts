import { Test, TestingModule } from '@nestjs/testing';
import { IdentityAccessService } from '@/modules/identity-access/identity-access.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { AccessAnalyzer } from '@/modules/identity-access/access-analyzer';

describe('IdentityAccessService — buildMappingsFromConnector', () => {
  let service: IdentityAccessService;
  let prisma: any;
  let events: any;
  let accessAnalyzer: any;

  const tenantId = 'tenant-iam-1';
  const assetId = 'asset-iam-1';

  beforeEach(async () => {
    prisma = {
      identityAccessMapping: {
        upsert: jest.fn().mockResolvedValue({ id: 'mapping-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    events = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    accessAnalyzer = {
      analyzeExcessivePermissions: jest.fn().mockImplementation((m) => m),
      analyzeInactiveAccess: jest.fn().mockImplementation((m) => m),
      analyzePublicSharing: jest.fn().mockImplementation((m) => m),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityAccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EventBusService, useValue: events },
        { provide: AccessAnalyzer, useValue: accessAnalyzer },
      ],
    }).compile();

    service = module.get<IdentityAccessService>(IdentityAccessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create mappings from connector access policies', async () => {
    const policies = [
      { principal: 'admin@corp.com', principalType: 'user', permissions: ['read', 'write'], source: 'iam' },
      { principal: 'viewer@corp.com', principalType: 'user', permissions: ['read'], source: 'iam' },
    ];

    const result = await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(result.created).toBe(2);
    expect(prisma.identityAccessMapping.upsert).toHaveBeenCalledTimes(2);
  });

  it('should derive admin permission level from admin/owner/full_control permissions', async () => {
    const policies = [
      { principal: 'superadmin@corp.com', principalType: 'user', permissions: ['admin', 'read'], source: 'iam' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(prisma.identityAccessMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          permissionLevel: 'admin',
        }),
      }),
    );
  });

  it('should derive write permission level from write/edit/delete permissions', async () => {
    const policies = [
      { principal: 'editor@corp.com', principalType: 'user', permissions: ['write', 'read'], source: 'iam' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(prisma.identityAccessMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          permissionLevel: 'write',
        }),
      }),
    );
  });

  it('should default to read permission level for read-only policies', async () => {
    const policies = [
      { principal: 'reader@corp.com', principalType: 'user', permissions: ['read'], source: 'bucket_policy' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(prisma.identityAccessMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          permissionLevel: 'read',
        }),
      }),
    );
  });

  it('should run access analysis pipeline after mapping creation', async () => {
    const mappings = [
      { id: 'map-1', isExcessive: true, isInactive: false },
      { id: 'map-2', isExcessive: false, isInactive: true },
    ];

    prisma.identityAccessMapping.findMany.mockResolvedValue(mappings);
    accessAnalyzer.analyzeExcessivePermissions.mockReturnValue(mappings);
    accessAnalyzer.analyzeInactiveAccess.mockReturnValue(mappings);
    accessAnalyzer.analyzePublicSharing.mockReturnValue(mappings);

    const policies = [
      { principal: 'user1@corp.com', principalType: 'user', permissions: ['read'], source: 'iam' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(accessAnalyzer.analyzeExcessivePermissions).toHaveBeenCalled();
    expect(accessAnalyzer.analyzeInactiveAccess).toHaveBeenCalled();
    expect(accessAnalyzer.analyzePublicSharing).toHaveBeenCalled();

    // Should update excessive/inactive flags
    expect(prisma.identityAccessMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'map-1' },
        data: { isExcessive: true, isInactive: false },
      }),
    );
    expect(prisma.identityAccessMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'map-2' },
        data: { isExcessive: false, isInactive: true },
      }),
    );
  });

  it('should publish identity-access.mappings.built event with source=connector', async () => {
    const policies = [
      { principal: 'u1@corp.com', principalType: 'user', permissions: ['read'], source: 'iam' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'identity-access.mappings.built',
        tenantId,
        data: expect.objectContaining({
          assetId,
          mappingCount: 1,
          source: 'connector',
        }),
      }),
    );
  });

  it('should store accessSource from policy source field', async () => {
    const policies = [
      { principal: 'svc@corp.com', principalType: 'service_account', permissions: ['read', 'write'], source: 'k8s_rbac' },
    ];

    await service.buildMappingsFromConnector(tenantId, assetId, policies);

    expect(prisma.identityAccessMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accessSource: 'k8s_rbac',
          identityType: 'service_account',
        }),
      }),
    );
  });

  it('should handle empty policies array', async () => {
    const result = await service.buildMappingsFromConnector(tenantId, assetId, []);

    expect(result.created).toBe(0);
    expect(prisma.identityAccessMapping.upsert).not.toHaveBeenCalled();
  });
});
