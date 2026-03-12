import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
      groupBy: jest.fn(),
    },
    dataSubject: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    dataAsset: {
      findMany: jest.fn(),
    },
  };

  const mockAudit = {
    log: jest.fn(),
    findByEntity: jest.fn().mockResolvedValue([]),
  };
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

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a DSAR with reference number and 30-day due date', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue(null); // no previous requests
      mockPrisma.dataSubject.findFirst.mockResolvedValue(null);
      mockPrisma.dataSubject.create.mockResolvedValue({ id: 'ds-1' });
      mockPrisma.dsarRequest.create.mockResolvedValue({
        id: 'dsar-1',
        referenceNumber: `DSAR-${new Date().getFullYear()}-0001`,
        type: 'access',
        status: 'received',
        dueDate: new Date(),
      });

      const result = await service.create('tenant-1', 'user-1', {
        type: 'access',
        dataSubjectEmail: 'user@test.com',
        description: 'I want my data',
      });

      expect(result.referenceNumber).toMatch(/^DSAR-\d{4}-\d{4}$/);
      expect(result.status).toBe('received');
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dsar.received' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dsar.created' }),
      );
    });

    it('should increment reference number counter', async () => {
      const year = new Date().getFullYear();
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        referenceNumber: `DSAR-${year}-0005`,
      });
      mockPrisma.dataSubject.findFirst.mockResolvedValue({ id: 'ds-1' });
      mockPrisma.dsarRequest.create.mockImplementation(({ data }: any) => ({
        id: 'dsar-2',
        ...data,
      }));

      const result = await service.create('tenant-1', 'user-1', {
        type: 'deletion',
        dataSubjectEmail: 'user2@test.com',
      });

      expect(mockPrisma.dsarRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceNumber: `DSAR-${year}-0006`,
          }),
        }),
      );
    });

    it('should reuse existing data subject by email hash', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue(null);
      mockPrisma.dataSubject.findFirst.mockResolvedValue({ id: 'existing-ds' });
      mockPrisma.dsarRequest.create.mockResolvedValue({ id: 'dsar-1', referenceNumber: 'DSAR-2026-0001' });

      await service.create('tenant-1', 'user-1', {
        type: 'access',
        dataSubjectEmail: 'existing@test.com',
      });

      expect(mockPrisma.dataSubject.create).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.dsarRequest.findMany.mockResolvedValue([
        { id: 'dsar-1', status: 'received', dueDate: new Date(Date.now() + 86400000) },
      ]);
      mockPrisma.dsarRequest.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('should annotate overdue requests', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.dsarRequest.findMany.mockResolvedValue([
        { id: 'dsar-1', status: 'in_progress', dueDate: pastDate },
      ]);
      mockPrisma.dsarRequest.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1');

      expect(result.data[0].isOverdue).toBe(true);
    });

    it('should not mark completed requests as overdue', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.dsarRequest.findMany.mockResolvedValue([
        { id: 'dsar-1', status: 'completed', dueDate: pastDate },
      ]);
      mockPrisma.dsarRequest.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1');

      expect(result.data[0].isOverdue).toBe(false);
    });

    it('should filter by type', async () => {
      mockPrisma.dsarRequest.findMany.mockResolvedValue([]);
      mockPrisma.dsarRequest.count.mockResolvedValue(0);

      await service.findAll('tenant-1', { type: 'deletion' });

      expect(mockPrisma.dsarRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'deletion' }),
        }),
      );
    });

    it('should support overdue-only filtering', async () => {
      mockPrisma.dsarRequest.findMany.mockResolvedValue([]);
      mockPrisma.dsarRequest.count.mockResolvedValue(0);

      await service.findAll('tenant-1', { overdueOnly: true });

      expect(mockPrisma.dsarRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
            status: expect.objectContaining({ notIn: ['completed', 'rejected'] }),
          }),
        }),
      );
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException for missing request', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('tenant-1', 'dsar-404'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include timeline and overdue status', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'dsar-1',
        status: 'in_progress',
        dueDate: new Date(Date.now() + 86400000),
        dataSubject: {},
      });
      mockAudit.findByEntity.mockResolvedValue([
        { id: 'log-1', action: 'dsar.created', timestamp: new Date() },
      ]);

      const result = await service.findById('tenant-1', 'dsar-1');

      expect(result.isOverdue).toBe(false);
      expect(result.timeline).toHaveLength(1);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should transition status and log audit event', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'dsar-1',
        status: 'received',
        referenceNumber: 'DSAR-2026-0001',
        notes: null,
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
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dsar.in_progress' }),
      );
    });

    it('should set completedAt when status changes to completed', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'dsar-1',
        status: 'in_progress',
        referenceNumber: 'DSAR-2026-0001',
      });
      mockPrisma.dsarRequest.update.mockResolvedValue({ id: 'dsar-1', status: 'completed' });

      await service.updateStatus('tenant-1', 'dsar-1', 'user-1', { status: 'completed' });

      expect(mockPrisma.dsarRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should set rejection reason when rejected', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'dsar-1',
        status: 'received',
        referenceNumber: 'DSAR-2026-0001',
      });
      mockPrisma.dsarRequest.update.mockResolvedValue({ id: 'dsar-1', status: 'rejected' });

      await service.updateStatus('tenant-1', 'dsar-1', 'user-1', {
        status: 'rejected',
        note: 'Invalid request',
      });

      expect(mockPrisma.dsarRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Invalid request',
          }),
        }),
      );
    });

    it('should throw NotFoundException for missing request', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('tenant-1', 'dsar-404', 'user-1', { status: 'in_progress' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── assign ────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('should assign a DSAR to a user', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue({ id: 'dsar-1', assignedTo: null });
      mockPrisma.dsarRequest.update.mockResolvedValue({ id: 'dsar-1', assignedTo: 'user-2' });

      const result = await service.assign('tenant-1', 'dsar-1', 'user-1', 'user-2');

      expect(result.assignedTo).toBe('user-2');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dsar.assigned' }),
      );
    });

    it('should throw NotFoundException for missing request', async () => {
      mockPrisma.dsarRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.assign('tenant-1', 'dsar-404', 'user-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getStats ──────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return DSAR statistics', async () => {
      mockPrisma.dsarRequest.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2); // overdue
      mockPrisma.dsarRequest.groupBy
        .mockResolvedValueOnce([
          { status: 'received', _count: { id: 3 } },
          { status: 'in_progress', _count: { id: 4 } },
          { status: 'completed', _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { type: 'access', _count: { id: 7 } },
          { type: 'deletion', _count: { id: 3 } },
        ]);
      mockPrisma.dsarRequest.findMany.mockResolvedValue([
        { submittedAt: new Date('2026-01-01'), completedAt: new Date('2026-01-15') },
      ]);

      const stats = await service.getStats('tenant-1');

      expect(stats.totalRequests).toBe(10);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byType).toBeDefined();
      expect(stats.overdue).toBe(2);
      expect(stats.averageCompletionDays).toBeGreaterThan(0);
      expect(stats.slaCompliance).toBeDefined();
    });
  });
});
