import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class PlatformAlertService {
  private readonly logger = new Logger(PlatformAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create a platform alert
  // ---------------------------------------------------------------------------

  async createAlert(
    tenantId: string | null,
    alertType: string,
    severity: string,
    source: string,
    message: string,
    metadata?: any,
  ) {
    const alert = await this.prisma.platformAlert.create({
      data: {
        tenantId,
        alertType,
        severity,
        source,
        message,
        metadata: metadata || null,
        status: 'active',
      },
    });

    await this.events.publish({
      type: 'platform.alert_created',
      tenantId: tenantId || '',
      data: {
        alertId: alert.id,
        alertType,
        severity,
        source,
        message,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Platform alert created: [${severity}] ${alertType} from ${source}`,
    );

    return alert;
  }

  // ---------------------------------------------------------------------------
  // Get alerts with pagination
  // ---------------------------------------------------------------------------

  async getAlerts(filters: {
    tenantId?: string;
    alertType?: string;
    severity?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.alertType) where.alertType = filters.alertType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const [data, totalItems] = await Promise.all([
      this.prisma.platformAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.platformAlert.count({ where }),
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
  // Acknowledge an alert
  // ---------------------------------------------------------------------------

  async acknowledgeAlert(id: string, userId: string) {
    const alert = await this.prisma.platformAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${id} not found`);
    }

    const updated = await this.prisma.platformAlert.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedBy: userId,
      },
    });

    await this.audit.log({
      tenantId: alert.tenantId || undefined,
      actorId: userId,
      actorType: 'user',
      action: 'platform_alert.acknowledged',
      entityType: 'platform_alert',
      entityId: id,
      changes: {
        before: { status: alert.status },
        after: { status: 'acknowledged', acknowledgedBy: userId },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Resolve an alert
  // ---------------------------------------------------------------------------

  async resolveAlert(id: string) {
    const alert = await this.prisma.platformAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${id} not found`);
    }

    const updated = await this.prisma.platformAlert.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Alert statistics
  // ---------------------------------------------------------------------------

  async getAlertStats(tenantId?: string) {
    const where: Record<string, any> = {};
    if (tenantId) where.tenantId = tenantId;

    const [byType, bySeverity, byStatus] = await Promise.all([
      this.prisma.platformAlert.groupBy({
        by: ['alertType'],
        where,
        _count: { id: true },
      }),
      this.prisma.platformAlert.groupBy({
        by: ['severity'],
        where,
        _count: { id: true },
      }),
      this.prisma.platformAlert.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      byType: byType.reduce(
        (acc, item) => {
          acc[item.alertType] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
      bySeverity: bySeverity.reduce(
        (acc, item) => {
          acc[item.severity] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
