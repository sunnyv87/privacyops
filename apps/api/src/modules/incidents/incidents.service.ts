import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  IncidentFilterDto,
} from './dto/incident.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reference number generation: INC-YYYY-NNNN
  // ---------------------------------------------------------------------------

  private async generateReferenceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INC-${year}-`;

    const lastIncident = await this.prisma.incident.findFirst({
      where: {
        tenantId,
        referenceNumber: { startsWith: prefix },
      },
      orderBy: { referenceNumber: 'desc' },
    });

    let counter = 1;
    if (lastIncident) {
      const lastNumber = parseInt(
        lastIncident.referenceNumber.replace(prefix, ''),
        10,
      );
      counter = lastNumber + 1;
    }

    return `${prefix}${counter.toString().padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Breach notification deadline calculation
  // ---------------------------------------------------------------------------

  private calculateBreachNotificationDeadlines(
    reportedAt: Date,
  ): Record<string, string> {
    // GDPR: 72 hours from detection
    const gdprDeadline = new Date(
      reportedAt.getTime() + 72 * 60 * 60 * 1000,
    );

    // CERT-In (India): 6 hours from detection
    const certInDeadline = new Date(
      reportedAt.getTime() + 6 * 60 * 60 * 1000,
    );

    return {
      gdpr: gdprDeadline.toISOString(),
      certIn: certInDeadline.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Create incident
  // ---------------------------------------------------------------------------

  async create(tenantId: string, actorId: string, dto: CreateIncidentDto) {
    const referenceNumber = await this.generateReferenceNumber(tenantId);
    const now = new Date();

    const data: Record<string, any> = {
      tenantId,
      referenceNumber,
      title: dto.title,
      severity: dto.severity,
      status: 'reported',
      description: dto.description,
      isPersonalDataBreach: dto.isBreach || false,
      detectedAt: now,
      reportedAt: now,
      estimatedSubjectsAffected: dto.affectedDataSubjects || null,
      affectedAssets: dto.affectedAssetIds || [],
      assignedTo: dto.assigneeId || null,
    };

    // If it's a breach, calculate notification deadlines
    if (dto.isBreach) {
      data.regulatoryNotifications = {
        deadlines: this.calculateBreachNotificationDeadlines(now),
        notified: [],
      };
    }

    const incident = await this.prisma.incident.create({ data });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'incident.created',
      entityType: 'incident',
      entityId: incident.id,
      changes: {
        after: {
          referenceNumber,
          title: dto.title,
          severity: dto.severity,
          status: 'reported',
          isBreach: dto.isBreach || false,
        },
      },
    });

    await this.events.publish({
      type: 'incident.reported',
      tenantId,
      data: {
        incidentId: incident.id,
        referenceNumber,
        severity: dto.severity,
        isBreach: dto.isBreach || false,
        title: dto.title,
      },
      timestamp: now,
    });

    return incident;
  }

  // ---------------------------------------------------------------------------
  // List incidents
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    filters?: IncidentFilterDto & { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = { tenantId, deletedAt: null };
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.status) where.status = filters.status;
    if (filters?.breachOnly) where.isPersonalDataBreach = true;

    const [data, totalItems] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.incident.count({ where }),
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
  // Get single incident
  // ---------------------------------------------------------------------------

  async findById(tenantId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    return incident;
  }

  // ---------------------------------------------------------------------------
  // Update incident
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateIncidentDto,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    const previousStatus = existing.status;
    const updateData: Record<string, any> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.severity !== undefined) updateData.severity = dto.severity;
    if (dto.affectedDataSubjects !== undefined)
      updateData.estimatedSubjectsAffected = dto.affectedDataSubjects;
    if (dto.affectedAssetIds !== undefined)
      updateData.affectedAssets = dto.affectedAssetIds;
    if (dto.assigneeId !== undefined) updateData.assignedTo = dto.assigneeId;
    if (dto.rootCause !== undefined) updateData.rootCause = dto.rootCause;
    if (dto.containmentActions !== undefined)
      updateData.remediationActions = { containment: dto.containmentActions };

    if (dto.isBreach !== undefined) {
      updateData.isPersonalDataBreach = dto.isBreach;
      if (dto.isBreach && !existing.isPersonalDataBreach) {
        // Newly classified as breach — set notification deadlines
        updateData.regulatoryNotifications = {
          deadlines: this.calculateBreachNotificationDeadlines(
            existing.reportedAt,
          ),
          notified: [],
        };
      }
    }

    // Track status transitions with timestamps
    if (dto.status !== undefined) {
      updateData.status = dto.status;

      if (dto.status === 'contained' && !existing.containedAt) {
        updateData.containedAt = new Date();
      }

      if (
        (dto.status === 'resolved' || dto.status === 'closed') &&
        !existing.resolvedAt
      ) {
        updateData.resolvedAt = new Date();
      }
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: updateData,
    });

    // Audit: status change vs general update
    if (dto.status !== undefined && dto.status !== previousStatus) {
      await this.audit.log({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'incident.status_changed',
        entityType: 'incident',
        entityId: id,
        changes: {
          before: { status: previousStatus },
          after: { status: dto.status },
        },
      });

      // Publish status-specific events
      const eventMap: Record<string, string> = {
        confirmed: 'incident.confirmed',
        contained: 'incident.contained',
        resolved: 'incident.resolved',
      };

      const eventType = eventMap[dto.status];
      if (eventType) {
        await this.events.publish({
          type: eventType,
          tenantId,
          data: {
            incidentId: id,
            referenceNumber: existing.referenceNumber,
            previousStatus,
            newStatus: dto.status,
            severity: updated.severity,
            isBreach: updated.isPersonalDataBreach,
          },
          timestamp: new Date(),
        });
      }
    } else {
      await this.audit.log({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'incident.updated',
        entityType: 'incident',
        entityId: id,
        changes: {
          before: existing,
          after: updated,
        },
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(tenantId: string) {
    const [
      totalCount,
      byStatus,
      bySeverity,
      openBreaches,
      resolvedIncidents,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.incident.count({
        where: {
          tenantId,
          deletedAt: null,
          isPersonalDataBreach: true,
          status: { notIn: ['resolved', 'closed'] },
        },
      }),
      this.prisma.incident.findMany({
        where: {
          tenantId,
          deletedAt: null,
          resolvedAt: { not: null },
        },
        select: {
          reportedAt: true,
          resolvedAt: true,
        },
      }),
    ]);

    const statusCounts = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const severityCounts = bySeverity.reduce(
      (acc, item) => {
        acc[item.severity] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate average resolution time in hours
    let avgResolutionHours = 0;
    if (resolvedIncidents.length > 0) {
      const totalHours = resolvedIncidents.reduce((sum, inc) => {
        if (inc.resolvedAt) {
          const diff =
            inc.resolvedAt.getTime() - inc.reportedAt.getTime();
          return sum + diff / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgResolutionHours =
        Math.round((totalHours / resolvedIncidents.length) * 10) / 10;
    }

    return {
      total: totalCount,
      byStatus: statusCounts,
      bySeverity: severityCounts,
      openBreaches,
      averageResolutionHours: avgResolutionHours,
    };
  }
}
