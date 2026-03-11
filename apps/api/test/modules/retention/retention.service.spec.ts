import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from '../../../src/modules/retention/retention.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('RetentionService', () => {
  let service: RetentionService;

  const mockPrisma = {
    retentionPolicy: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a retention policy and log to audit trail', async () => {
      const tenantId = 'tenant-1';
      const actorId = 'user-1';
      const dto = {
        name: 'Customer Data Retention',
        recordCategory: 'customer_data',
        retentionDays: 365,
        actionOnExpiry: 'delete' as const,
        legalBasis: 'DPDP Section 8',
        regulationReference: 'DPDP',
      };

      const created = { id: 'policy-1', tenantId, ...dto, status: 'active' };
      mockPrisma.retentionPolicy.create.mockResolvedValue(created);

      const result = await service.create(tenantId, actorId, dto);

      expect(result.id).toBe('policy-1');
      expect(mockPrisma.retentionPolicy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: dto.name,
          recordCategory: dto.recordCategory,
          retentionPeriodDays: 365,
          actionOnExpiry: 'delete',
          status: 'active',
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'retention_policy.created',
          entityType: 'retention_policy',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should list policies with pagination', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.retentionPolicy.findMany.mockResolvedValue([
        { id: 'p1', name: 'Policy 1' },
        { id: 'p2', name: 'Policy 2' },
      ]);
      mockPrisma.retentionPolicy.count.mockResolvedValue(2);

      const result = await service.findAll(tenantId, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
    });

    it('should filter by record category when provided', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.retentionPolicy.findMany.mockResolvedValue([]);
      mockPrisma.retentionPolicy.count.mockResolvedValue(0);

      await service.findAll(tenantId, {
        recordCategory: 'customer_data',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.retentionPolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            recordCategory: 'customer_data',
          }),
        }),
      );
    });
  });
});
