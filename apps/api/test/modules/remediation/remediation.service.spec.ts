import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RemediationService } from '../../../src/modules/remediation/remediation.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import { RemediationExecutorService } from '../../../src/modules/remediation/remediation-executor.service';

describe('RemediationService', () => {
  let service: RemediationService;

  const mockPrisma = {
    riskFinding: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    remediationAction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    asset: { update: jest.fn() },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };
  const mockExecutor = {
    captureRollbackState: jest.fn(),
    validate: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemediationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
        { provide: RemediationExecutorService, useValue: mockExecutor },
      ],
    }).compile();

    service = module.get<RemediationService>(RemediationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── proposeAction ─────────────────────────────────────────────────────────

  describe('proposeAction', () => {
    it('should throw NotFoundException for missing finding', async () => {
      mockPrisma.riskFinding.findFirst.mockResolvedValue(null);

      await expect(
        service.proposeAction('tenant-1', 'finding-404', 'encrypt', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a proposed remediation action', async () => {
      mockPrisma.riskFinding.findFirst.mockResolvedValue({ id: 'f-1', tenantId: 'tenant-1' });
      mockExecutor.captureRollbackState.mockResolvedValue({ assetId: 'a-1' });
      mockPrisma.remediationAction.create.mockResolvedValue({
        id: 'action-1',
        status: 'proposed',
        actionType: 'encrypt',
      });

      const result = await service.proposeAction('tenant-1', 'f-1', 'encrypt', 'user-1');

      expect(result.status).toBe('proposed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'remediation.proposed' }),
      );
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'remediation.proposed' }),
      );
    });
  });

  // ─── approveAction ─────────────────────────────────────────────────────────

  describe('approveAction', () => {
    it('should throw NotFoundException for missing action', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue(null);

      await expect(
        service.approveAction('tenant-1', 'action-404', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status to approved', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({ id: 'a-1', status: 'proposed' });
      mockPrisma.remediationAction.update.mockResolvedValue({ id: 'a-1', status: 'approved' });

      const result = await service.approveAction('tenant-1', 'a-1', 'user-1');

      expect(result.status).toBe('approved');
      expect(mockPrisma.remediationAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });
  });

  // ─── executeAction ─────────────────────────────────────────────────────────

  describe('executeAction', () => {
    it('should throw NotFoundException for missing action', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue(null);

      await expect(
        service.executeAction('tenant-1', 'action-404', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject execution when validation fails', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({ id: 'a-1' });
      mockExecutor.validate.mockResolvedValue({ valid: false, message: 'Invalid state' });

      await expect(
        service.executeAction('tenant-1', 'a-1', 'user-1'),
      ).rejects.toThrow('Action cannot be executed: Invalid state');
    });

    it('should execute and mark as completed on success', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({ id: 'a-1', status: 'approved' });
      mockExecutor.validate.mockResolvedValue({ valid: true });
      mockExecutor.execute.mockResolvedValue({ applied: true });
      mockPrisma.remediationAction.update
        .mockResolvedValueOnce({}) // executing
        .mockResolvedValueOnce({ id: 'a-1', status: 'completed' }); // completed

      const result = await service.executeAction('tenant-1', 'a-1', 'user-1');

      expect(result.status).toBe('completed');
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'remediation.completed' }),
      );
    });

    it('should mark as failed on execution error', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({ id: 'a-1' });
      mockExecutor.validate.mockResolvedValue({ valid: true });
      mockExecutor.execute.mockRejectedValue(new Error('Execution failed'));
      mockPrisma.remediationAction.update.mockResolvedValue({});

      await expect(
        service.executeAction('tenant-1', 'a-1', 'user-1'),
      ).rejects.toThrow('Execution failed');
      expect(mockPrisma.remediationAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });
  });

  // ─── rollbackAction ────────────────────────────────────────────────────────

  describe('rollbackAction', () => {
    it('should throw NotFoundException for missing action', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue(null);

      await expect(
        service.rollbackAction('tenant-1', 'action-404', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when no rollback data exists', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({
        id: 'a-1',
        rollbackData: {},
      });

      await expect(
        service.rollbackAction('tenant-1', 'a-1', 'user-1'),
      ).rejects.toThrow('No rollback data available');
    });

    it('should restore asset metadata and finding status', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'completed',
        rollbackData: {
          assetId: 'asset-1',
          assetMetadata: { key: 'old-value' },
          findingId: 'f-1',
          findingStatus: 'open',
        },
      });
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.riskFinding.update.mockResolvedValue({});
      mockPrisma.remediationAction.update.mockResolvedValue({ id: 'a-1', status: 'rolled_back' });

      const result = await service.rollbackAction('tenant-1', 'a-1', 'user-1');

      expect(result.status).toBe('rolled_back');
      expect(mockPrisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: { metadata: { key: 'old-value' } },
        }),
      );
      expect(mockPrisma.riskFinding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'f-1' },
          data: { status: 'open' },
        }),
      );
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'remediation.rolled_back' }),
      );
    });
  });

  // ─── findActions ───────────────────────────────────────────────────────────

  describe('findActions', () => {
    it('should return paginated results', async () => {
      mockPrisma.remediationAction.findMany.mockResolvedValue([{ id: 'a-1' }]);
      mockPrisma.remediationAction.count.mockResolvedValue(1);

      const result = await service.findActions('tenant-1', { page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('should filter by status and actionType', async () => {
      mockPrisma.remediationAction.findMany.mockResolvedValue([]);
      mockPrisma.remediationAction.count.mockResolvedValue(0);

      await service.findActions('tenant-1', { status: 'completed', actionType: 'encrypt' });

      expect(mockPrisma.remediationAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed', actionType: 'encrypt' }),
        }),
      );
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException for missing action', async () => {
      mockPrisma.remediationAction.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('tenant-1', 'a-404'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
