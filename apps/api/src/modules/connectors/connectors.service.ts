import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { CryptoService } from '@/core/crypto/crypto.service';
import { MeteringService } from '@/core/metering/metering.service';
import { ConnectorRegistry } from './connector-registry';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';

/** Fields to strip from connector objects in API responses */
const CREDENTIAL_FIELDS_REDACTED = '[REDACTED]';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly registry: ConnectorRegistry,
    private readonly crypto: CryptoService,
    private readonly metering: MeteringService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateConnectorDto) {
    // Validate connector type is supported
    if (!this.registry.getAvailableTypes().includes(dto.type as any)) {
      throw new BadRequestException(`Unsupported connector type: ${dto.type}`);
    }

    // Encrypt credentials before storage using envelope encryption
    const encryptedConfig = await this.crypto.encryptJson(
      dto.config,
      `tenant:${tenantId}`,
    );

    const connector = await this.prisma.dataSource.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        authMethod: dto.authMethod,
        connectionConfig: encryptedConfig,
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
    const { page = 1, pageSize: rawPageSize = 20, ...where } = filters || {};
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

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
      data: data.map((c) => this.redactCredentials(c)),
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

    return this.redactCredentials(connector);
  }

  /** Fetch raw dataSource record without redaction — internal use only. */
  private async getRawSource(tenantId: string, id: string) {
    const source = await this.prisma.dataSource.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!source) {
      throw new NotFoundException(`Connector ${id} not found`);
    }
    return source;
  }

  /**
   * Decrypt connectionConfig for internal use (e.g., test/health). Never
   * expose to API.
   *
   * Plaintext fallback was REMOVED — any unparseable ciphertext is a
   * migration failure and must raise an error rather than silently returning
   * plaintext credentials. A legacy migration script should re-encrypt
   * pre-existing rows out-of-band.
   */
  private async decryptConfig(tenantId: string, encryptedConfig: any): Promise<any> {
    // Support migrating from legacy unencrypted object configs only when the
    // ALLOW_LEGACY_PLAINTEXT_CONFIG env flag is set (used by the migration
    // command). Production instances must never set this flag.
    if (!encryptedConfig) {
      return encryptedConfig;
    }

    if (typeof encryptedConfig !== 'string') {
      if (process.env.ALLOW_LEGACY_PLAINTEXT_CONFIG === 'true') {
        this.logger.warn(
          'Accepting legacy plaintext connector config (ALLOW_LEGACY_PLAINTEXT_CONFIG is set)',
        );
        return encryptedConfig;
      }
      throw new Error(
        'Connector config is not in encrypted format; run the re-encrypt migration',
      );
    }

    // `string` format: must be a valid ciphertext envelope. Any decryption
    // failure is fatal — we do NOT fall back to returning the raw string
    // which would leak the (possibly sensitive) encrypted blob back through
    // the internal API path as if it were plaintext.
    return this.crypto.decryptJson(encryptedConfig, `tenant:${tenantId}`);
  }

  /** Strip credentials from connector objects before returning to API consumers */
  private redactCredentials(connector: any): any {
    if (!connector) return connector;
    return {
      ...connector,
      connectionConfig: connector.connectionConfig ? CREDENTIAL_FIELDS_REDACTED : null,
    };
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateConnectorDto,
  ) {
    await this.findById(tenantId, id);

    // Encrypt updated credentials if provided
    let encryptedConfig: string | undefined;
    if (dto.config) {
      encryptedConfig = await this.crypto.encryptJson(
        dto.config,
        `tenant:${tenantId}`,
      );
    }

    const updated = await this.prisma.dataSource.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(encryptedConfig && { connectionConfig: encryptedConfig }),
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
    const source = await this.getRawSource(tenantId, id);
    const connector = this.registry.create(source.type as any);
    const decryptedConfig = await this.decryptConfig(tenantId, source.connectionConfig);

    try {
      await connector.initialize({
        type: source.type as any,
        credentials: decryptedConfig as any,
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

      if (result.success) {
        this.metering.record(tenantId, 'connector_sync', 1, {
          source: 'connectors.testConnection',
          metadata: { connectorId: id, type: source.type },
        });
      }

      return result;
    } catch (err) {
      this.logger.error(
        `Connector test failed for ${source.type}(${id}): ${(err as Error).message}`,
      );
      await this.prisma.dataSource.update({
        where: { id },
        data: { status: 'error' },
      });
      // Return a sanitized error — never expose driver stack traces, hostnames, or credentials
      return {
        success: false,
        message: 'Connection test failed. Check credentials and network configuration.',
      };
    } finally {
      try { await connector.disconnect(); } catch { /* best-effort */ }
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

  async healthCheck(tenantId: string, id: string) {
    const source = await this.getRawSource(tenantId, id);
    const connector = this.registry.create(source.type as any);
    const decryptedConfig = await this.decryptConfig(tenantId, source.connectionConfig);

    try {
      await connector.initialize({
        type: source.type as any,
        credentials: decryptedConfig as any,
        options: {},
      });

      const result = await connector.testConnection();

      await this.prisma.dataSource.update({
        where: { id },
        data: {
          healthStatus: result.success ? 'healthy' : 'unhealthy',
          lastHealthCheck: new Date(),
          status: result.success ? 'connected' : 'error',
          lastConnectedAt: result.success ? new Date() : undefined,
        },
      });

      await this.events.publish({
        type: 'connector.health_checked',
        tenantId,
        data: { connectorId: id, healthy: result.success, message: result.message },
        timestamp: new Date(),
      });

      return {
        connectorId: id,
        healthy: result.success,
        message: result.message,
        checkedAt: new Date(),
        metadata: result.metadata,
      };
    } catch (error: any) {
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          healthStatus: 'unhealthy',
          lastHealthCheck: new Date(),
          status: 'error',
        },
      });

      return {
        connectorId: id,
        healthy: false,
        message: `Health check failed: ${error.message}`,
        checkedAt: new Date(),
      };
    } finally {
      await connector.disconnect();
    }
  }

  async getHealthSummary(tenantId: string) {
    const connectors = await this.prisma.dataSource.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        healthStatus: true,
        lastHealthCheck: true,
        lastConnectedAt: true,
      },
    });

    const summary = {
      total: connectors.length,
      healthy: connectors.filter((c) => c.healthStatus === 'healthy').length,
      unhealthy: connectors.filter((c) => c.healthStatus === 'unhealthy').length,
      unknown: connectors.filter((c) => !c.healthStatus).length,
      connectors,
    };

    return summary;
  }

  getAvailableConnectors() {
    return this.registry.getMetadata();
  }
}
