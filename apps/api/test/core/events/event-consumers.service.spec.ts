import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { EventConsumersService } from '../../../src/core/events/event-consumers.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import { WorkflowService } from '../../../src/core/workflow/workflow.service';
import { NotificationsService } from '../../../src/core/notifications/notifications.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';

describe('EventConsumersService', () => {
  let service: EventConsumersService;
  let subscribeHandlers: Map<string, (e: any) => Promise<void>>;

  const mockEvents = {
    subscribe: jest.fn(),
  };

  const mockWorkflows = {
    startBreachWorkflow: jest.fn().mockResolvedValue('wf-1'),
    startDsarWorkflow: jest.fn().mockResolvedValue('wf-2'),
  };

  const mockNotifications = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrisma = {
    incident: { create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
  };

  const mockModuleRef = {
    get: jest.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    subscribeHandlers = new Map();

    // Capture the handlers passed to subscribe
    mockEvents.subscribe.mockImplementation(
      async (event: string, _durable: string, handler: any) => {
        subscribeHandlers.set(event, handler);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventConsumersService,
        { provide: EventBusService, useValue: mockEvents },
        { provide: WorkflowService, useValue: mockWorkflows },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    service = module.get<EventConsumersService>(EventConsumersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('onModuleInit', () => {
    it('should register 14 event consumers', async () => {
      await service.onModuleInit();

      expect(mockEvents.subscribe).toHaveBeenCalledTimes(14);
    });

    it('should subscribe to incident.breach_detected', async () => {
      await service.onModuleInit();

      expect(mockEvents.subscribe).toHaveBeenCalledWith(
        'incident.breach_detected',
        'consumer-breach-workflow',
        expect.any(Function),
      );
    });

    it('should subscribe to dsar.received', async () => {
      await service.onModuleInit();

      expect(mockEvents.subscribe).toHaveBeenCalledWith(
        'dsar.received',
        'consumer-dsar-workflow',
        expect.any(Function),
      );
    });
  });

  describe('breach_detected handler', () => {
    it('should start breach workflow', async () => {
      await service.onModuleInit();
      const handler = subscribeHandlers.get('incident.breach_detected')!;

      await handler({
        type: 'incident.breach_detected',
        tenantId: 'tenant-1',
        data: { incidentId: 'inc-1', severity: 'critical' },
        timestamp: new Date(),
      });

      expect(mockWorkflows.startBreachWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentId: 'inc-1',
          tenantId: 'tenant-1',
          severity: 'critical',
        }),
      );
    });
  });

  describe('dsar.received handler', () => {
    it('should start DSAR workflow', async () => {
      await service.onModuleInit();
      const handler = subscribeHandlers.get('dsar.received')!;

      await handler({
        type: 'dsar.received',
        tenantId: 'tenant-1',
        data: { requestId: 'req-1', type: 'deletion' },
        timestamp: new Date(),
      });

      expect(mockWorkflows.startDsarWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-1',
          tenantId: 'tenant-1',
          type: 'deletion',
        }),
      );
    });
  });

  describe('incident.reported handler', () => {
    it('should send notification', async () => {
      await service.onModuleInit();
      const handler = subscribeHandlers.get('incident.reported')!;

      await handler({
        type: 'incident.reported',
        tenantId: 'tenant-1',
        data: { severity: 'critical', referenceNumber: 'INC-2026-0001' },
        timestamp: new Date(),
      });

      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'incident.reported',
          severity: 'critical',
          channels: expect.arrayContaining(['in_app', 'email', 'webhook']),
        }),
      );
    });
  });

  describe('security.unauthorized_access handler', () => {
    it('should create incident and send notification', async () => {
      mockPrisma.incident.create.mockResolvedValue({ id: 'auto-inc-1' });
      await service.onModuleInit();
      const handler = subscribeHandlers.get('security.unauthorized_access')!;

      await handler({
        type: 'security.unauthorized_access',
        tenantId: 'tenant-1',
        data: { actorId: 'bad-actor' },
        timestamp: new Date(),
      });

      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            severity: 'high',
            detectionSource: 'automated',
          }),
        }),
      );
      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security.unauthorized_access',
          severity: 'critical',
        }),
      );
    });
  });

  describe('scan.completed handler', () => {
    it('should attempt to sync graph via ModuleRef', async () => {
      const syncService = { syncAssets: jest.fn().mockResolvedValue(undefined) };
      mockModuleRef.get.mockReturnValue(syncService);

      await service.onModuleInit();
      const handler = subscribeHandlers.get('scan.completed')!;

      await handler({
        type: 'scan.completed',
        tenantId: 'tenant-1',
        data: {},
        timestamp: new Date(),
      });

      expect(mockModuleRef.get).toHaveBeenCalledWith('DataGraphSyncService', { strict: false });
      expect(syncService.syncAssets).toHaveBeenCalledWith('tenant-1');
    });

    it('should not throw when DataGraphSyncService is unavailable', async () => {
      mockModuleRef.get.mockImplementation(() => {
        throw new Error('not found');
      });

      await service.onModuleInit();
      const handler = subscribeHandlers.get('scan.completed')!;

      await expect(
        handler({
          type: 'scan.completed',
          tenantId: 'tenant-1',
          data: {},
          timestamp: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('compliance.score.changed handler', () => {
    it('should create audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
      await service.onModuleInit();
      const handler = subscribeHandlers.get('compliance.score.changed')!;

      await handler({
        type: 'compliance.score.changed',
        tenantId: 'tenant-1',
        data: { frameworkId: 'gdpr', score: 85 },
        timestamp: new Date(),
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            action: 'compliance.score.changed',
            entityType: 'compliance_score',
          }),
        }),
      );
    });
  });
});
