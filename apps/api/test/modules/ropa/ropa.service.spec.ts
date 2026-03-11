import { Test, TestingModule } from '@nestjs/testing';
import { RopaService } from '../../../src/modules/ropa/ropa.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('RopaService', () => {
  let service: RopaService;

  const mockPrisma = {
    ropaEntry: {
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
        RopaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<RopaService>(RopaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a RoPA entry with required Article 30 fields', async () => {
      const tenantId = 'tenant-1';
      const actorId = 'user-1';
      const dto = {
        title: 'Customer Onboarding Processing',
        processingPurpose: 'Processing customer data for account creation',
        lawfulBasis: 'contract',
        dataSubjectCategories: ['customers', 'prospects'],
        personalDataCategories: ['name', 'email', 'phone'],
        ownerId: actorId,
      };

      const created = { id: 'ropa-1', tenantId, status: 'draft', ...dto };
      mockPrisma.ropaEntry.create.mockResolvedValue(created);

      const result = await service.create(tenantId, actorId, dto);

      expect(result.id).toBe('ropa-1');
      expect(result.status).toBe('draft');
      expect(mockPrisma.ropaEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          title: dto.title,
          lawfulBasis: 'contract',
          dataSubjectCategories: ['customers', 'prospects'],
          personalDataCategories: ['name', 'email', 'phone'],
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ropa_entry.created',
          entityType: 'ropa_entry',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should list entries with pagination', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.ropaEntry.findMany.mockResolvedValue([
        { id: 'r1', title: 'Entry 1' },
      ]);
      mockPrisma.ropaEntry.count.mockResolvedValue(1);

      const result = await service.findAll(tenantId, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });
  });
});
