import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { ConnectorRegistry } from '@/modules/connectors/connector-registry';
import { StartScanDto, ScanFilterDto } from './dto/discovery.dto';

@Injectable()
export class DiscoveryService {
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
      const connector = this.connectorRegistry.get(scanJob.dataSource.type);
      const config = scanJob.dataSource.connectionConfig as Record<string, unknown>;

      let assetsDiscovered = 0;
      for await (const asset of connector.discoverAssets(config, {})) {
        const dbAsset = await this.prisma.asset.upsert({
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

        if (asset.fields) {
          for (const field of asset.fields) {
            await this.prisma.assetField.upsert({
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

        assetsDiscovered++;
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
}
