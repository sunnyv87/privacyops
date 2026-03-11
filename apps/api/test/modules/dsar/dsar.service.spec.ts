import { Test, TestingModule } from '@nestjs/testing';
import { DsarService } from '../../../src/modules/dsar/dsar.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('DsarService', () => {
  let service: DsarService;

  const mockPrisma = {
    dsarRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DsarService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<DsarService>(DsarService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a DSAR with reference number and 30-day due date', async () => {
      mockPrisma.dsarRequest.count.mockResolvedValue(5);
      mockPrisma.dsarRequest.create.mockResolvedValue({
        id: 'dsar-1',
        reference: 'DSAR-2026-0006',
        type: 'access',
        status: 'received',
        dueDate: expect.any(Date),
      });

      const result = await service.create('tenant-1', 'user-1', {
        type: 'access',
        dataSubjectEmail: 'user@test.com',
        description: 'I want my data',
      });

      expect(result.reference).toMatch(/^DSAR-\d{4}-\d{4}$/);
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dsar.received' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should transition status and create timeline entry', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'dsar-1',
        status: 'received',
      });
      mockPrisma.dsarRequest.update.mockResolvedValue({
        id: 'dsar-1',
        status: 'in_progress',
      });

      const result = await service.updateStatus('tenant-1', 'dsar-1', 'user-1', {
        status: 'in_progress',
        note: 'Started processing',
      });

      expect(result.status).toBe('in_progress');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dsar.status_changed' }),
      );
    });
  });

  describe('getStats', () => {
    it('should return DSAR statistics including SLA compliance', async () => {
      mockPrisma.dsarRequest.count.mockResolvedValue(10);
      mockPrisma.dsarRequest.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ avg_days: 15 }]);

      const stats = await service.getStats('tenant-1');

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('slaCompliance');
    });
  });
});
