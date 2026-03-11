import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateRetentionPolicyDto,
  UpdateRetentionPolicyDto,
  RetentionFilterDto,
} from './dto/retention.dto';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateRetentionPolicyDto) {
    const policy = await this.prisma.retentionPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        recordCategory: dto.recordCategory,
        retentionPeriodDays: dto.retentionDays,
        actionOnExpiry: dto.actionOnExpiry,
        legalBasis: dto.legalBasis,
        applicableRegulations: dto.regulationReference
          ? [dto.regulationReference]
          : undefined,
        status: 'active',
        createdBy: actorId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.created',
      entityType: 'retention_policy',
      entityId: policy.id,
      changes: { after: dto },
    });

    this.logger.log(`Retention policy ${policy.id} created by ${actorId}`);

    return policy;
  }

  async findAll(
    tenantId: string,
    filters?: RetentionFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, recordCategory, activeOnly } = filters || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(recordCategory && { recordCategory }),
      ...(activeOnly && { status: 'active' }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.retentionPolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.retentionPolicy.count({ where }),
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
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!policy) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    return policy;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateRetentionPolicyDto,
  ) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    const updated = await this.prisma.retentionPolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.recordCategory !== undefined && { recordCategory: dto.recordCategory }),
        ...(dto.retentionDays !== undefined && { retentionPeriodDays: dto.retentionDays }),
        ...(dto.actionOnExpiry !== undefined && { actionOnExpiry: dto.actionOnExpiry }),
        ...(dto.legalBasis !== undefined && { legalBasis: dto.legalBasis }),
        ...(dto.isActive !== undefined && { status: dto.isActive ? 'active' : 'inactive' }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.updated',
      entityType: 'retention_policy',
      entityId: id,
      changes: {
        before: {
          name: existing.name,
          recordCategory: existing.recordCategory,
          retentionPeriodDays: existing.retentionPeriodDays,
          actionOnExpiry: existing.actionOnExpiry,
          status: existing.status,
        },
        after: dto,
      },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, actorId: string) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    const deactivated = await this.prisma.retentionPolicy.update({
      where: { id },
      data: {
        status: 'inactive',
        deletedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.deactivated',
      entityType: 'retention_policy',
      entityId: id,
      changes: {
        before: { status: existing.status },
        after: { status: 'inactive' },
      },
    });

    return deactivated;
  }

  async triggerDisposal(tenantId: string, policyId: string, actorId: string) {
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: { id: policyId, tenantId, deletedAt: null },
    });

    if (!policy) {
      throw new NotFoundException(`Retention policy ${policyId} not found`);
    }

    // Create a workflow record for the disposal process
    const workflow = await this.prisma.workflow.create({
      data: {
        tenantId,
        type: 'retention',
        status: 'active',
        entityType: 'retention_policy',
        entityId: policyId,
        currentStep: 'disposal_initiated',
        metadata: {
          policyName: policy.name,
          actionOnExpiry: policy.actionOnExpiry,
          recordCategory: policy.recordCategory,
          triggeredBy: actorId,
          triggeredAt: new Date().toISOString(),
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention.disposal.triggered',
      entityType: 'retention_policy',
      entityId: policyId,
      changes: {
        after: {
          workflowId: workflow.id,
          actionOnExpiry: policy.actionOnExpiry,
        },
      },
    });

    await this.events.publish({
      type: 'retention.policy.triggered',
      tenantId,
      data: {
        policyId,
        workflowId: workflow.id,
        actionOnExpiry: policy.actionOnExpiry,
        recordCategory: policy.recordCategory,
        actorId,
      },
      timestamp: new Date(),
    });

    await this.events.publish({
      type: 'retention.disposal.completed',
      tenantId,
      data: {
        policyId,
        workflowId: workflow.id,
        actionOnExpiry: policy.actionOnExpiry,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Disposal triggered for retention policy ${policyId} (action: ${policy.actionOnExpiry})`,
    );

    return {
      workflowId: workflow.id,
      policyId,
      action: policy.actionOnExpiry,
      status: 'disposal_initiated',
    };
  }
}
