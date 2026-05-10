import { Test, TestingModule } from '@nestjs/testing';
import { RemediationService } from '../../../src/modules/remediation/remediation.service';
import { RemediationExecutorService } from '../../../src/modules/remediation/remediation-executor.service';
import type { ExecutionResult } from '../../../src/modules/remediation/remediation-executor.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import {
  CAPABILITY_MATRIX,
  ALL_ACTION_TYPES,
  getCapabilitiesForConnector,
  getSuggestedManualAction,
} from '../../../src/modules/remediation/remediation-capabilities';

describe('Remediation Capabilities', () => {
  // ─── Static Capability Matrix ──────────────────────────────────────────────

  describe('CAPABILITY_MATRIX', () => {
    it('should define capabilities for all major connector types', () => {
      const expectedTypes = [
        'aws_s3', 'postgresql', 'mysql', 'snowflake', 'mongodb',
        'salesforce', 'okta', 'azure_blob', 'gcp_storage', 'sqlserver', 'bigquery',
      ];
      for (const type of expectedTypes) {
        expect(CAPABILITY_MATRIX[type]).toBeDefined();
      }
    });

    it('should define all 12 action types for every connector', () => {
      for (const [connectorType, caps] of Object.entries(CAPABILITY_MATRIX)) {
        for (const actionType of ALL_ACTION_TYPES) {
          expect(caps[actionType]).toBeDefined();
          expect(typeof caps[actionType].supported).toBe('boolean');
        }
      }
    });

    it('should mark aws_s3 delete_data as native supported', () => {
      expect(CAPABILITY_MATRIX.aws_s3.delete_data.supported).toBe(true);
      expect(CAPABILITY_MATRIX.aws_s3.delete_data.mode).toBe('native');
    });

    it('should mark postgresql delete_data as unsupported with manual action', () => {
      expect(CAPABILITY_MATRIX.postgresql.delete_data.supported).toBe(false);
      expect(CAPABILITY_MATRIX.postgresql.delete_data.suggested_manual_action).toBeTruthy();
    });

    it('should mark quarantine as supported for all connectors', () => {
      for (const [, caps] of Object.entries(CAPABILITY_MATRIX)) {
        expect(caps.quarantine.supported).toBe(true);
        expect(caps.quarantine.mode).toBe('catalog_update');
      }
    });

    it('should mark apply_retention as supported (catalog_update) for standard connectors', () => {
      const standard = ['aws_s3', 'postgresql', 'mysql', 'snowflake', 'azure_blob', 'gcp_storage', 'bigquery'];
      for (const type of standard) {
        expect(CAPABILITY_MATRIX[type].apply_retention.supported).toBe(true);
        expect(CAPABILITY_MATRIX[type].apply_retention.mode).toBe('catalog_update');
      }
    });

    it('should mark restrict_sharing as supported (catalog_update) for connectors with access policy analysis', () => {
      const withAccessPolicies = ['aws_s3', 'postgresql', 'mysql', 'azure_blob', 'gcp_storage', 'bigquery'];
      for (const type of withAccessPolicies) {
        expect(CAPABILITY_MATRIX[type].restrict_sharing.supported).toBe(true);
        expect(CAPABILITY_MATRIX[type].restrict_sharing.mode).toBe('catalog_update');
      }
    });

    it('should mark restrict_sharing as unsupported for connectors without access policy analysis', () => {
      expect(CAPABILITY_MATRIX.mongodb.restrict_sharing.supported).toBe(false);
      expect(CAPABILITY_MATRIX.okta.restrict_sharing.supported).toBe(false);
    });

    it('should provide suggested_manual_action for every unsupported action', () => {
      for (const [connectorType, caps] of Object.entries(CAPABILITY_MATRIX)) {
        for (const [actionType, cap] of Object.entries(caps)) {
          if (!cap.supported) {
            expect(cap.suggested_manual_action).toBeTruthy();
          }
        }
      }
    });
  });

  describe('getCapabilitiesForConnector', () => {
    it('should return capabilities for a known connector', () => {
      const caps = getCapabilitiesForConnector('aws_s3');
      expect(caps).not.toBeNull();
      expect(caps!.delete_data.supported).toBe(true);
    });

    it('should return null for an unknown connector', () => {
      expect(getCapabilitiesForConnector('nonexistent')).toBeNull();
    });
  });

  describe('getSuggestedManualAction', () => {
    it('should return action for unsupported type', () => {
      const action = getSuggestedManualAction('postgresql', 'delete_data');
      expect(action).toContain('TRUNCATE');
    });

    it('should return null for supported type', () => {
      const action = getSuggestedManualAction('aws_s3', 'quarantine');
      expect(action).toBeNull();
    });

    it('should return null for unknown connector', () => {
      expect(getSuggestedManualAction('unknown', 'encrypt')).toBeNull();
    });
  });
});

// ─── UNSUPPORTED Action Flow (Service Integration) ──────────────────────────

