import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { createHash } from 'crypto';
import {
  CreateDsarDto,
  UpdateDsarStatusDto,
  DsarFilterDto,
} from './dto/dsar.dto';

@Injectable()
export class DsarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reference number generation: DSAR-YYYY-NNNN
  // ---------------------------------------------------------------------------

  private async generateReferenceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DSAR-${year}-`;

    const lastRequest = await this.prisma.dsarRequest.findFirst({
      where: {
        tenantId,
        referenceNumber: { startsWith: prefix },
      },
      orderBy: { referenceNumber: 'desc' },
    });

    let counter = 1;
    if (lastRequest) {
      const lastNumber = parseInt(
        lastRequest.referenceNumber.replace(prefix, ''),
        10,
      );
      counter = lastNumber + 1;
    }

    return `${prefix}${counter.toString().padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Data Subjects (shared helper)
  // ---------------------------------------------------------------------------

  private async findOrCreateDataSubject(
    tenantId: string,
    email: string,
    name?: string,
  ) {
    const emailHash = createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');

    const existing = await this.prisma.dataSubject.findFirst({
      where: { tenantId, emailHash },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.dataSubject.create({
      data: {
        tenantId,
        emailHash,
        identityAttributes: { email, ...(name && { name }) },
        status: 'active',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Create DSAR
  // ---------------------------------------------------------------------------

  async create(tenantId: string, actorId: string, dto: CreateDsarDto) {
    const referenceNumber = await this.generateReferenceNumber(tenantId);

    const dataSubject = await this.findOrCreateDataSubject(
      tenantId,
      dto.dataSubjectEmail,
      dto.dataSubjectName,
    );

    // Due date: 30 days from submission
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const request = await this.prisma.dsarRequest.create({
      data: {
        tenantId,
        referenceNumber,
        dataSubjectId: dataSubject.id,
        type: dto.type,
        status: 'received',
        channel: dto.channel || 'web',
        dueDate,
        requestorInfo: {
          email: dto.dataSubjectEmail,
          name: dto.dataSubjectName || null,
        },
        notes: dto.description,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'dsar.created',
      entityType: 'dsar_request',
      entityId: request.id,
      changes: {
        after: {
          referenceNumber,
          type: dto.type,
          status: 'received',
          dataSubjectId: dataSubject.id,
          dueDate: dueDate.toISOString(),
        },
      },
    });

    await this.events.publish({
      type: 'dsar.received',
      tenantId,
      data: {
        requestId: request.id,
        referenceNumber,
        type: dto.type,
        dataSubjectId: dataSubject.id,
        dueDate: dueDate.toISOString(),
      },
      timestamp: new Date(),
    });

    return request;
  }

  // ---------------------------------------------------------------------------
  // List DSARs
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    filters?: DsarFilterDto & { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = { tenantId };
    if (filters?.type) where.type = filters.type;
    if (filters?.assigneeId) where.assignedTo = filters.assigneeId;

    // Handle status filter and overdue detection
    if (filters?.overdueOnly) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['completed', 'rejected'] };
    } else if (filters?.status === 'overdue') {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['completed', 'rejected'] };
    } else if (filters?.status) {
      where.status = filters.status;
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.dsarRequest.findMany({
        where,
        include: {
          dataSubject: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.dsarRequest.count({ where }),
    ]);

    // Annotate overdue status on each record
    const now = new Date();
    const annotatedData = data.map((request) => ({
      ...request,
      isOverdue:
        request.dueDate < now &&
        !['completed', 'rejected'].includes(request.status),
    }));

    return {
      data: annotatedData,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Get single DSAR
  // ---------------------------------------------------------------------------

  async findById(tenantId: string, id: string) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id, tenantId },
      include: {
        dataSubject: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`DSAR request ${id} not found`);
    }

    // Fetch timeline from audit logs
    const timeline = await this.audit.findByEntity(
      tenantId,
      'dsar_request',
      id,
    );

    const now = new Date();
    const isOverdue =
      request.dueDate < now &&
      !['completed', 'rejected'].includes(request.status);

    return { ...request, isOverdue, timeline };
  }

  // ---------------------------------------------------------------------------
  // Update status
  // ---------------------------------------------------------------------------

  async updateStatus(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateDsarStatusDto,
  ) {
    const existing = await this.prisma.dsarRequest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`DSAR request ${id} not found`);
    }

    const previousStatus = existing.status;
    const updateData: Record<string, any> = {
      status: dto.status,
    };

    if (dto.note) {
      updateData.notes = existing.notes
        ? `${existing.notes}\n\n[${new Date().toISOString()}] ${dto.note}`
        : `[${new Date().toISOString()}] ${dto.note}`;
    }

    if (dto.assigneeId) {
      updateData.assignedTo = dto.assigneeId;
    }

    // Set timestamps based on status transitions
    if (dto.status === 'identity_verification' && !existing.verifiedAt) {
      // Verification started, not yet verified
    }

    if (
      dto.status === 'in_progress' &&
      previousStatus === 'identity_verification'
    ) {
      updateData.verifiedAt = new Date();
    }

    if (dto.status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (dto.status === 'rejected') {
      updateData.rejectionReason = dto.note || 'Request rejected';
    }

    const updated = await this.prisma.dsarRequest.update({
      where: { id },
      data: updateData,
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'dsar.status_changed',
      entityType: 'dsar_request',
      entityId: id,
      changes: {
        before: { status: previousStatus },
        after: {
          status: dto.status,
          note: dto.note || null,
        },
      },
    });

    // Publish status-specific events
    const eventMap: Record<string, string> = {
      identity_verification: 'dsar.verified',
      in_progress: 'dsar.in_progress',
      completed: 'dsar.completed',
    };

    const eventType = eventMap[dto.status];
    if (eventType) {
      await this.events.publish({
        type: eventType,
        tenantId,
        data: {
          requestId: id,
          referenceNumber: existing.referenceNumber,
          previousStatus,
          newStatus: dto.status,
        },
        timestamp: new Date(),
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Assign DSAR
  // ---------------------------------------------------------------------------

  async assign(
    tenantId: string,
    id: string,
    actorId: string,
    assigneeId: string,
  ) {
    const existing = await this.prisma.dsarRequest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`DSAR request ${id} not found`);
    }

    const updated = await this.prisma.dsarRequest.update({
      where: { id },
      data: { assignedTo: assigneeId },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'dsar.assigned',
      entityType: 'dsar_request',
      entityId: id,
      changes: {
        before: { assignedTo: existing.assignedTo },
        after: { assignedTo: assigneeId },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------------

  async getTimeline(tenantId: string, requestId: string) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException(`DSAR request ${requestId} not found`);
    }

    const auditEntries = await this.audit.findByEntity(
      tenantId,
      'dsar_request',
      requestId,
    );

    return auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorId: entry.actorId,
      changes: entry.changes,
      timestamp: entry.timestamp,
    }));
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(tenantId: string) {
    const now = new Date();

    const [totalRequests, byStatus, byType, overdueCount, avgCompletionTime] =
      await Promise.all([
        this.prisma.dsarRequest.count({ where: { tenantId } }),
        this.prisma.dsarRequest.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { id: true },
        }),
        this.prisma.dsarRequest.groupBy({
          by: ['type'],
          where: { tenantId },
          _count: { id: true },
        }),
        this.prisma.dsarRequest.count({
          where: {
            tenantId,
            dueDate: { lt: now },
            status: { notIn: ['completed', 'rejected'] },
          },
        }),
        this.prisma.dsarRequest.findMany({
          where: {
            tenantId,
            status: 'completed',
            completedAt: { not: null },
          },
          select: {
            submittedAt: true,
            completedAt: true,
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

    const typeCounts = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate average completion time in days
    let avgDays = 0;
    if (avgCompletionTime.length > 0) {
      const totalDays = avgCompletionTime.reduce((sum, r) => {
        if (r.completedAt) {
          const diff =
            r.completedAt.getTime() - r.submittedAt.getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgDays = Math.round((totalDays / avgCompletionTime.length) * 10) / 10;
    }

    const completedCount = statusCounts['completed'] || 0;
    const slaCompliance =
      totalRequests > 0
        ? Math.round(
            ((completedCount / (completedCount + overdueCount)) * 100 * 10) /
              10,
          ) / 10
        : 100;

    return {
      totalRequests,
      byStatus: statusCounts,
      byType: typeCounts,
      overdue: overdueCount,
      averageCompletionDays: avgDays,
      slaCompliance,
    };
  }
}
