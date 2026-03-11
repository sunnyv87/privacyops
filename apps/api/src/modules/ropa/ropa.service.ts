import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateRopaEntryDto,
  UpdateRopaEntryDto,
  RopaFilterDto,
} from './dto/ropa.dto';

@Injectable()
export class RopaService {
  private readonly logger = new Logger(RopaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateRopaEntryDto) {
    const entry = await this.prisma.ropaEntry.create({
      data: {
        tenantId,
        title: dto.processingPurpose,
        processingPurpose: dto.processingPurpose,
        status: 'draft',
        lawfulBasis: dto.lawfulBasis,
        dataSubjectCategories: dto.dataSubjectCategories,
        personalDataCategories: dto.dataCategories,
        recipients: dto.recipients || [],
        retentionPeriod: dto.retentionPeriod,
        securityMeasures: [
          ...(dto.technicalMeasures || []),
          ...(dto.organizationalMeasures || []),
        ].join('; ') || null,
        ownerId: actorId,
        metadata: {
          description: dto.description,
          dpiaRequired: dto.dpiaRequired,
          technicalMeasures: dto.technicalMeasures,
          organizationalMeasures: dto.organizationalMeasures,
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'ropa.created',
      entityType: 'ropa_entry',
      entityId: entry.id,
      changes: { after: dto },
    });

    this.logger.log(`RoPA entry ${entry.id} created by ${actorId}`);

    return entry;
  }

  async findAll(
    tenantId: string,
    filters?: RopaFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, lawfulBasis, dpiaRequired } = filters || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(lawfulBasis && { lawfulBasis }),
    };

    // dpiaRequired is stored in metadata JSON, so we handle it in post-filter
    // or use Prisma JSON filtering if supported
    if (dpiaRequired !== undefined) {
      where.metadata = {
        path: ['dpiaRequired'],
        equals: dpiaRequired,
      };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.ropaEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ropaEntry.count({ where }),
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

  async findById(tenantId: string, id: string) {
    const entry = await this.prisma.ropaEntry.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!entry) {
      throw new NotFoundException(`RoPA entry ${id} not found`);
    }

    return entry;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateRopaEntryDto,
  ) {
    const existing = await this.prisma.ropaEntry.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`RoPA entry ${id} not found`);
    }

    const existingMetadata = (existing.metadata as Record<string, any>) || {};