describe('RemediationService — UNSUPPORTED action handling', () => {
  let service: RemediationService;

  const mockPrisma = {
    riskFinding: { findFirst: jest.fn(), update: jest.fn() },
    remediationAction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    workflowTask: { create: jest.fn() },
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

  it('should set status to unsupported when executor returns UNSUPPORTED', async () => {
    const unsupportedResult: ExecutionResult = {
      success: false,
      status: 'UNSUPPORTED',
      message: 'Encryption enablement requires connector-specific API',
      connectorType: 'aws_s3',
    };

    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1',
      tenantId: 'tenant-1',
      findingId: 'f-1',
      actionType: 'encrypt',
      status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue(unsupportedResult);
    mockPrisma.remediationAction.update
      .mockResolvedValueOnce({}) // executing
      .mockResolvedValueOnce({ id: 'a-1', status: 'unsupported' }); // unsupported
    mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-1' });

    const result = await service.executeAction('tenant-1', 'a-1', 'user-1');

    expect(result.status).toBe('unsupported');
  });

  it('should NOT set status to completed when executor returns UNSUPPORTED', async () => {
    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1', tenantId: 'tenant-1', findingId: 'f-1',
      actionType: 'mask_data', status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue({
      success: false, status: 'UNSUPPORTED',
      message: 'Data masking not supported', connectorType: 'postgresql',
    });
    mockPrisma.remediationAction.update
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ id: 'a-1', status: 'unsupported' });
    mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-2' });

    await service.executeAction('tenant-1', 'a-1', 'user-1');

    const updateCalls = mockPrisma.remediationAction.update.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.data.status).toBe('unsupported');
    expect(finalUpdate.data.status).not.toBe('completed');
  });

  it('should create a manual WorkflowTask for unsupported actions', async () => {
    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1', tenantId: 'tenant-1', findingId: 'f-1',
      actionType: 'encrypt', status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue({
      success: false, status: 'UNSUPPORTED',
      message: 'Not supported', connectorType: 'postgresql',
    });
    mockPrisma.remediationAction.update.mockResolvedValue({ id: 'a-1', status: 'unsupported' });
    mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-1' });

    await service.executeAction('tenant-1', 'a-1', 'user-1');

    expect(mockPrisma.workflowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskType: 'execute',
          priority: 'high',
          status: 'pending',
          metadata: expect.objectContaining({
            executionStatus: 'UNSUPPORTED',
            actionType: 'encrypt',
          }),
        }),
      }),
    );
  });

  it('should log audit event with severity warning for unsupported action', async () => {
    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1', tenantId: 'tenant-1', findingId: 'f-1',
      actionType: 'rotate_credentials', status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue({
      success: false, status: 'UNSUPPORTED',
      message: 'Not supported', connectorType: 'okta',
    });
    mockPrisma.remediationAction.update.mockResolvedValue({ id: 'a-1', status: 'unsupported' });
    mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-1' });

    await service.executeAction('tenant-1', 'a-1', 'user-1');

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'remediation.unsupported',
        severity: 'warning',
        category: 'security',
      }),
    );
  });

  it('should publish remediation.unsupported event', async () => {
    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1', tenantId: 'tenant-1', findingId: 'f-1',
      actionType: 'encrypt', status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue({
      success: false, status: 'UNSUPPORTED',
      message: 'Not supported', connectorType: 'aws_s3',
    });
    mockPrisma.remediationAction.update.mockResolvedValue({ id: 'a-1', status: 'unsupported' });
    mockPrisma.workflowTask.create.mockResolvedValue({ id: 'task-1' });

    await service.executeAction('tenant-1', 'a-1', 'user-1');

    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'remediation.unsupported' }),
    );
  });

  it('should still complete successfully when executor returns EXECUTED', async () => {
    mockPrisma.remediationAction.findFirst.mockResolvedValue({
      id: 'a-1', tenantId: 'tenant-1', findingId: 'f-1',
      actionType: 'quarantine', status: 'approved',
    });
    mockExecutor.validate.mockResolvedValue({ valid: true, message: 'ok' });
    mockExecutor.execute.mockResolvedValue({
      success: true, status: 'EXECUTED',
      message: 'Asset quarantined', connectorType: 'aws_s3',
    });
    mockPrisma.remediationAction.update
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ id: 'a-1', status: 'completed' });

    const result = await service.executeAction('tenant-1', 'a-1', 'user-1');

    expect(result.status).toBe('completed');
    expect(mockPrisma.workflowTask.create).not.toHaveBeenCalled();
  });

  // ─── Remediation Summary ──────────────────────────────────────────────────

  describe('getRemediationSummary', () => {
    it('should group actions by status and calculate automation rate', async () => {
      mockPrisma.remediationAction.groupBy.mockResolvedValue([
        { status: 'completed', _count: { id: 10 } },
        { status: 'unsupported', _count: { id: 5 } },
        { status: 'failed', _count: { id: 2 } },
        { status: 'proposed', _count: { id: 3 } },
      ]);

      const summary = await service.getRemediationSummary('tenant-1');

      expect(summary.total).toBe(20);
      expect(summary.byStatus.completed).toBe(10);
      expect(summary.byStatus.unsupported).toBe(5);
      expect(summary.automatedRate).toBe(50); // 10/20
      expect(summary.manualRequired).toBe(5);
    });

    it('should return zero automation rate when no actions exist', async () => {
      mockPrisma.remediationAction.groupBy.mockResolvedValue([]);

      const summary = await service.getRemediationSummary('tenant-1');

      expect(summary.total).toBe(0);
      expect(summary.automatedRate).toBe(0);
      expect(summary.manualRequired).toBe(0);
    });
  });
});
