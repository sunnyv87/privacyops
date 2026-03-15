import { Test, TestingModule } from '@nestjs/testing';
import { ShadowDataService } from '@/modules/shadow-data/shadow-data.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { FingerprintService } from '@/modules/shadow-data/fingerprint.service';
import { OwnershipInferenceService } from '@/modules/shadow-data/ownership-inference.service';

describe('ShadowDataService — External Sharing & Collaboration Sprawl', () => {
  let service: ShadowDataService;
  let prisma: any;
  let events: any;

  const tenantId = 'tenant-shadow-1';
  let alertSeq = 0;

  beforeEach(async () => {
    alertSeq = 0;

    prisma = {
      asset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      shadowDataAlert: {
        create: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ id: `alert-${++alertSeq}`, ...data });
        }),
      },
      classification: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    events = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const mockFingerprint = {
      findDuplicates: jest.fn().mockResolvedValue([]),
    };

    const mockOwnership = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShadowDataService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EventBusService, useValue: events },
        { provide: FingerprintService, useValue: mockFingerprint },
        { provide: OwnershipInferenceService, useValue: mockOwnership },
      ],
    }).compile();

    service = module.get<ShadowDataService>(ShadowDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Strategy 4: External sharing detection', () => {
    it('should create external_sharing alert when assets have public principals', async () => {
      // First findMany call: Strategy 2 (unmanaged)
      // Second findMany call: Strategy 3 (orphaned)
      // Third findMany call: Strategy 4 (assets with accessPermissions)
      // Fourth findMany call: Strategy 5 (collaboration assets)
      prisma.asset.findMany
        .mockResolvedValueOnce([]) // Strategy 2 — unmanaged
        .mockResolvedValueOnce([]) // Strategy 3 — all assets for orphan check
        .mockResolvedValueOnce([   // Strategy 4 — assets with accessPermissions
          {
            id: 'asset-pub-1',
            name: 'public_report.xlsx',
            type: 'file',
            accessPermissions: [
              { principalType: 'public', permissions: ['read'] },
            ],
            dataSourceId: 'ds-1',
          },
        ])
        .mockResolvedValueOnce([]); // Strategy 5 — collaboration

      const result = await service.detectShadowData(tenantId);

      expect(prisma.shadowDataAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'external_sharing',
            severity: 'high',
            title: expect.stringContaining('1 asset(s) with external/public sharing'),
            affectedAssets: ['asset-pub-1'],
          }),
        }),
      );

      expect(result.alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect external principalType', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'asset-ext-1',
            name: 'shared_doc.pdf',
            type: 'file',
            accessPermissions: [
              { principalType: 'external', permissions: ['read', 'write'] },
            ],
            dataSourceId: 'ds-1',
          },
        ])
        .mockResolvedValueOnce([]);

      await service.detectShadowData(tenantId);

      expect(prisma.shadowDataAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'external_sharing',
            affectedAssets: ['asset-ext-1'],
          }),
        }),
      );
    });

    it('should not create alert when no public/external sharing exists', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'asset-internal',
            name: 'internal_doc.pdf',
            type: 'file',
            accessPermissions: [
              { principalType: 'user', permissions: ['read'] },
            ],
            dataSourceId: 'ds-1',
          },
        ])
        .mockResolvedValueOnce([]);

      await service.detectShadowData(tenantId);

      const externalAlertCalls = (prisma.shadowDataAlert.create as jest.Mock).mock.calls
        .filter(([call]: any) => call.data.alertType === 'external_sharing');

      expect(externalAlertCalls.length).toBe(0);
    });
  });

  describe('Strategy 5: Collaboration sprawl', () => {
    it('should create collaboration_sprawl alert for classified assets in personal spaces', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])  // Strategy 4 — no external sharing
        .mockResolvedValueOnce([    // Strategy 5 — collaboration assets
          {
            id: 'asset-sprawl-1',
            name: 'My Drive/financial_report.xlsx',
            type: 'file',
            path: '/users/alice/My Drive/financial_report.xlsx',
          },
        ]);

      await service.detectShadowData(tenantId);

      expect(prisma.shadowDataAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'collaboration_sprawl',
            severity: 'medium',
            affectedAssets: ['asset-sprawl-1'],
          }),
        }),
      );
    });

    it('should detect private channel patterns', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'asset-dm-1',
            name: 'sensitive_data.csv',
            type: 'file',
            path: '/direct message/user123/sensitive_data.csv',
          },
        ]);

      await service.detectShadowData(tenantId);

      expect(prisma.shadowDataAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'collaboration_sprawl',
            affectedAssets: ['asset-dm-1'],
          }),
        }),
      );
    });

    it('should detect personal pattern in name', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'asset-personal-1',
            name: 'personal backup.zip',
            type: 'file',
            path: '/shared/backup',
          },
        ]);

      await service.detectShadowData(tenantId);

      expect(prisma.shadowDataAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'collaboration_sprawl',
            affectedAssets: ['asset-personal-1'],
          }),
        }),
      );
    });

    it('should not create sprawl alert for non-personal paths', async () => {
      prisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'asset-shared-1',
            name: 'team_report.xlsx',
            type: 'file',
            path: '/shared/team/reports/team_report.xlsx',
          },
        ]);

      await service.detectShadowData(tenantId);

      const sprawlCalls = (prisma.shadowDataAlert.create as jest.Mock).mock.calls
        .filter(([call]: any) => call.data.alertType === 'collaboration_sprawl');

      expect(sprawlCalls.length).toBe(0);
    });
  });

  describe('Event publication', () => {
    it('should publish shadow-data.scan.completed with alert count', async () => {
      prisma.asset.findMany.mockResolvedValue([]);

      await service.detectShadowData(tenantId);

      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'shadow-data.scan.completed',
          tenantId,
          data: expect.objectContaining({ alertCount: expect.any(Number) }),
        }),
      );
    });
  });
});
