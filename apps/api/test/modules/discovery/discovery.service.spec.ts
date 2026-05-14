import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscoveryService } from '../../../src/modules/discovery/discovery.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import { ConnectorRegistry } from '../../../src/modules/connectors/connector-registry';
import { MeteringService } from '../../../src/core/metering/metering.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  const mockPrisma: any = {
    dataSource: { findFirst: jest.fn() },
    scanJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    asset: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    assetField: { upsert: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(mockPrisma)),
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };
  const mockRegistry = { create: jest.fn(), get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
        { provide: MeteringService, useValue: { record: jest.fn(), recordUsage: jest.fn(), recordBatch: jest.fn() } },
        { provide: ConnectorRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── startScan ─────────────────────────────────────────────────────────────

  describe('startScan', () => {
    it('should create a scan job and publish event', async () => {
      mockPrisma.dataSource.findFirst.mockResolvedValue({
        id: 'ds-1',
        type: 'aws_s3',
        status: 'active',
      });
      mockPrisma.scanJob.create.mockResolvedValue({
        id: 'scan-1',
        status: 'queued',
      });

      const result = await service.startScan('tenant-1', 'user-1', {
        dataSourceId: 'ds-1',
      });

      expect(result.status).toBe('queued');
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'scan.queued' }),
      );
    });

    it('should reject scan for inactive data source', async () => {
      mockPrisma.dataSource.findFirst.mockResolvedValue({
        id: 'ds-1',
        status: 'inactive',
      });

      await expect(
        service.startScan('tenant-1', 'user-1', { dataSourceId: 'ds-1' }),
      ).rejects.toThrow('Data source is not active');
    });

    it('should throw NotFoundException when data source not found', async () => {
      mockPrisma.dataSource.findFirst.mockResolvedValue(null);

      await expect(
        service.startScan('tenant-1', 'user-1', { dataSourceId: 'ds-404' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should default scan mode to incremental', async () => {
      mockPrisma.dataSource.findFirst.mockResolvedValue({ id: 'ds-1', status: 'active', type: 'aws_s3' });
      mockPrisma.scanJob.create.mockResolvedValue({ id: 'scan-1', status: 'queued' });

      await service.startScan('tenant-1', 'user-1', { dataSourceId: 'ds-1' });

      expect(mockPrisma.scanJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: expect.objectContaining({ mode: 'incremental' }),
          }),
        }),
      );
    });

    it('should create audit log for scan start', async () => {
      mockPrisma.dataSource.findFirst.mockResolvedValue({ id: 'ds-1', status: 'active', type: 'aws_s3' });
      mockPrisma.scanJob.create.mockResolvedValue({ id: 'scan-1', status: 'queued' });

      await service.startScan('tenant-1', 'user-1', { dataSourceId: 'ds-1' });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorId: 'user-1',
          action: 'scan.started',
          entityType: 'ScanJob',
        }),
      );
    });
  });

  // ─── executeScan ───────────────────────────────────────────────────────────

  describe('executeScan', () => {
    it('should throw NotFoundException for missing scan job', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue(null);

      await expect(service.executeScan('scan-404')).rejects.toThrow(NotFoundException);
    });

    it('should execute scan and upsert discovered assets', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue({
        id: 'scan-1',
        tenantId: 'tenant-1',
        dataSourceId: 'ds-1',
        dataSource: { type: 'postgresql', connectionConfig: { host: 'localhost' } },
      });
      mockPrisma.scanJob.update.mockResolvedValue({});
      mockPrisma.asset.upsert.mockResolvedValue({ id: 'asset-1' });
      mockPrisma.assetField.upsert.mockResolvedValue({});

      mockPrisma.asset.findMany.mockResolvedValue([{ id: 'asset-1', externalId: 'ext-1' }]);
      const mockConnector = {
        initialize: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listAssets: jest.fn().mockImplementation(async function* () {
          yield {
            externalId: 'ext-1',
            name: 'users',
            type: 'table',
            path: 'public.users',
            metadata: {},
            fields: [
              { name: 'id', dataType: 'integer', ordinalPosition: 0, nullable: false },
              { name: 'email', dataType: 'varchar', ordinalPosition: 1, nullable: true },
            ],
          };
        }),
        getMetadata: jest.fn().mockReturnValue({
          capabilities: { supportsContentSampling: false, supportsAccessAnalysis: false },
        }),
        getAssetSchema: jest.fn().mockResolvedValue({ fields: [] }),
      };
      mockRegistry.create.mockReturnValue(mockConnector);

      const result = await service.executeScan('scan-1');

      expect(result.status).toBe('completed');
      expect(result.assetsDiscovered).toBe(1);
      expect(mockConnector.initialize).toHaveBeenCalled();
      expect(mockConnector.disconnect).toHaveBeenCalled();
    });

    it('should mark scan as failed on connector error', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue({
        id: 'scan-1',
        tenantId: 'tenant-1',
        dataSourceId: 'ds-1',
        dataSource: { type: 'postgresql', connectionConfig: {} },
      });
      mockPrisma.scanJob.update.mockResolvedValue({});

      const mockConnector = {
        initialize: jest.fn().mockRejectedValue(new Error('Connection refused')),
        disconnect: jest.fn(),
      };
      mockRegistry.create.mockReturnValue(mockConnector);

      await expect(service.executeScan('scan-1')).rejects.toThrow('Connection refused');
      expect(mockPrisma.scanJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'scan.failed' }),
      );
    });

    it('should publish scan.started event at the beginning', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue({
        id: 'scan-1',
        tenantId: 'tenant-1',
        dataSourceId: 'ds-1',
        dataSource: { type: 'postgresql', connectionConfig: {} },
      });
      mockPrisma.scanJob.update.mockResolvedValue({});
      mockPrisma.asset.findMany.mockResolvedValue([]);
      const mockConnector = {
        initialize: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listAssets: jest.fn().mockImplementation(async function* () {}),
        getMetadata: jest.fn().mockReturnValue({
          capabilities: { supportsContentSampling: false, supportsAccessAnalysis: false },
        }),
      };
      mockRegistry.create.mockReturnValue(mockConnector);

      await service.executeScan('scan-1');

      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'scan.started' }),
      );
    });
  });

  // ─── findAllScans ──────────────────────────────────────────────────────────

  describe('findAllScans', () => {
    it('should return paginated assets', async () => {
      mockPrisma.scanJob.findMany.mockResolvedValue([{ id: 'scan-1' }]);
      mockPrisma.scanJob.count.mockResolvedValue(1);

      const result = await service.findAllScans('tenant-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('should filter by status and dataSourceId', async () => {
      mockPrisma.scanJob.findMany.mockResolvedValue([]);
      mockPrisma.scanJob.count.mockResolvedValue(0);

      await service.findAllScans('tenant-1', { status: 'completed', dataSourceId: 'ds-1' });

      expect(mockPrisma.scanJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed', dataSourceId: 'ds-1' }),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockPrisma.scanJob.findMany.mockResolvedValue([]);
      mockPrisma.scanJob.count.mockResolvedValue(55);

      const result = await service.findAllScans('tenant-1', { page: 1, pageSize: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  // ─── findAllAssets ─────────────────────────────────────────────────────────

  describe('findAllAssets', () => {
    it('should return paginated assets', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'asset-1', name: 'users_table' },
      ]);
      mockPrisma.asset.count.mockResolvedValue(1);

      const result = await service.findAllAssets('tenant-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
    });
  });

  // ─── findAssetById ─────────────────────────────────────────────────────────

  describe('findAssetById', () => {
    it('should throw NotFoundException for missing asset', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(null);

      await expect(
        service.findAssetById('tenant-1', 'asset-404'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── discoverShadowData ───────────────────────────────────────────────────

  describe('discoverShadowData', () => {
    it('should detect unowned and stale assets', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', name: 'old_table', dataSourceId: 'ds-1', fingerprint: null, ownerEmail: null, ownerUserId: null, lastScannedAt: null },
        { id: 'a2', name: 'fresh', dataSourceId: 'ds-1', fingerprint: 'fp-1', ownerEmail: 'u@t.com', ownerUserId: 'u1', lastScannedAt: new Date() },
      ]);
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.discoverShadowData('tenant-1', 'ds-1');

      expect(result.count).toBe(1);
      expect(result.unownedAssets).toBe(1);
    });

    it('should detect duplicate fingerprints across data sources', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', name: 't1', dataSourceId: 'ds-1', fingerprint: 'fp-shared', ownerEmail: 'u@t.com', ownerUserId: 'u1', lastScannedAt: new Date() },
        { id: 'a2', name: 't2', dataSourceId: 'ds-2', fingerprint: 'fp-shared', ownerEmail: 'u@t.com', ownerUserId: 'u1', lastScannedAt: new Date() },
      ]);
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.discoverShadowData('tenant-1', undefined as any);

      expect(result.duplicateFingerprints).toBeGreaterThan(0);
    });
  });

  // ─── discoverAiDatasets ────────────────────────────────────────────────────

  describe('discoverAiDatasets', () => {
    it('should detect AI datasets by name pattern', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', name: 'ml_training_data', path: '/data', dataSourceId: 'ds-1', type: 'table', sizeBytes: 1000 },
        { id: 'a2', name: 'users', path: '/data', dataSourceId: 'ds-1', type: 'table', sizeBytes: 500 },
        { id: 'a3', name: 'embeddings_store', path: '/ml', dataSourceId: 'ds-1', type: 'table', sizeBytes: 2000 },
      ]);
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.discoverAiDatasets('tenant-1');

      expect(result).toHaveLength(2);
      expect(result.map((a: any) => a.name)).toContain('ml_training_data');
      expect(result.map((a: any) => a.name)).toContain('embeddings_store');
    });

    it('should not match unrelated names', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', name: 'users', path: '/db', dataSourceId: 'ds-1', type: 'table', sizeBytes: 100 },
      ]);
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.discoverAiDatasets('tenant-1');

      expect(result).toHaveLength(0);
    });
  });

  // ─── enrichAssetMetadata ──────────────────────────────────────────────────

  describe('enrichAssetMetadata', () => {
    it('should throw NotFoundException for missing asset', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(null);

      await expect(
        service.enrichAssetMetadata('tenant-1', 'asset-404', { ownerEmail: 'a@b.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided metadata fields', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'a1', tenantId: 'tenant-1' });
      mockPrisma.asset.update.mockResolvedValue({ id: 'a1', ownerEmail: 'a@b.com' });

      await service.enrichAssetMetadata('tenant-1', 'a1', { ownerEmail: 'a@b.com' });

      const updateCall = mockPrisma.asset.update.mock.calls[0][0];
      expect(updateCall.data.ownerEmail).toBe('a@b.com');
      expect(updateCall.data.encryptionStatus).toBeUndefined();
    });
  });

  // ─── detectDuplicates ─────────────────────────────────────────────────────

  describe('detectDuplicates', () => {
    it('should group assets by fingerprint and return duplicates', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', name: 't1', dataSourceId: 'ds-1', fingerprint: 'fp-1', path: '/a', sizeBytes: 100 },
        { id: 'a2', name: 't2', dataSourceId: 'ds-1', fingerprint: 'fp-1', path: '/b', sizeBytes: 100 },
        { id: 'a3', name: 't3', dataSourceId: 'ds-2', fingerprint: 'fp-2', path: '/c', sizeBytes: 200 },
      ]);

      const result = await service.detectDuplicates('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].fingerprint).toBe('fp-1');
      expect(result[0].count).toBe(2);
    });

    it('should return empty when no duplicates', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { id: 'a1', fingerprint: 'fp-1' },
        { id: 'a2', fingerprint: 'fp-2' },
      ]);

      const result = await service.detectDuplicates('tenant-1');

      expect(result).toHaveLength(0);
    });
  });
});
