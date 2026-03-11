import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '../../../src/modules/discovery/discovery.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';
import { ConnectorRegistry } from '../../../src/modules/connectors/connector-registry';

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  const mockPrisma = {
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
      count: jest.fn(),
    },
    assetField: { upsert: jest.fn() },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };
  const mockRegistry = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
        { provide: ConnectorRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => jest.clearAllMocks());

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
  });

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
});
