import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledJobsService } from '../../../src/core/workflow/scheduled-jobs.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { WorkflowService } from '../../../src/core/workflow/workflow.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import { NotificationsService } from '../../../src/core/notifications/notifications.service';

describe('ScheduledJobsService', () => {
  let service: ScheduledJobsService;

  const mockPrisma = {
    tenant: { findMany: jest.fn() },
    retentionPolicy: { findMany: jest.fn() },
    asset: { findMany: jest.fn() },
    dataSource: { findMany: jest.fn() },
    vendor: { findMany: jest.fn() },
    incident: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };

  const mockWorkflows = {
    startRetentionDisposalWorkflow: jest.fn(),
  };

  const mockEvents = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotifications = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledJobsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowService, useValue: mockWorkflows },
        { provide: EventBusService, useValue: mockEvents },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ScheduledJobsService>(ScheduledJobsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('enforceRetentionPolicies', () => {
    it('should publish retention.policy.triggered for expired assets', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.retentionPolicy.findMany.mockResolvedValue([
        { id: 'policy-1', retentionPeriodDays: 365, status: 'active' },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'asset-1' },
        { id: 'asset-2' },
      ]);

      await service.enforceRetentionPolicies();

      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'retention.policy.triggered',
          tenantId: 'tenant-1',
          data: expect.objectContaining({
            policyId: 'policy-1',
            assetCount: 2,
          }),
        }),
      );
    });

    it('should skip tenants with no expired assets', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.retentionPolicy.findMany.mockResolvedValue([
        { id: 'policy-1', retentionPeriodDays: 365, status: 'active' },
      ]);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await service.enforceRetentionPolicies();

      expect(mockEvents.publish).not.toHaveBeenCalled();
    });
  });

  describe('reviewStaleData', () => {
    it('should send notification for stale data sources', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.dataSource.findMany.mockResolvedValue([
        { id: 'ds-1', name: 'Production DB' },
      ]);

      await service.reviewStaleData();

      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'stale_data.review_needed',
          severity: 'warning',
        }),
      );
    });

    it('should not send notification when all sources are fresh', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.dataSource.findMany.mockResolvedValue([]);

      await service.reviewStaleData();

      expect(mockNotifications.send).not.toHaveBeenCalled();
    });
  });

  describe('monitorBreachSlas', () => {
    it('should alert when breach SLA is near expiration', async () => {
      // Breach reported 66 hours ago (6 hours remaining < 12 threshold)
      const sixtyHoursAgo = new Date(Date.now() - 66 * 60 * 60 * 1000);
      mockPrisma.incident.findMany.mockResolvedValue([
        {
          id: 'inc-1',
          tenantId: 'tenant-1',
          severity: 'critical',
          reportedAt: sixtyHoursAgo,
          title: 'Data breach',
        },
      ]);

      await service.monitorBreachSlas();

      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'breach.sla_warning',
          severity: 'critical',
        }),
      );
    });

    it('should alert when breach SLA has been exceeded', async () => {
      // Breach reported 80 hours ago (exceeded 72h)
      const eightyHoursAgo = new Date(Date.now() - 80 * 60 * 60 * 1000);
      mockPrisma.incident.findMany.mockResolvedValue([
        {
          id: 'inc-2',
          tenantId: 'tenant-1',
          severity: 'critical',
          reportedAt: eightyHoursAgo,
          title: 'Old breach',
        },
      ]);

      await service.monitorBreachSlas();

      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'breach.sla_exceeded',
        }),
      );
    });

    it('should not alert when breach has plenty of time remaining', async () => {
      // Breach reported 1 hour ago (71 hours remaining)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.incident.findMany.mockResolvedValue([
        {
          id: 'inc-3',
          tenantId: 'tenant-1',
          severity: 'high',
          reportedAt: oneHourAgo,
          title: 'Fresh breach',
        },
      ]);

      await service.monitorBreachSlas();

      expect(mockNotifications.send).not.toHaveBeenCalled();
    });
  });

  describe('sendVendorReassessmentReminders', () => {
    it('should publish vendor.assessment.due events', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.vendor.findMany.mockResolvedValue([
        {
          id: 'vendor-1',
          name: 'Acme Corp',
          nextReviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      ]);

      await service.sendVendorReassessmentReminders();

      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vendor.assessment.due',
          data: expect.objectContaining({
            vendorId: 'vendor-1',
            vendorName: 'Acme Corp',
          }),
        }),
      );
    });
  });

  describe('performAccessReview', () => {
    it('should notify about inactive users', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'old@example.com',
          name: 'Old User',
          lastLoginAt: new Date('2025-01-01'),
        },
      ]);

      await service.performAccessReview();

      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'access.review_needed',
        }),
      );
    });
  });
});
