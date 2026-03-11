import { Test, TestingModule } from '@nestjs/testing';
import { VendorsService } from '../../../src/modules/vendors/vendors.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('VendorsService', () => {
  let service: VendorsService;

  const mockPrisma = {
    vendor: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    vendorAssessment: {
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
        VendorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a vendor with risk tier and DPA tracking', async () => {
      const tenantId = 'tenant-1';
      const actorId = 'user-1';
      const dto = {
        name: 'Cloud Analytics Corp',
        type: 'processor',
        riskTier: 'high',
        country: 'US',
        contactEmail: 'privacy@cloudanalytics.com',
        servicesProvided: 'Data analytics processing',
        dataShared: ['customer_behavior', 'usage_patterns'],
      };

      const created = { id: 'vendor-1', tenantId, status: 'active', ...dto };
      mockPrisma.vendor.create.mockResolvedValue(created);

      const result = await service.create(tenantId, actorId, dto);

      expect(result.id).toBe('vendor-1');
      expect(result.riskTier).toBe('high');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vendor.created',
          entityType: 'vendor',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should list vendors with pagination', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.vendor.findMany.mockResolvedValue([
        { id: 'v1', name: 'Vendor A', riskTier: 'high' },
        { id: 'v2', name: 'Vendor B', riskTier: 'low' },
      ]);
      mockPrisma.vendor.count.mockResolvedValue(2);

      const result = await service.findAll(tenantId, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
    });

    it('should filter by risk tier', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.vendor.findMany.mockResolvedValue([]);
      mockPrisma.vendor.count.mockResolvedValue(0);

      await service.findAll(tenantId, { riskTier: 'critical', page: 1, pageSize: 20 });

      expect(mockPrisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            riskTier: 'critical',
          }),
        }),
      );
    });
  });
});