    const updated = await this.prisma.ropaEntry.update({
      where: { id },
      data: {
        ...(dto.processingPurpose !== undefined && {
          title: dto.processingPurpose,
          processingPurpose: dto.processingPurpose,
        }),
        ...(dto.lawfulBasis !== undefined && { lawfulBasis: dto.lawfulBasis }),
        ...(dto.dataSubjectCategories !== undefined && {
          dataSubjectCategories: dto.dataSubjectCategories,
        }),
        ...(dto.dataCategories !== undefined && {
          personalDataCategories: dto.dataCategories,
        }),
        ...(dto.recipients !== undefined && { recipients: dto.recipients }),
        ...(dto.retentionPeriod !== undefined && {
          retentionPeriod: dto.retentionPeriod,
        }),
        ...(dto.technicalMeasures || dto.organizationalMeasures
          ? {
              securityMeasures: [
                ...(dto.technicalMeasures || existingMetadata.technicalMeasures || []),
                ...(dto.organizationalMeasures || existingMetadata.organizationalMeasures || []),
              ].join('; '),
            }
          : {}),
        metadata: {
          ...existingMetadata,
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.dpiaRequired !== undefined && { dpiaRequired: dto.dpiaRequired }),
          ...(dto.technicalMeasures !== undefined && {
            technicalMeasures: dto.technicalMeasures,
          }),
          ...(dto.organizationalMeasures !== undefined && {
            organizationalMeasures: dto.organizationalMeasures,
          }),
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'ropa.updated',
      entityType: 'ropa_entry',
      entityId: id,
      changes: {
        before: {
          processingPurpose: existing.processingPurpose,
          lawfulBasis: existing.lawfulBasis,
          status: existing.status,
        },
        after: dto,
      },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, actorId: string) {
    const existing = await this.prisma.ropaEntry.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`RoPA entry ${id} not found`);
    }

    const deleted = await this.prisma.ropaEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'ropa.deleted',
      entityType: 'ropa_entry',
      entityId: id,
      changes: {
        before: { status: existing.status },
        after: { deletedAt: deleted.deletedAt },
      },
    });

    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Calculate Completeness
  // ---------------------------------------------------------------------------

  async calculateCompleteness(tenantId: string, entryId: string) {
    const entry = await this.prisma.ropaEntry.findFirst({
      where: { id: entryId, tenantId, deletedAt: null },
    });

    if (!entry) {
      throw new NotFoundException(`RoPA entry ${entryId} not found`);
    }

    const fields = [
      { name: 'title', filled: !!entry.title },
      { name: 'processingPurpose', filled: !!entry.processingPurpose },
      { name: 'lawfulBasis', filled: !!entry.lawfulBasis },
      {
        name: 'dataSubjectCategories',
        filled:
          Array.isArray(entry.dataSubjectCategories) &&
          entry.dataSubjectCategories.length > 0,
      },
      {
        name: 'personalDataCategories',
        filled:
          Array.isArray(entry.personalDataCategories) &&
          entry.personalDataCategories.length > 0,
      },
      {
        name: 'recipients',
        filled:
          Array.isArray(entry.recipients) && entry.recipients.length > 0,
      },
      { name: 'retentionPeriod', filled: !!entry.retentionPeriod },
      { name: 'securityMeasures', filled: !!entry.securityMeasures },
      { name: 'ownerId', filled: !!entry.ownerId },
    ];

    const filledCount = fields.filter((f) => f.filled).length;
    const score = Math.round((filledCount / fields.length) * 100) / 100;

    await this.prisma.ropaEntry.update({
      where: { id: entryId },
      data: { completenessScore: score },
    });

    return {
      entryId,
      score,
      filledFields: filledCount,
      totalFields: fields.length,
      missingFields: fields
        .filter((f) => !f.filled)
        .map((f) => f.name),
    };
  }

  // ---------------------------------------------------------------------------
  // Link Vendors
  // ---------------------------------------------------------------------------

  async linkVendors(
    tenantId: string,
    entryId: string,
    vendorIds: string[],
  ) {
    const entry = await this.prisma.ropaEntry.findFirst({
      where: { id: entryId, tenantId, deletedAt: null },
    });

    if (!entry) {
      throw new NotFoundException(`RoPA entry ${entryId} not found`);
    }

    const updated = await this.prisma.ropaEntry.update({
      where: { id: entryId },
      data: { linkedVendorIds: vendorIds },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'ropa.vendors_linked',
      entityType: 'ropa_entry',
      entityId: entryId,
      changes: {
        before: { linkedVendorIds: entry.linkedVendorIds },
        after: { linkedVendorIds: vendorIds },
      },
    });

    await this.events.publish({
      type: 'ropa.vendors_linked',
      tenantId,
      data: { entryId, vendorIds },
      timestamp: new Date(),
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Generate Report
  // ---------------------------------------------------------------------------

  async generateReport(tenantId: string, format = 'json') {
    const entries = await this.prisma.ropaEntry.findMany({
      where: { tenantId, deletedAt: null, status: { not: 'archived' } },
      orderBy: { createdAt: 'asc' },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'ropa.report_generated',
      entityType: 'ropa_entry',
      entityId: tenantId,
      changes: {
        after: {
          format,
          entryCount: entries.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    const report = entries.map((entry) => {
      const metadata = (entry.metadata as Record<string, any>) || {};
      return {
        id: entry.id,
        title: entry.title,
        processingPurpose: entry.processingPurpose,
        lawfulBasis: entry.lawfulBasis,
        dataSubjectCategories: entry.dataSubjectCategories,
        personalDataCategories: entry.personalDataCategories,
        recipients: entry.recipients,
        crossBorderTransfers: entry.crossBorderTransfers,
        retentionPeriod: entry.retentionPeriod,
        securityMeasures: entry.securityMeasures,
        technicalMeasures: metadata.technicalMeasures || [],
        organizationalMeasures: metadata.organizationalMeasures || [],
        dpiaRequired: metadata.dpiaRequired || false,
        status: entry.status,
        ownerId: entry.ownerId,
        linkedVendorIds: entry.linkedVendorIds,
        completenessScore: entry.completenessScore,
        lastReviewedAt: entry.lastReviewedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    });

    return {
      format,
      generatedAt: new Date().toISOString(),
      totalEntries: report.length,
      entries: report,
    };
  }

  // ---------------------------------------------------------------------------
  // Processing Map
  // ---------------------------------------------------------------------------

  async getProcessingMap(tenantId: string) {
    const entries = await this.prisma.ropaEntry.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map((entry) => {
      const metadata = (entry.metadata as Record<string, any>) || {};
      return {
        id: entry.id,
        title: entry.title,
        processingPurpose: entry.processingPurpose,
        lawfulBasis: entry.lawfulBasis,
        dataSubjectCategories: entry.dataSubjectCategories,
        personalDataCategories: entry.personalDataCategories,
        recipients: entry.recipients,
        crossBorderTransfers: entry.crossBorderTransfers,
        linkedVendorIds: entry.linkedVendorIds,
        status: entry.status,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Completeness Overview
  // ---------------------------------------------------------------------------

  async getCompletenessOverview(tenantId: string) {
    const entries = await this.prisma.ropaEntry.findMany({
      where: { tenantId, deletedAt: null },
    });

    const results = [];
    let totalScore = 0;
    const belowThreshold: any[] = [];
    const threshold = 0.7;

    for (const entry of entries) {
      const fields = [
        { name: 'title', filled: !!entry.title },
        { name: 'processingPurpose', filled: !!entry.processingPurpose },
        { name: 'lawfulBasis', filled: !!entry.lawfulBasis },
        {
          name: 'dataSubjectCategories',
          filled:
            Array.isArray(entry.dataSubjectCategories) &&
            entry.dataSubjectCategories.length > 0,
        },
        {
          name: 'personalDataCategories',
          filled:
            Array.isArray(entry.personalDataCategories) &&
            entry.personalDataCategories.length > 0,
        },
        {
          name: 'recipients',
          filled:
            Array.isArray(entry.recipients) && entry.recipients.length > 0,
        },
        { name: 'retentionPeriod', filled: !!entry.retentionPeriod },
        { name: 'securityMeasures', filled: !!entry.securityMeasures },
        { name: 'ownerId', filled: !!entry.ownerId },
      ];

      const filledCount = fields.filter((f) => f.filled).length;
      const score = Math.round((filledCount / fields.length) * 100) / 100;
      totalScore += score;

      if (score < threshold) {
        belowThreshold.push({
          entryId: entry.id,
          title: entry.title,
          score,
          missingFields: fields.filter((f) => !f.filled).map((f) => f.name),
        });
      }

      results.push({ entryId: entry.id, title: entry.title, score });
    }

    const avgScore =
      entries.length > 0
        ? Math.round((totalScore / entries.length) * 100) / 100
        : 0;

    return {
      totalEntries: entries.length,
      averageScore: avgScore,
      belowThreshold,
      threshold,
      entries: results,
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async export(tenantId: string) {
    const entries = await this.prisma.ropaEntry.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    // Log the export action for compliance auditing
    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'ropa.exported',
      entityType: 'ropa_entry',
      entityId: tenantId,
      changes: {
        after: {
          exportedCount: entries.length,
          exportedAt: new Date().toISOString(),
        },
      },
    });

    return entries.map((entry) => {
      const metadata = (entry.metadata as Record<string, any>) || {};
      return {
        id: entry.id,
        title: entry.title,
        processingPurpose: entry.processingPurpose,
        lawfulBasis: entry.lawfulBasis,
        dataSubjectCategories: entry.dataSubjectCategories,
        personalDataCategories: entry.personalDataCategories,
        recipients: entry.recipients,
        crossBorderTransfers: entry.crossBorderTransfers,
        retentionPeriod: entry.retentionPeriod,
        securityMeasures: entry.securityMeasures,
        technicalMeasures: metadata.technicalMeasures || [],
        organizationalMeasures: metadata.organizationalMeasures || [],
        dpiaRequired: metadata.dpiaRequired || false,
        status: entry.status,
        ownerId: entry.ownerId,
        lastReviewedAt: entry.lastReviewedAt,
        nextReviewDate: entry.nextReviewDate,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    });
  }
}
