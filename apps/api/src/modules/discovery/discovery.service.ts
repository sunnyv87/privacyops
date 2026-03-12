import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { ConnectorRegistry } from '@/modules/connectors/connector-registry';
import { StartScanDto, ScanFilterDto, EnrichAssetMetadataDto } from './dto/discovery.dto';

const AI_DATASET_PATTERNS = [
  /training/i,
  /model/i,
  /dataset/i,
  /\bml_/i,
  /\bai_/i,
  /embeddings/i,
];

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly connectorRegistry: ConnectorRegistry,
  ) {}

  async startScan(tenantId: string, actorId: string, dto: StartScanDto) {
    const dataSource = await this.prisma.dataSource.findFirst({
      where: { id: dto.dataSourceId, tenantId },
    });
    if (!dataSource) {
      throw new NotFoundException(`Data source ${dto.dataSourceId} not found`);
    }
    if (dataSource.status !== 'active') {
      throw new BadRequestException('Data source is not active. Test connection first.');
    }

    const scanJob = await this.prisma.scanJob.create({
      data: {
        tenantId,
        dataSourceId: dto.dataSourceId,
        status: 'queued',
        config: {
          mode: dto.mode || 'incremental',
          includePaths: dto.includePaths || [],
          excludePaths: dto.excludePaths || [],
        },
        startedBy: actorId,
      },
    });

    await this.events.publish({
      type: 'scan.queued',
      tenantId,
      payload: {
        scanJobId: scanJob.id,
        dataSourceId: dto.dataSourceId,
        dataSourceType: dataSource.type,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: 'scan.started',
      entityType: 'ScanJob',
      entityId: scanJob.id,
      changes: { dataSourceId: dto.dataSourceId, mode: dto.mode },
    });

    return scanJob;
  }

  async executeScan(scanJobId: string) {
    const scanJob = await this.prisma.scanJob.findUnique({
      where: { id: scanJobId },
      include: { dataSource: true },
    });
    if (!scanJob) throw new NotFoundException(`Scan job ${scanJobId} not found`);

    await this.prisma.scanJob.update({
      where: { id: scanJobId },
      data: { status: 'running', startedAt: new Date() },
    });

    await this.events.publish({
      type: 'scan.started',
      tenantId: scanJob.tenantId,
      payload: { scanJobId },
    });

    try {
      const connector = this.connectorRegistry.create(scanJob.dataSource.type as any);
      const config = scanJob.dataSource.connectionConfig as Record<string, unknown>;

      await connector.initialize({
        type: scanJob.dataSource.type as any,
        credentials: config,
        options: {},
      });

      let assetsDiscovered = 0;
      const BATCH_SIZE = 100;
      let batch: any[] = [];

      const flushBatch = async (items: any[]) => {
        if (items.length === 0) return;

        // Batch upsert assets and fields within a single transaction
        await this.prisma.$transaction(async (tx: any) => {
          for (const asset of items) {
            const dbAsset = await tx.asset.upsert({
              where: {
                tenantId_dataSourceId_externalId: {
                  tenantId: scanJob.tenantId,
                  dataSourceId: scanJob.dataSourceId,
                  externalId: asset.externalId,
                },
              },
              create: {
                tenantId: scanJob.tenantId,
                dataSourceId: scanJob.dataSourceId,
                externalId: asset.externalId,
                name: asset.name,
                type: asset.type,
                path: asset.path,
                sizeBytes: asset.sizeBytes,
                rowCountEstimate: asset.rowCountEstimate,
                metadata: asset.metadata || {},
              },
              update: {
                name: asset.name,
                sizeBytes: asset.sizeBytes,
                rowCountEstimate: asset.rowCountEstimate,
                metadata: asset.metadata || {},
                lastScannedAt: new Date(),
              },
            });

            if (asset.fields && asset.fields.length > 0) {
              for (const field of asset.fields) {
                await tx.assetField.upsert({
                  where: {
                    assetId_name: { assetId: dbAsset.id, name: field.name },
                  },
                  create: {
                    tenantId: scanJob.tenantId,
                    assetId: dbAsset.id,
                    name: field.name,
                    dataType: field.dataType,
                    ordinalPosition: field.ordinalPosition,
                    nullable: field.nullable ?? true,
                  },
                  update: { dataType: field.dataType },
                });
              }
            }
          }
        });
      };

      try {
      for await (const asset of connector.listAssets()) {
        batch.push(asset);
        assetsDiscovered++;

        if (batch.length >= BATCH_SIZE) {
          await flushBatch(batch);
          batch = [];
        }
      }
      // Flush remaining
      await flushBatch(batch);
      } finally {
        await connector.disconnect();
      }

      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          assetsDiscovered,
        },
      });

      await this.events.publish({
        type: 'scan.completed',
        tenantId: scanJob.tenantId,
        payload: { scanJobId, assetsDiscovered },
      });

      return { scanJobId, status: 'completed', assetsDiscovered };
    } catch (error) {
      await this.prisma.scanJob.update({
        where: { id: scanJobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await this.events.publish({
        type: 'scan.failed',
        tenantId: scanJob.tenantId,
        payload: { scanJobId, error: error instanceof Error ? error.message : 'Unknown' },
      });

      throw error;
    }
  }

  async findAllScans(
    tenantId: string,
    filters?: ScanFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, dataSourceId, status } = filters || {};
    const where: any = { tenantId };
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (status) where.status = status;

    const [data, totalItems] = await Promise.all([
      this.prisma.scanJob.findMany({
        where,
        include: { dataSource: { select: { name: true, type: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scanJob.count({ where }),
    ]);

    return {
      data,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  }

  async findScanById(tenantId: string, id: string) {
    const scan = await this.prisma.scanJob.findFirst({
      where: { id, tenantId },
      include: { dataSource: { select: { name: true, type: true } } },
    });
    if (!scan) throw new NotFoundException(`Scan job ${id} not found`);
    return scan;
  }

  async findAllAssets(
    tenantId: string,
    filters?: { dataSourceId?: string; type?: string; page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, dataSourceId, type } = filters || {};
    const where: any = { tenantId };
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (type) where.type = type;

    const [data, totalItems] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          dataSource: { select: { name: true, type: true } },
          _count: { select: { classifications: true, riskFindings: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  }

  async findAssetById(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId },
      include: {
        dataSource: { select: { name: true, type: true } },
        fields: true,
        classifications: { include: { label: true } },
        riskFindings: true,
      },
    });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  async discoverShadowData(tenantId: string, dataSourceId: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    // Find assets with fingerprints matching assets in other data sources
    const allAssets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        dataSourceId: true,
        fingerprint: true,
        ownerEmail: true,
        ownerUserId: true,
        lastScannedAt: true,
      },
    });

    // Build fingerprint groups across data sources
    const fingerprintMap = new Map<string, typeof allAssets>();
    for (const asset of allAssets) {
      if (asset.fingerprint) {
        const group = fingerprintMap.get(asset.fingerprint) || [];
        group.push(asset);
        fingerprintMap.set(asset.fingerprint, group);
      }
    }

    const shadowAssets: { id: string; name: string; dataSourceId: string; reason: string }[] = [];
    const shadowAssetIds = new Set<string>();
    let duplicateFingerprints = 0;
    let unownedAssets = 0;
    let staleAssets = 0;

    for (const asset of allAssets) {
      if (dataSourceId && asset.dataSourceId !== dataSourceId) continue;

      const reasons: string[] = [];

      // Check fingerprint duplicates across different data sources
      if (asset.fingerprint) {
        const group = fingerprintMap.get(asset.fingerprint) || [];
        const crossSource = group.filter((a) => a.dataSourceId !== asset.dataSourceId);
        if (crossSource.length > 0) {
          reasons.push('duplicate_fingerprint_across_sources');
          duplicateFingerprints++;
        }
      }

      // Check for no owner
      if (!asset.ownerEmail && !asset.ownerUserId) {
        reasons.push('no_owner');
        unownedAssets++;
      }

      // Check stale (not scanned in 180+ days)
      if (!asset.lastScannedAt || asset.lastScannedAt < cutoffDate) {
        reasons.push('stale_not_scanned_180_days');
        staleAssets++;
      }

      if (reasons.length > 0) {
        shadowAssets.push({
          id: asset.id,
          name: asset.name,
          dataSourceId: asset.dataSourceId,
          reason: reasons.join(', '),
        });
        shadowAssetIds.add(asset.id);
      }
    }

    // Mark shadow data assets in bulk
    if (shadowAssetIds.size > 0) {
      await this.prisma.asset.updateMany({
        where: { id: { in: Array.from(shadowAssetIds) }, tenantId },
        data: { isShadowData: true },
      });
    }

    this.logger.log(
      `Shadow data discovery for tenant ${tenantId}: ${shadowAssets.length} shadow asset(s) found`,
    );

    return {
      count: shadowAssets.length,
      duplicateFingerprints,
      unownedAssets,
      staleAssets,
      assets: shadowAssets,
    };
  }

  async discoverAiDatasets(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        path: true,
        dataSourceId: true,
        type: true,
        sizeBytes: true,
        lastScannedAt: true,
      },
    });

    const aiAssets = assets.filter((asset) => {
      const nameOrPath = `${asset.name} ${asset.path || ''}`;
      return AI_DATASET_PATTERNS.some((pattern) => pattern.test(nameOrPath));
    });

    // Mark AI dataset assets in bulk
    if (aiAssets.length > 0) {
      await this.prisma.asset.updateMany({
        where: { id: { in: aiAssets.map((a) => a.id) }, tenantId },
        data: { isAiDataset: true },
      });
    }

    this.logger.log(
      `AI dataset discovery for tenant ${tenantId}: ${aiAssets.length} AI dataset(s) found`,
    );

    return aiAssets;
  }

  async enrichAssetMetadata(
    tenantId: string,
    assetId: string,
    metadata: EnrichAssetMetadataDto,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);

    const updateData: any = {};
    if (metadata.ownerEmail !== undefined) updateData.ownerEmail = metadata.ownerEmail;
    if (metadata.encryptionStatus !== undefined) updateData.encryptionStatus = metadata.encryptionStatus;
    if (metadata.storageLocation !== undefined) updateData.storageLocation = metadata.storageLocation;
    if (metadata.accessPermissions !== undefined) updateData.accessPermissions = metadata.accessPermissions;

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: updateData,
    });

    this.logger.log(`Asset ${assetId} metadata enriched for tenant ${tenantId}`);

    return updated;
  }

  async detectDuplicates(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        fingerprint: { not: null },
      },
      select: {
        id: true,
        name: true,
        dataSourceId: true,
        fingerprint: true,
        path: true,
        sizeBytes: true,
      },
    });

    // Group by fingerprint
    const groups = new Map<string, typeof assets>();
    for (const asset of assets) {
      const fp = asset.fingerprint!;
      const group = groups.get(fp) || [];
      group.push(asset);
      groups.set(fp, group);
    }

    // Return only groups with duplicates (count > 1)
    const duplicateGroups: { fingerprint: string; count: number; assets: typeof assets }[] = [];
    for (const [fingerprint, group] of groups) {
      if (group.length > 1) {
        duplicateGroups.push({ fingerprint, count: group.length, assets: group });
      }
    }

    return duplicateGroups;
  }
}
