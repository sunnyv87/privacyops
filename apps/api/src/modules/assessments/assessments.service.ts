import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  AssessmentFilterDto,
} from './dto/assessment.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create assessment
  // ---------------------------------------------------------------------------

  async create(tenantId: string, actorId: string, dto: CreateAssessmentDto) {
    const assessment = await this.prisma.privacyAssessment.create({
      data: {
        tenantId,
        title: dto.title,
        type: dto.type,
        status: 'draft',
        ownerId: dto.ownerId || actorId,
        processingDescription: dto.description,
        dataCategories: [],
        riskItems: [],
        ...(dto.dueDate && { nextReviewDate: new Date(dto.dueDate) }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'assessment.created',
      entityType: 'privacy_assessment',
      entityId: assessment.id,
      changes: {
        after: {
          title: dto.title,
          type: dto.type,
          status: 'draft',
          ownerId: dto.ownerId || actorId,
        },
      },
    });

    return assessment;
  }

  // ---------------------------------------------------------------------------
  // List assessments
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    filters?: AssessmentFilterDto & { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, any> = { tenantId, deletedAt: null };
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.ownerId) where.ownerId = filters.ownerId;

    const [data, totalItems] = await Promise.all([
      this.prisma.privacyAssessment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.privacyAssessment.count({ where }),
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
  // Get single assessment
  // ---------------------------------------------------------------------------

  async findById(tenantId: string, id: string) {
    const assessment = await this.prisma.privacyAssessment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }

    return assessment;
  }

  // ---------------------------------------------------------------------------
  // Update assessment
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateAssessmentDto,
  ) {
    const existing = await this.prisma.privacyAssessment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }

    const previousStatus = existing.status;
    const updateData: Record<string, any> = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined)
      updateData.processingDescription = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.ownerId !== undefined) updateData.ownerId = dto.ownerId;
    if (dto.reviewerId !== undefined) updateData.reviewerId = dto.reviewerId;
    if (dto.riskScore !== undefined) {
      updateData.overallRiskScore = dto.riskScore;
      // Derive risk level from score
      if (dto.riskScore >= 75) updateData.overallRiskLevel = 'critical';
      else if (dto.riskScore >= 50) updateData.overallRiskLevel = 'high';
      else if (dto.riskScore >= 25) updateData.overallRiskLevel = 'medium';
      else updateData.overallRiskLevel = 'low';
    }
    if (dto.dueDate !== undefined) {
      updateData.nextReviewDate = new Date(dto.dueDate);
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = actorId;
      }
    }

    const updated = await this.prisma.privacyAssessment.update({
      where: { id },
      data: updateData,
    });

    // Log status change separately if status changed
    if (dto.status !== undefined && dto.status !== previousStatus) {
      await this.audit.log({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'assessment.status_changed',
        entityType: 'privacy_assessment',
        entityId: id,
        changes: {
          before: { status: previousStatus },
          after: { status: dto.status },
        },
      });
    } else {
      await this.audit.log({
        tenantId,
        actorId,
        actorType: 'user',
        action: 'assessment.updated',
        entityType: 'privacy_assessment',
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
  // Delete (soft delete / archive)
  // ---------------------------------------------------------------------------

  async delete(tenantId: string, id: string, actorId: string) {
    const existing = await this.prisma.privacyAssessment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }

    const archived = await this.prisma.privacyAssessment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'archived',
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'assessment.status_changed',
      entityType: 'privacy_assessment',
      entityId: id,
      changes: {
        before: { status: existing.status },
        after: { status: 'archived', deletedAt: archived.deletedAt },
      },
    });

    return archived;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(tenantId: string) {
    const [byStatus, byType, totalCount] = await Promise.all([
      this.prisma.privacyAssessment.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.privacyAssessment.groupBy({
        by: ['type'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.privacyAssessment.count({
        where: { tenantId, deletedAt: null },
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

    return {
      total: totalCount,
      byStatus: statusCounts,
      byType: typeCounts,
    };
  }
}
