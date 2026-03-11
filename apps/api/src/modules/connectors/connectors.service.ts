import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { ConnectorRegistry } from './connector-registry';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly registry: ConnectorRegistry,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateConnectorDto) {
    // Validate connector type is supported
    if (!this.registry.getAvailableTypes().includes(dto.type as any)) {
      throw new BadRequestException(`Unsupported connector type: ${dto.type}`);
    }

    const connector = await this.prisma.dataSource.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        authMethod: dto.authMethod,
        connectionConfig: dto.config, // TODO: Encrypt with tenant KMS key
        scanSchedule: dto.scanSchedule,
        tags: dto.tags || [],
        status: 'pending_setup',
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'connector.created',
      entityType: 'data_source',
      entityId: connector.id,
    });

    await this.events.publish({
      type: 'connector.created',
      tenantId,
      data: { connectorId: connector.id, type: dto.type },
      timestamp: new Date(),
    });

    return connector;
  }

  async findAll(
    tenantId: string,
    filters?: { type?: string; status?: string; page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, ...where } = filters || {};

    const [data, total] = await Promise.all([
      this.prisma.dataSource.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(where.type && { type: where.type }),
          ...(where.status && { status: where.status }),
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dataSource.count({
        where: {
          tenantId,
          deletedAt: null,
          ...(where.type && { type: where.type }),
          ...(where.status && { status: where.status }),
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const connector = await this.prisma.dataSource.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!connector) {
      throw new NotFoundException(`Connector ${id} not found`);
    }

    return connector;
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateConnectorDto,
  ) {
    await this.findById(tenantId, id);

    const updated = await this.prisma.dataSource.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.config && { connectionConfig: dto.config }),
        ...(dto.scanSchedule !== undefined && { scanSchedule: dto.scanSchedule }),
        ...(dto.tags && { tags: dto.tags }),
        updatedBy: userId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'connector.updated',
      entityType: 'data_source',
      entityId: id,
    });

    return updated;
  }

  async testConnection(tenantId: string, id: string) {
    const source = await this.findById(tenantId, id);
    const connector = this.registry.create(source.type as any);

    try {
      await connector.initialize({
        type: source.type as any,
        credentials: source.connectionConfig as any,
        options: {},
      });

      const result = await connector.testConnection();

      // Update status based on test result
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          status: result.success ? 'connected' : 'error',
          lastConnectedAt: result.success ? new Date() : undefined,
          metadata: result.metadata || undefined,
        },
      });

      await this.events.publish({
        type: result.success ? 'connector.tested' : 'connector.failed',
        tenantId,
        data: { connectorId: id, result },
        timestamp: new Date(),
      });

      return result;
    } finally {
      await connector.disconnect();
    }
  }

  async delete(tenantId: string, id: string, userId: string) {
    await this.findById(tenantId, id);

    // Soft delete
    await this.prisma.dataSource.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'connector.deleted',
      entityType: 'data_source',
      entityId: id,
    });
  }

  getAvailableConnectors() {
    return this.registry.getMetadata();
  }
}
