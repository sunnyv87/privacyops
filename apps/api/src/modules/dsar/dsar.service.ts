import { Injectable, NotFoundException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { createHash } from 'crypto';
import {
  CreateDsarDto,
  UpdateDsarStatusDto,
  DsarFilterDto,
} from './dto/dsar.dto';
import { RedactionService } from '../redaction-engine/redaction.service';

@Injectable()
export class DsarService {
  private readonly logger = new Logger(DsarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    @Optional() private readonly redaction?: RedactionService,
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
    phone?: string,
    externalId?: string,
  ) {
    const emailHash = createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');

    const existing = await this.prisma.dataSubject.findFirst({
      where: { tenantId, emailHash },
    });

    // Build the attribute patch — only include supplied fields so we never
    // overwrite existing values with undefined.
    const attrPatch: Record<string, unknown> = { email };
    if (name) attrPatch.name = name;
    if (phone) attrPatch.phone = phone;
    if (externalId) attrPatch.externalId = externalId;

    if (existing) {
      // Merge new attributes into the existing record so phone / externalId
      // captured on later requests are preserved for fuzzy matching.
      const merged = { ...(existing.identityAttributes as Record<string, unknown> || {}), ...attrPatch };
      const hasNewFields = Object.keys(attrPatch).some(
        (k) => (existing.identityAttributes as any)?.[k] !== attrPatch[k],
      );
      if (hasNewFields) {
        return this.prisma.dataSubject.update({
          where: { id: existing.id },
          data: { identityAttributes: merged },
        });
      }
      return existing;
    }

    return this.prisma.dataSubject.create({
      data: {
        tenantId,
        emailHash,
        identityAttributes: attrPatch,
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
      (dto as any).dataSubjectPhone,
      (dto as any).externalSubjectId,
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
  // Discover Subject Data
  // ---------------------------------------------------------------------------

  async discoverSubjectData(tenantId: string, requestId: string) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { dataSubject: true },
    });

    if (!request) {
      throw new NotFoundException(`DSAR request ${requestId} not found`);
    }

    // Search across data sources for matching assets
    const dataSubject = request.dataSubject;
    const assets = await this.prisma.dataAsset.findMany({
      where: {
        tenantId,
        OR: [
          { metadata: { path: ['dataSubjectIds'], array_contains: dataSubject.id } },
          { name: { contains: dataSubject.emailHash } },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        dataSourceId: true,
        classificationLabels: true,
      },
    });

    const discoveredSources = assets.map((asset) => ({
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      dataSourceId: asset.dataSourceId,
      classificationLabels: asset.classificationLabels,
      discoveredAt: new Date().toISOString(),
    }));

    await this.prisma.dsarRequest.update({
      where: { id: requestId },
      data: {
        discoveredDataSources: discoveredSources,
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'dsar.data_discovered',
      entityType: 'dsar_request',
      entityId: requestId,
      changes: {
        after: {
          discoveredCount: discoveredSources.length,
          dataSubjectId: dataSubject.id,
        },
      },
    });

    await this.events.publish({
      type: 'dsar.data_discovered',
      tenantId,
      data: {
        requestId,
        referenceNumber: request.referenceNumber,
        discoveredCount: discoveredSources.length,
      },
      timestamp: new Date(),
    });

    return {
      requestId,
      dataSubjectId: dataSubject.id,
      discoveredSources,
      totalDiscovered: discoveredSources.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Generate Response Package
  // ---------------------------------------------------------------------------

  async generateResponsePackage(tenantId: string, requestId: string) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { dataSubject: true },
    });

    if (!request) {
      throw new NotFoundException(`DSAR request ${requestId} not found`);
    }

    // Optional redaction step: collect → redact → generate.
    // If RedactionService is not provided (legacy DI), this is a no-op
    // and the previous behavior is preserved exactly.
    let redactionSummary: Record<string, unknown> | null = null;
    let discoveredForPackage = request.discoveredDataSources || [];
    if (this.redaction) {
      try {
        const requestorEmail = (request.requestorInfo as any)?.email;
        const preserve = requestorEmail ? [String(requestorEmail)] : [];
        const { data, totalMatches } = this.redaction.redactJson(
          discoveredForPackage,
          { preserve },
        );
        discoveredForPackage = data as any[];
        redactionSummary = {
          applied: true,
          totalMatches,
          preservedIdentifiers: preserve.length,
        };
      } catch (err) {
        this.logger.warn(
          `Redaction failed for DSAR ${requestId}; continuing with unredacted package: ${(err as Error).message}`,
        );
        redactionSummary = { applied: false, error: 'redaction_failed' };
      }
    }

    const responseMetadata = {
      generatedAt: new Date().toISOString(),
      format: 'json',
      packageUrl: `/api/dsar/requests/${requestId}/download`,
      discoveredSources: discoveredForPackage,
      status: 'generated',
      ...(redactionSummary ? { redaction: redactionSummary } : {}),
    };

    await this.prisma.dsarRequest.update({
      where: { id: requestId },
      data: { responseMetadata },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'dsar.response_generated',
      entityType: 'dsar_request',
      entityId: requestId,
      changes: {
        after: { responseMetadata },
      },
    });

    await this.events.publish({
      type: 'dsar.response_generated',
      tenantId,
      data: {
        requestId,
        referenceNumber: request.referenceNumber,
        packageUrl: responseMetadata.packageUrl,
      },
      timestamp: new Date(),
    });

    return responseMetadata;
  }

  // ---------------------------------------------------------------------------
  // Download Response Package
  // ---------------------------------------------------------------------------

  /**
   * Returns the redacted response metadata as the downloadable artifact.
   * The caller (controller) serializes this as a JSON file attachment.
   * If the package has not yet been generated, triggers generation first
   * so the response is always deterministic.
   */
  async getDownload(tenantId: string, requestId: string) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) {
      throw new NotFoundException(`DSAR request ${requestId} not found`);
    }
    let meta = request.responseMetadata as any;
    if (!meta || meta.status !== 'generated') {
      meta = await this.generateResponsePackage(tenantId, requestId);
    }
    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'dsar.response_downloaded',
      entityType: 'dsar_request',
      entityId: requestId,
    });
    return {
      filename: `dsar-${request.referenceNumber}.json`,
      contentType: 'application/json',
      body: {
        referenceNumber: request.referenceNumber,
        generatedAt: meta.generatedAt,
        redaction: meta.redaction ?? null,
        discoveredSources: meta.discoveredSources ?? [],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Verify Deletion
  // ---------------------------------------------------------------------------

  async verifyDeletion(
    tenantId: string,
    requestId: string,
    userId: string,
  ) {
    const request = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException(`DSAR request ${requestId} not found`);
    }

    const deletionVerification = {
      verified: true,
      verifiedAt: new Date().toISOString(),
      verifiedBy: userId,
      discoveredSources: request.discoveredDataSources || [],
    };

    await this.prisma.dsarRequest.update({
      where: { id: requestId },
      data: { deletionVerification },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'dsar.deletion_verified',
      entityType: 'dsar_request',
      entityId: requestId,
      changes: {
        after: deletionVerification,
      },
    });

    await this.events.publish({
      type: 'dsar.deletion_verified',
      tenantId,
      data: {
        requestId,
        referenceNumber: request.referenceNumber,
        verifiedBy: userId,
      },
      timestamp: new Date(),
    });

    return deletionVerification;
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
