import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@/modules/discovery/discovery.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { ConnectorRegistry } from '@/modules/connectors/connector-registry';

describe('DiscoveryService — Enrichment Phases', () => {
  let service: DiscoveryService;
  let prisma: any;
  let events: any;
  let connectorRegistry: any;

  const tenantId = 'tenant-enrich-1';
  const scanJobId = 'scan-job-enrich-1';

  const mockConnector = {
    initialize: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    listAssets: jest.fn().mockImplementation(async function* () {
      yield {
        externalId: 'ext-1',
        name: 'users_table',
        type: 'table',
        path: '/db/users',
        sizeBytes: 1024,
        metadata: {},
      };
    }),
    getMetadata: jest.fn().mockReturnValue({
      capabilities: {
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
      },
    }),
    getAssetSchema: jest.fn().mockResolvedValue({
      fields: [
        { name: 'email', dataType: 'varchar', ordinalPosition: 1, nullable: false },
        { name: 'name', dataType: 'varchar', ordinalPosition: 2, nullable: true },
      ],
    }),
    sampleContent: jest.fn().mockImplementation(async function* () {
      yield { fieldName: 'email', values: ['alice@example.com', 'bob@example.com'] };
      yield { fieldName: 'name', values: ['Alice', 'Bob'] };
    }),
    getAccessPolicies: jest.fn().mockResolvedValue([
      {
        principal: 'admin@corp.com',
        principalType: 'user',
        permissions: ['read', 'write'],
        source: 'iam',
      },
      {
        principal: 'everyone',
        principalType: 'public',
        permissions: ['read'],
        source: 'share_link',
      },
    ]),
  };

  beforeEach(async () => {
    prisma = {
      scanJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: scanJobId,
          tenantId,
          dataSourceId: 'ds-1',
          status: 'queued',
          config: { mode: 'full', enrichment: { schema: true, sampling: true, accessPolicies: true } },
          dataSource: { id: 'ds-1', type: 'postgresql', connectionConfig: { host: 'localhost' } },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      asset: {
        upsert: jest.fn().mockResolvedValue({ id: 'asset-1', externalId: 'ext-1' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'asset-1', externalId: 'ext-1' },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      assetField: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };

    events = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    connectorRegistry = {
      create: jest.fn().mockReturnValue(mockConnector),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EventBusService, useValue: events },
        { provide: ConnectorRegistry, useValue: connectorRegistry },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call getAssetSchema and upsert fields during schema enrichment', async () => {
    await service.executeScan(scanJobId);

    expect(mockConnector.getAssetSchema).toHaveBeenCalledWith('ext-1');
    expect(prisma.assetField.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetId_name: { assetId: 'asset-1', name: 'email' } },
        create: expect.objectContaining({
          tenantId,
          assetId: 'asset-1',
          name: 'email',
          dataType: 'varchar',
        }),
      }),
    );
  });

  it('should emit scan.schema.completed event', async () => {
    await service.executeScan(scanJobId);

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scan.schema.completed',
        tenantId,
        payload: expect.objectContaining({ fieldsPopulated: 2 }),
      }),
    );
  });

  it('should call sampleContent and update field sample values', async () => {
    await service.executeScan(scanJobId);

    expect(mockConnector.sampleContent).toHaveBeenCalledWith(
      'ext-1',
      expect.objectContaining({ maxRows: 5 }),
    );
    expect(prisma.assetField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetId: 'asset-1', name: 'email' },
        data: { sampleValues: ['alice@example.com', 'bob@example.com'] },
      }),
    );
  });

  it('should emit scan.sampling.completed event', async () => {
    await service.executeScan(scanJobId);

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scan.sampling.completed',
        tenantId,
        payload: expect.objectContaining({ fieldsSampled: 2, dataSourceId: 'ds-1' }),
      }),
    );
  });

  it('should call getAccessPolicies and store in asset', async () => {
    await service.executeScan(scanJobId);

    expect(mockConnector.getAccessPolicies).toHaveBeenCalledWith('ext-1');
    expect(prisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-1' },
        data: {
          accessPermissions: expect.arrayContaining([
            expect.objectContaining({
              principalId: 'admin@corp.com',
              principalType: 'user',
              permissions: ['read', 'write'],
            }),
          ]),
        },
      }),
    );
  });

  it('should emit scan.access.completed event', async () => {
    await service.executeScan(scanJobId);

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scan.access.completed',
        tenantId,
        payload: expect.objectContaining({ accessPoliciesCollected: 1, dataSourceId: 'ds-1' }),
      }),
    );
  });

  it('should emit scan.enrichment.completed after all phases', async () => {
    await service.executeScan(scanJobId);

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scan.enrichment.completed',
        tenantId,
        payload: expect.objectContaining({ scanJobId, dataSourceId: 'ds-1' }),
      }),
    );
  });

  it('should record enrichment stats in scanJob update', async () => {
    await service.executeScan(scanJobId);

    expect(prisma.scanJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          stats: expect.objectContaining({
            assetsDiscovered: 1,
            fieldsPopulated: 2,
            fieldsSampled: 2,
            accessPoliciesCollected: 1,
          }),
        }),
      }),
    );
  });

  it('should skip sampling when connector does not support it', async () => {
    mockConnector.getMetadata.mockReturnValue({
      capabilities: { supportsContentSampling: false, supportsAccessAnalysis: true },
    });

    await service.executeScan(scanJobId);

    expect(mockConnector.sampleContent).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'scan.sampling.completed' }),
    );
  });

  it('should skip access collection when connector does not support it', async () => {
    mockConnector.getMetadata.mockReturnValue({
      capabilities: { supportsContentSampling: true, supportsAccessAnalysis: false },
    });

    await service.executeScan(scanJobId);

    expect(mockConnector.getAccessPolicies).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'scan.access.completed' }),
    );
  });

  it('should skip enrichment phases when config disables them', async () => {
    prisma.scanJob.findUnique.mockResolvedValue({
      id: scanJobId,
      tenantId,
      dataSourceId: 'ds-1',
      status: 'queued',
      config: { mode: 'full', enrichment: { schema: false, sampling: false, accessPolicies: false } },
      dataSource: { id: 'ds-1', type: 'postgresql', connectionConfig: {} },
    });

    await service.executeScan(scanJobId);

    expect(mockConnector.getAssetSchema).not.toHaveBeenCalled();
    expect(mockConnector.sampleContent).not.toHaveBeenCalled();
    expect(mockConnector.getAccessPolicies).not.toHaveBeenCalled();
  });

  it('should continue enrichment when one asset schema call fails', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: 'asset-1', externalId: 'ext-1' },
      { id: 'asset-2', externalId: 'ext-2' },
    ]);

    mockConnector.getAssetSchema
      .mockRejectedValueOnce(new Error('Schema unavailable'))
      .mockResolvedValueOnce({
        fields: [{ name: 'id', dataType: 'int', ordinalPosition: 1, nullable: false }],
      });

    await service.executeScan(scanJobId);

    // Schema call still attempted for asset-2 despite asset-1 failure
    expect(mockConnector.getAssetSchema).toHaveBeenCalledTimes(2);
    // One field populated from asset-2
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scan.schema.completed',
        payload: expect.objectContaining({ fieldsPopulated: 1 }),
      }),
    );
  });
});
