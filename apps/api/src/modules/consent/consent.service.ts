import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { createHash } from 'crypto';
import {
  CreateConsentNoticeDto,
  UpdateConsentNoticeDto,
  RecordConsentDto,
  RevokeConsentDto,
  CreateProcessingPurposeDto,
  ConsentFilterDto,
} from './dto/consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Consent Notices
  // ---------------------------------------------------------------------------

  async createNotice(
    tenantId: string,
    actorId: string,
    dto: CreateConsentNoticeDto,
  ) {
    const notice = await this.prisma.consentNotice.create({
      data: {
        tenantId,
        name: dto.name,
        version: 1,
        status: 'draft',
        content: dto.content,
        purposes: dto.purposeIds,
        createdBy: actorId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'consent_notice.created',
      entityType: 'consent_notice',
      entityId: notice.id,
      changes: { after: notice },
    });

    return notice;
  }

  async findAllNotices(
    tenantId: string,
    filters?: { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = { tenantId };

    const [data, totalItems] = await Promise.all([
      this.prisma.consentNotice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.consentNotice.count({ where }),
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

  async findNoticeById(tenantId: string, id: string) {
    const notice = await this.prisma.consentNotice.findFirst({
      where: { id, tenantId },
    });

    if (!notice) {
      throw new NotFoundException(`Consent notice ${id} not found`);
    }

    // Resolve linked purpose details
    const purposeIds = (notice.purposes as string[]) || [];
    const purposes =
      purposeIds.length > 0
        ? await this.prisma.processingPurpose.findMany({
            where: { id: { in: purposeIds }, tenantId },
          })
        : [];

    return { ...notice, linkedPurposes: purposes };
  }

  async updateNotice(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateConsentNoticeDto,
  ) {
    const existing = await this.prisma.consentNotice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Consent notice ${id} not found`);
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.purposeIds !== undefined) updateData.purposes = dto.purposeIds;
    if (dto.isActive !== undefined) {
      updateData.status = dto.isActive ? 'published' : 'archived';
      if (dto.isActive && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    // Bump version when content or purposes change
    if (dto.content !== undefined || dto.purposeIds !== undefined) {
      updateData.version = existing.version + 1;
    }

    const updated = await this.prisma.consentNotice.update({
      where: { id },
      data: updateData,
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'consent_notice.updated',
      entityType: 'consent_notice',
      entityId: id,
      changes: { before: existing, after: updated },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Processing Purposes
  // ---------------------------------------------------------------------------

  async createPurpose(
    tenantId: string,
    actorId: string,
    dto: CreateProcessingPurposeDto,
  ) {
    const purpose = await this.prisma.processingPurpose.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        lawfulBasis: dto.lawfulBasis,
        isActive: true,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'processing_purpose.created',
      entityType: 'processing_purpose',
      entityId: purpose.id,
      changes: { after: purpose },
    });

    return purpose;
  }

  async findAllPurposes(
    tenantId: string,
    filters?: { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where = { tenantId };

    const [data, totalItems] = await Promise.all([
      this.prisma.processingPurpose.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.processingPurpose.count({ where }),
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
  // Data Subjects
  // ---------------------------------------------------------------------------

  async findOrCreateDataSubject(tenantId: string, identifier: string) {
    const emailHash = createHash('sha256')
      .update(identifier.toLowerCase().trim())
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
        identityAttributes: { email: identifier },
        status: 'active',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Consent Records
  // ---------------------------------------------------------------------------

  async recordConsent(
    tenantId: string,
    actorId: string,
    dto: RecordConsentDto,
  ) {
    const dataSubject = await this.findOrCreateDataSubject(
      tenantId,
      dto.dataSubjectIdentifier,
    );

    const notice = await this.prisma.consentNotice.findFirst({
      where: { id: dto.noticeId, tenantId },
    });

    if (!notice) {
      throw new NotFoundException(`Consent notice ${dto.noticeId} not found`);
    }

    // Get the purposes linked to this notice
    const purposeIds = (notice.purposes as string[]) || [];
    if (purposeIds.length === 0) {
      throw new ConflictException(
        'Consent notice has no linked processing purposes',
      );
    }

    // Create a consent record for each purpose linked to the notice
    const records = await Promise.all(
      purposeIds.map((purposeId) =>
        this.prisma.consentRecord.create({
          data: {
            tenantId,
            dataSubjectId: dataSubject.id,
            noticeId: dto.noticeId,
            noticeVersion: notice.version,
            purposeId,
            status: dto.status,
            grantedAt: dto.status === 'granted' ? new Date() : null,
            channel: dto.channel || 'web',
            ipAddress: dto.ipAddress || null,
            lawfulBasis: 'consent',
          },
        }),
      ),
    );

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'consent.recorded',
      entityType: 'consent_record',
      entityId: records[0].id,
      changes: {
        after: {
          dataSubjectId: dataSubject.id,
          noticeId: dto.noticeId,
          status: dto.status,
          recordCount: records.length,
        },
      },
    });

    if (dto.status === 'granted') {
      await this.events.publish({
        type: 'consent.granted',
        tenantId,
        data: {
          dataSubjectId: dataSubject.id,
          noticeId: dto.noticeId,
          purposeIds,
          recordIds: records.map((r) => r.id),
        },
        timestamp: new Date(),
      });
    }

    return records;
  }

  async revokeConsent(
    tenantId: string,
    actorId: string,
    dto: RevokeConsentDto,
  ) {
    const dataSubject = await this.findOrCreateDataSubject(
      tenantId,
      dto.dataSubjectIdentifier,
    );

    // Find active consent records for this data subject + notice
    const activeRecords = await this.prisma.consentRecord.findMany({
      where: {
        tenantId,
        dataSubjectId: dataSubject.id,
        noticeId: dto.noticeId,
        status: 'granted',
      },
    });

    if (activeRecords.length === 0) {
      throw new NotFoundException(
        'No active consent records found for this data subject and notice',
      );
    }

    const now = new Date();

    // Revoke all active records for this notice
    await this.prisma.consentRecord.updateMany({
      where: {
        tenantId,
        dataSubjectId: dataSubject.id,
        noticeId: dto.noticeId,
        status: 'granted',
      },
      data: {
        status: 'revoked',
        revokedAt: now,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'consent.revoked',
      entityType: 'consent_record',
      entityId: activeRecords[0].id,
      changes: {
        before: { status: 'granted' },
        after: {
          status: 'revoked',
          reason: dto.reason,
          revokedAt: now.toISOString(),
          revokedCount: activeRecords.length,
        },
      },
    });

    await this.events.publish({
      type: 'consent.revoked',
      tenantId,
      data: {
        dataSubjectId: dataSubject.id,
        noticeId: dto.noticeId,
        reason: dto.reason,
        recordIds: activeRecords.map((r) => r.id),
      },
      timestamp: now,
    });

    return {
      revokedCount: activeRecords.length,
      dataSubjectId: dataSubject.id,
      noticeId: dto.noticeId,
    };
  }

  async findAllRecords(
    tenantId: string,
    filters?: ConsentFilterDto & { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = { tenantId };
    if (filters?.dataSubjectId) where.dataSubjectId = filters.dataSubjectId;
    if (filters?.status) where.status = filters.status;
    if (filters?.purposeId) where.purposeId = filters.purposeId;

    const [data, totalItems] = await Promise.all([
      this.prisma.consentRecord.findMany({
        where,
        include: {
          notice: true,
          purpose: true,
          dataSubject: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.consentRecord.count({ where }),
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
  // Statistics
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Preference Center
  // ---------------------------------------------------------------------------

  async getPreferenceCenter(tenantId: string, dataSubjectId: string) {
    const dataSubject = await this.prisma.dataSubject.findFirst({
      where: { id: dataSubjectId, tenantId },
    });

    if (!dataSubject) {
      throw new NotFoundException(`Data subject ${dataSubjectId} not found`);
    }

    const records = await this.prisma.consentRecord.findMany({
      where: { tenantId, dataSubjectId },
      include: { purpose: true },
      orderBy: { createdAt: 'desc' },
    });

    // Group by purposeId, taking the most recent record per purpose
    const purposeMap = new Map<string, any>();
    for (const record of records) {
      if (!purposeMap.has(record.purposeId)) {
        purposeMap.set(record.purposeId, {
          purposeId: record.purposeId,
          name: record.purpose?.name || record.purposeId,
          status: record.status,
          grantedAt: record.grantedAt,
          expiresAt: record.expiresAt,
        });
      }
    }

    return { purposes: Array.from(purposeMap.values()) };
  }

  // ---------------------------------------------------------------------------
  // Consent by Jurisdiction
  // ---------------------------------------------------------------------------

  async getConsentByJurisdiction(tenantId: string) {
    const records = await this.prisma.consentRecord.findMany({
      where: { tenantId },
      select: { jurisdiction: true, status: true },
    });

    const jurisdictionMap: Record<
      string,
      { total: number; granted: number; revoked: number }
    > = {};

    for (const record of records) {
      const jurisdiction = (record.jurisdiction as string) || 'unknown';
      if (!jurisdictionMap[jurisdiction]) {
        jurisdictionMap[jurisdiction] = { total: 0, granted: 0, revoked: 0 };
      }
      jurisdictionMap[jurisdiction].total++;
      if (record.status === 'granted') jurisdictionMap[jurisdiction].granted++;
      if (record.status === 'revoked') jurisdictionMap[jurisdiction].revoked++;
    }

    return {
      jurisdictions: Object.entries(jurisdictionMap).map(
        ([jurisdiction, counts]) => ({
          jurisdiction,
          ...counts,
        }),
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Link Consent Purpose to RoPA
  // ---------------------------------------------------------------------------

  async linkToRopa(tenantId: string, purposeId: string, ropaId: string) {
    const purpose = await this.prisma.processingPurpose.findFirst({
      where: { id: purposeId, tenantId },
    });

    if (!purpose) {
      throw new NotFoundException(`Processing purpose ${purposeId} not found`);
    }

    const updated = await this.prisma.processingPurpose.update({
      where: { id: purposeId },
      data: { linkedRopaId: ropaId },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'processing_purpose.linked_to_ropa',
      entityType: 'processing_purpose',
      entityId: purposeId,
      changes: {
        before: { linkedRopaId: purpose.linkedRopaId },
        after: { linkedRopaId: ropaId },
      },
    });

    await this.events.publish({
      type: 'consent.purpose.linked_to_ropa',
      tenantId,
      data: { purposeId, ropaId },
      timestamp: new Date(),
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Consent Timeline
  // ---------------------------------------------------------------------------

  async getConsentTimeline(tenantId: string, dataSubjectId: string) {
    const dataSubject = await this.prisma.dataSubject.findFirst({
      where: { id: dataSubjectId, tenantId },
    });

    if (!dataSubject) {
      throw new NotFoundException(`Data subject ${dataSubjectId} not found`);
    }

    const records = await this.prisma.consentRecord.findMany({
      where: { tenantId, dataSubjectId },
      include: {
        notice: { select: { id: true, name: true } },
        purpose: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      status: record.status,
      noticeName: record.notice?.name || null,
      purposeName: record.purpose?.name || null,
      grantedAt: record.grantedAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(tenantId: string) {
    const [totalRecords, byStatus, recentActivity] = await Promise.all([
      this.prisma.consentRecord.count({ where: { tenantId } }),
      this.prisma.consentRecord.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.consentRecord.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
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

    return {
      totalRecords,
      granted: statusCounts['granted'] || 0,
      denied: statusCounts['denied'] || 0,
      revoked: statusCounts['revoked'] || 0,
      expired: statusCounts['expired'] || 0,
      last30Days: recentActivity,
    };
  }
}
