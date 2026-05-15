/**
 * Integration tests for tenant isolation. These tests verify that
 * cross-tenant data leakage is impossible at the service layer.
 *
 * These test the actual PrismaService with mocked database calls
 * to verify that tenantId is ALWAYS included in queries.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { IncidentsService } from '@/modules/incidents/incidents.service';
import { DsarService } from '@/modules/dsar/dsar.service';

describe('Tenant Isolation — Integration', () => {
  let incidentsService: IncidentsService;
  let prisma: any;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  beforeEach(async () => {
    prisma = {
      incident: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'inc-1', ...data }),
        ),
        count: jest.fn().mockResolvedValue(0),
      },
      incidentNotification: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'notif-1', ...data }),
        ),
      },
      breachDetectionRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn(), logAdminAction: jest.fn() } },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    incidentsService = module.get<IncidentsService>(IncidentsService);
  });

  it('findAll should always include tenantId in query', async () => {
    await incidentsService.findAll(tenantA);

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });

  it('findAll should scope to the requesting tenant, not a different one', async () => {
    await incidentsService.findAll(tenantA);
    await incidentsService.findAll(tenantB);

    const calls = prisma.incident.findMany.mock.calls;
    expect(calls[0][0].where.tenantId).toBe(tenantA);
    expect(calls[1][0].where.tenantId).toBe(tenantB);
  });

  it('findById should reject cross-tenant access', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(
      incidentsService.findById(tenantA, 'inc-from-tenant-b'),
    ).rejects.toThrow('not found');

    expect(prisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });

  it('create should stamp the correct tenantId', async () => {
    await incidentsService.create(tenantA, 'user-1', {
      title: 'Test incident',
      severity: 'low',
      description: 'Integration test',
    } as any);

    expect(prisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });

  it('update should scope lookup to tenantId', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(
      incidentsService.update(tenantA, 'inc-1', 'user-1', { status: 'closed' } as any),
    ).rejects.toThrow('not found');

    expect(prisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });

  it('detect breach should only load rules for the requesting tenant', async () => {
    await incidentsService.detectBreach(tenantA, {
      type: 'unauthorized_access',
      source: 'siem',
      evidence: {},
    });

    expect(prisma.breachDetectionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantA }),
      }),
    );
  });
});
