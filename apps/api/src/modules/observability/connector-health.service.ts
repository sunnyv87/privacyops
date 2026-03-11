import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class ConnectorHealthService {
  private readonly logger = new Logger(ConnectorHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Check health of a single connector
  // ---------------------------------------------------------------------------

  async checkHealth(tenantId: string, dataSourceId: string) {
    const dataSource = await this.prisma.dataSource.findFirst({
      where: { id: dataSourceId, tenantId },
    });

    // Simulate health check
    const start = Date.now();
    let healthStatus = 'healthy';
    let errorMessage: string | null = null;
    const checksPerformed = {
      connectivity: true,
      authentication: true,
      readAccess: true,
    };

    if (!dataSource) {
      healthStatus = 'unreachable';
      errorMessage = `Data source ${dataSourceId} not found`;
      checksPerformed.connectivity = false;
      checksPerformed.authentication = false;
      checksPerformed.readAccess = false;
    } else if (dataSource.status === 'error') {
      healthStatus = 'unhealthy';
      errorMessage = 'Data source is in error state';
      checksPerformed.readAccess = false;
    } else if (dataSource.status === 'pending_setup') {
      healthStatus = 'degraded';
      errorMessage = 'Data source setup is incomplete';
      checksPerformed.readAccess = false;
    }

    const responseTimeMs = Date.now() - start;

    const log = await this.prisma.connectorHealthLog.create({
      data: {
        tenantId,
        dataSourceId,
        healthStatus,
        responseTimeMs,
        errorMessage,
        checksPerformed,
      },
    });

    // Publish event if unhealthy
    if (healthStatus !== 'healthy') {
      await this.events.publish({
        type: 'connector.health_degraded',
        tenantId,
        data: {
          dataSourceId,
          healthStatus,
          errorMessage,
        },
        timestamp: new Date(),
      });
    }

    return log;
  }

  // ---------------------------------------------------------------------------
  // Check all connectors for a tenant
  // ---------------------------------------------------------------------------

  async checkAllConnectors(tenantId: string) {
    const dataSources = await this.prisma.dataSource.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const results = [];
    for (const ds of dataSources) {
      const result = await this.checkHealth(tenantId, ds.id);
      results.push(result);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Get health logs with pagination
  // ---------------------------------------------------------------------------

  async getHealthLogs(
    tenantId: string,
    filters: {
      dataSourceId?: string;
      healthStatus?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = { tenantId };
    if (filters.dataSourceId) where.dataSourceId = filters.dataSourceId;
    if (filters.healthStatus) where.healthStatus = filters.healthStatus;

    const [data, totalItems] = await Promise.all([
      this.prisma.connectorHealthLog.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.connectorHealthLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Health summary — count by status
  // ---------------------------------------------------------------------------

  async getHealthSummary(tenantId: string) {
    // Get latest health check for each data source
    const dataSources = await this.prisma.dataSource.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    const summary: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unreachable: 0,
    };

    const details = [];

    for (const ds of dataSources) {
      const latestLog = await this.prisma.connectorHealthLog.findFirst({
        where: { tenantId, dataSourceId: ds.id },
        orderBy: { checkedAt: 'desc' },
      });

      const status = latestLog?.healthStatus || 'unreachable';
      summary[status] = (summary[status] || 0) + 1;
      details.push({
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        healthStatus: status,
        lastChecked: latestLog?.checkedAt || null,
      });
    }

    return {
      summary,
      totalConnectors: dataSources.length,
      details,
    };
  }
}
