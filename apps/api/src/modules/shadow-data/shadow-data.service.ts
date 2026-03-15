import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { FingerprintService } from './fingerprint.service';
import { OwnershipInferenceService } from './ownership-inference.service';
import { ShadowDataAlertFilterDto } from './dto/shadow-data.dto';

@Injectable()
export class ShadowDataService {
  private readonly logger = new Logger(ShadowDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly fingerprint: FingerprintService,
    private readonly ownershipInference: OwnershipInferenceService,
  ) {}

  async detectShadowData(tenantId: string) {
    this.logger.log(`Running shadow data detection for tenant ${tenantId}`);
    const alerts: any[] = [];

    // Strategy 1: Find duplicate data
    const duplicates = await this.fingerprint.findDuplicates(tenantId);
    for (const dup of duplicates) {
      const alert = await this.prisma.shadowDataAlert.create({
        data: {
          tenantId,
          alertType: 'duplicate_data',
          severity: 'medium',
          status: 'open',
          title: `Duplicate data detected across ${dup.count} assets`,
          description: `Assets sharing fingerprint ${dup.fingerprint.substring(0, 12)}...`,
          affectedAssets: dup.assets.map((a: any) => a.id),
          metadata: { fingerprint: dup.fingerprint, assets: dup.assets },
        },
      });
      alerts.push(alert);
    }

    // Strategy 2: Find unmanaged stores (assets with no data source or no classifications)
    const unmanagedAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { dataSourceId: null },
          { classifications: { none: {} } },
        ],
      },
      select: { id: true, name: true, type: true },
    });

    if (unmanagedAssets.length > 0) {
      const alert = await this.prisma.shadowDataAlert.create({
        data: {
          tenantId,
          alertType: 'unmanaged_store',
          severity: 'high',
          status: 'open',
          title: `${unmanagedAssets.length} unmanaged data store(s) detected`,
          description: 'Assets without data source assignment or classification.',
          affectedAssets: unmanagedAssets.map((a) => a.id),
          metadata: { assets: unmanagedAssets },
        },
      });
      alerts.push(alert);
    }

    // Strategy 3: Find orphaned data (assets with unknown ownership)
    const allAssets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, metadata: true },
    });

    const orphaned = allAssets.filter((a) => {
      const meta = (a.metadata as Record<string, any>) || {};
      return !meta.createdBy && !meta.owner;
    });

    if (orphaned.length > 0) {
      const alert = await this.prisma.shadowDataAlert.create({
        data: {
          tenantId,
          alertType: 'unknown_owner',
          severity: 'medium',
          status: 'open',
          title: `${orphaned.length} asset(s) with unknown ownership`,
          description: 'Assets with no identified owner or creator.',
          affectedAssets: orphaned.map((a) => a.id),
          metadata: { assetIds: orphaned.map((a) => a.id) },
        },
      });
      alerts.push(alert);
    }

    // Strategy 4: External sharing detection
    const assetsWithAccess = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, accessPermissions: { not: null } },
      select: { id: true, name: true, type: true, accessPermissions: true, dataSourceId: true },
    });

    const externallyShared = assetsWithAccess.filter((a) => {
      const perms = (a.accessPermissions as any[]) || [];
      return perms.some((p) => p.principalType === 'public' || p.principalType === 'external');
    });

    if (externallyShared.length > 0) {
      const alert = await this.prisma.shadowDataAlert.create({
        data: {
          tenantId,
          alertType: 'external_sharing',
          severity: 'high',
          status: 'open',
          title: `${externallyShared.length} asset(s) with external/public sharing`,
          description: 'Assets shared publicly or with external principals detected.',
          affectedAssets: externallyShared.map((a) => a.id),
          metadata: { assets: externallyShared.map((a) => ({ id: a.id, name: a.name, type: a.type })) },
        },
      });
      alerts.push(alert);
    }

    // Strategy 5: Collaboration sprawl — personal drives/channels with classified data
    const collaborationSources = ['google_drive', 'onedrive', 'sharepoint', 'slack', 'teams', 'dropbox', 'confluence'];
    const collaborationAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        dataSource: { type: { in: collaborationSources } },
        classifications: { some: {} },
      },
      select: { id: true, name: true, type: true, path: true },
    });

    const personalPatterns = [/\bpersonal\b/i, /\bmy drive\b/i, /\bprivate\b/i, /\bdirect message\b/i, /\bdm\b/i];
    const sprawlAssets = collaborationAssets.filter((a) => {
      const nameOrPath = `${a.name} ${a.path || ''}`;
      return personalPatterns.some((p) => p.test(nameOrPath));
    });

    if (sprawlAssets.length > 0) {
      const alert = await this.prisma.shadowDataAlert.create({
        data: {
          tenantId,
          alertType: 'collaboration_sprawl',
          severity: 'medium',
          status: 'open',
          title: `${sprawlAssets.length} classified asset(s) in personal/private spaces`,
          description: 'Sensitive data found in personal drives or private channels.',
          affectedAssets: sprawlAssets.map((a) => a.id),
          metadata: { assets: sprawlAssets.map((a) => ({ id: a.id, name: a.name, path: a.path })) },
        },
      });
      alerts.push(alert);
    }

    await this.events.publish({
      type: 'shadow-data.scan.completed',
      tenantId,
      data: { alertCount: alerts.length },
      timestamp: new Date(),
    });

    return { alertsCreated: alerts.length, alerts };
  }

  async getAlerts(tenantId: string, filters: ShadowDataAlertFilterDto = {}) {
    const { page = 1, pageSize = 20, alertType, status, severity } = filters;

    const where: any = {
      tenantId,
      ...(alertType && { alertType }),
      ...(status && { status }),
      ...(severity && { severity }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.shadowDataAlert.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.shadowDataAlert.count({ where }),
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

  async getAlertById(tenantId: string, alertId: string) {
    const alert = await this.prisma.shadowDataAlert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException(`Shadow data alert ${alertId} not found`);
    }

    return alert;
  }

  async updateAlertStatus(
    tenantId: string,
    alertId: string,
    status: string,
    userId: string,
  ) {
    const alert = await this.prisma.shadowDataAlert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException(`Shadow data alert ${alertId} not found`);
    }

    const previousStatus = alert.status;

    const updated = await this.prisma.shadowDataAlert.update({
      where: { id: alertId },
      data: {
        status,
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'shadow_data_alert.status_changed',
      entityType: 'shadow_data_alert',
      entityId: alertId,
      changes: {
        before: { status: previousStatus },
        after: { status },
      },
    });

    return updated;
  }

  async getStats(tenantId: string) {
    const [byType, bySeverity, byStatus] = await Promise.all([
      this.prisma.shadowDataAlert.groupBy({
        by: ['alertType'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.shadowDataAlert.groupBy({
        by: ['severity'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.shadowDataAlert.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    return {
      byAlertType: byType.map((t) => ({ alertType: t.alertType, count: t._count.id })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    };
  }
}
