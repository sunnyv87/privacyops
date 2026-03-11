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
  // Check DPIA Triggers
  // ---------------------------------------------------------------------------

  async checkTriggers(
    tenantId: string,
    context: {
      dataCategories?: string[];
      subjectCount?: number;
      crossBorder?: boolean;
      aiUsage?: boolean;
    },
  ) {
    const rules = await this.prisma.dpiaTriggerRule.findMany({
      where: { tenantId, isActive: true },
    });

    const matchedRules: any[] = [];

    for (const rule of rules) {
      const condition = rule.condition as Record<string, any>;
      let matched = false;

      if (
        condition.dataCategories &&
        context.dataCategories?.some((c) =>
          (condition.dataCategories as string[]).includes(c),
        )
      ) {
        matched = true;
      }

      if (
        condition.minSubjectCount &&
        context.subjectCount &&
        context.subjectCount >= condition.minSubjectCount
      ) {
        matched = true;
      }

      if (condition.crossBorder && context.crossBorder) {
        matched = true;
      }

      if (condition.aiUsage && context.aiUsage) {
        matched = true;
      }

      if (matched) {
        matchedRules.push({
          ruleId: rule.id,
          name: rule.name,
          condition: rule.condition,
        });
      }
    }

    return {
      triggered: matchedRules.length > 0,
      matchedRules,
      suggestedType:
        matchedRules.length > 0 ? 'full_dpia' : 'screening',
    };
  }

  // ---------------------------------------------------------------------------
  // Calculate Privacy Risk
  // ---------------------------------------------------------------------------

  async calculatePrivacyRisk(tenantId: string, assessmentId: string) {
    const assessment = await this.prisma.privacyAssessment.findFirst({
      where: { id: assessmentId, tenantId, deletedAt: null },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    let score = 0;
    const dataCategories = (assessment.dataCategories as string[]) || [];

    // Score based on data categories
    const sensitiveCategories = [
      'health',
      'biometric',
      'genetic',
      'racial',
      'political',
      'religious',
      'sexual_orientation',
    ];
    const hasSensitive = dataCategories.some((c) =>
      sensitiveCategories.includes(c),
    );
    if (hasSensitive) score += 30;
    if (dataCategories.length > 5) score += 10;

    // Score based on processing description (proxy for volume)
    const description = assessment.processingDescription || '';
    if (description.toLowerCase().includes('large scale')) score += 20;
    if (description.toLowerCase().includes('systematic')) score += 10;

    // Score based on cross-border indicators
    if (description.toLowerCase().includes('cross-border')) score += 15;
    if (description.toLowerCase().includes('international')) score += 15;

    // Cap at 100
    score = Math.min(score, 100);

    // Derive risk level
    let riskLevel: string;
    if (score >= 75) riskLevel = 'critical';
    else if (score >= 50) riskLevel = 'high';
    else if (score >= 25) riskLevel = 'medium';
    else riskLevel = 'low';

    await this.prisma.privacyAssessment.update({
      where: { id: assessmentId },
      data: {
        privacyRiskScore: score,
        overallRiskScore: score,
        overallRiskLevel: riskLevel,
      },
    });

    return {
      assessmentId,
      privacyRiskScore: score,
      riskLevel,
      factors: {
        sensitiveData: hasSensitive,
        dataCategoryCount: dataCategories.length,
        crossBorderIndicators:
          description.toLowerCase().includes('cross-border') ||
          description.toLowerCase().includes('international'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Link to Processing (RoPA)
  // ---------------------------------------------------------------------------

  async linkToProcessing(
    tenantId: string,
    assessmentId: string,
    ropaId: string,
  ) {
    const assessment = await this.prisma.privacyAssessment.findFirst({
      where: { id: assessmentId, tenantId, deletedAt: null },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const updated = await this.prisma.privacyAssessment.update({
      where: { id: assessmentId },
      data: { linkedRopaId: ropaId },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'assessment.linked_to_ropa',
      entityType: 'privacy_assessment',
      entityId: assessmentId,
      changes: {
        before: { linkedRopaId: assessment.linkedRopaId },
        after: { linkedRopaId: ropaId },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // DPIA Trigger Rules CRUD
  // ---------------------------------------------------------------------------

  async createTriggerRule(
    tenantId: string,
    dto: { name: string; condition: any; isActive?: boolean },
  ) {
    const rule = await this.prisma.dpiaTriggerRule.create({
      data: {
        tenantId,
        name: dto.name,
        condition: dto.condition,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'dpia_trigger_rule.created',
      entityType: 'dpia_trigger_rule',
      entityId: rule.id,
      changes: { after: dto },
    });

    return rule;
  }

  async findTriggerRules(tenantId: string) {
    return this.prisma.dpiaTriggerRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTriggerRule(
    tenantId: string,
    ruleId: string,
    dto: { name?: string; condition?: any; isActive?: boolean },
  ) {
    const existing = await this.prisma.dpiaTriggerRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Trigger rule ${ruleId} not found`);
    }

    const updated = await this.prisma.dpiaTriggerRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.condition !== undefined && { condition: dto.condition }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'dpia_trigger_rule.updated',
      entityType: 'dpia_trigger_rule',
      entityId: ruleId,
      changes: {
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  async deleteTriggerRule(tenantId: string, ruleId: string) {
    const existing = await this.prisma.dpiaTriggerRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Trigger rule ${ruleId} not found`);
    }

    await this.prisma.dpiaTriggerRule.delete({
      where: { id: ruleId },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'dpia_trigger_rule.deleted',
      entityType: 'dpia_trigger_rule',
      entityId: ruleId,
      changes: {
        before: existing,
        after: null,
      },
    });

    return { deleted: true };
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
