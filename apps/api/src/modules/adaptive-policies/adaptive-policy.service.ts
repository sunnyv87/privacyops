import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { PolicyEvaluationEngine } from './policy-evaluation.engine';

@Injectable()
export class AdaptivePolicyService {
  private readonly logger = new Logger(AdaptivePolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly evaluationEngine: PolicyEvaluationEngine,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: {
      name: string;
      policyType: string;
      triggerConditions: any[];
      actions: any[];
      cooldownMinutes?: number;
      requiresApproval?: boolean;
    },
  ) {
    const policy = await this.prisma.adaptivePolicy.create({
      data: {
        tenantId,
        name: dto.name,
        policyType: dto.policyType,
        triggerConditions: dto.triggerConditions,
        actions: dto.actions,
        cooldownMinutes: dto.cooldownMinutes || 60,
        requiresApproval: dto.requiresApproval ?? true,
        isEnabled: true,
        createdBy: userId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'adaptive_policy.created',
      entityType: 'adaptive_policy',
      entityId: policy.id,
      changes: {
        after: {
          name: dto.name,
          policyType: dto.policyType,
          triggerConditions: dto.triggerConditions,
        },
      },
    });

    this.logger.log(`Adaptive policy ${policy.id} created by ${userId}`);

    return policy;
  }

  async findAll(
    tenantId: string,
    filters: {
      policyType?: string;
      isEnabled?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, policyType, isEnabled } = filters;

    const where: any = {
      tenantId,
      ...(policyType && { policyType }),
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.adaptivePolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adaptivePolicy.count({ where }),
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
    const policy = await this.prisma.adaptivePolicy.findFirst({
      where: { id, tenantId },
    });

    if (!policy) {
      throw new NotFoundException(`Adaptive policy ${id} not found`);
    }

    return policy;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      name: string;
      triggerConditions: any[];
      actions: any[];
      isEnabled: boolean;
      cooldownMinutes: number;
      requiresApproval: boolean;
    }>,
  ) {
    const policy = await this.prisma.adaptivePolicy.findFirst({
      where: { id, tenantId },
    });

    if (!policy) {
      throw new NotFoundException(`Adaptive policy ${id} not found`);
    }

    const updated = await this.prisma.adaptivePolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.triggerConditions !== undefined && {
          triggerConditions: dto.triggerConditions,
        }),
        ...(dto.actions !== undefined && { actions: dto.actions }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.cooldownMinutes !== undefined && {
          cooldownMinutes: dto.cooldownMinutes,
        }),
        ...(dto.requiresApproval !== undefined && {
          requiresApproval: dto.requiresApproval,
        }),
      },
    });

    this.logger.log(`Adaptive policy ${id} updated`);

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const policy = await this.prisma.adaptivePolicy.findFirst({
      where: { id, tenantId },
    });

    if (!policy) {
      throw new NotFoundException(`Adaptive policy ${id} not found`);
    }

    await this.prisma.adaptivePolicy.delete({ where: { id } });

    this.logger.log(`Adaptive policy ${id} deleted`);

    return { deleted: true };
  }

  async evaluatePolicy(tenantId: string, id: string) {
    const policy = await this.prisma.adaptivePolicy.findFirst({
      where: { id, tenantId },
    });

    if (!policy) {
      throw new NotFoundException(`Adaptive policy ${id} not found`);
    }

    const result = await this.evaluationEngine.evaluate(tenantId, policy);

    // Update lastEvaluatedAt
    await this.prisma.adaptivePolicy.update({
      where: { id },
      data: { lastEvaluatedAt: new Date() },
    });

    if (result.triggered) {
      // Check cooldown
      const inCooldown = this.isInCooldown(policy);

      if (!inCooldown) {
        // Determine execution status based on approval requirement
        const executionStatus = policy.requiresApproval
          ? 'pending'
          : 'executing';

        const execution = await this.prisma.policyExecution.create({
          data: {
            tenantId,
            policyId: id,
            status: executionStatus,
            triggerData: {
              matchedConditions: result.matchedConditions,
              signalValues: result.signalValues,
            },
          },
        });

        // Update policy trigger metadata
        await this.prisma.adaptivePolicy.update({
          where: { id },
          data: {
            lastTriggeredAt: new Date(),
            triggerCount: { increment: 1 },
          },
        });

        await this.events.publish({
          type: 'policy.triggered',
          tenantId,
          data: {
            policyId: id,
            policyName: policy.name,
            executionId: execution.id,
            matchedConditions: result.matchedConditions,
            requiresApproval: policy.requiresApproval,
          },
          timestamp: new Date(),
        });

        this.logger.log(
          `Policy ${id} triggered, execution ${execution.id} created (status: ${executionStatus})`,
        );

        return {
          ...result,
          executionId: execution.id,
          executionStatus,
        };
      }

      this.logger.log(
        `Policy ${id} triggered but is in cooldown period`,
      );

      return {
        ...result,
        inCooldown: true,
      };
    }

    return result;
  }

  async getExecutions(
    tenantId: string,
    policyId: string,
    filters: {
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, status } = filters;

    const where: any = {
      tenantId,
      policyId,
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.policyExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.policyExecution.count({ where }),
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

  async approveExecution(
    tenantId: string,
    executionId: string,
    userId: string,
  ) {
    const execution = await this.prisma.policyExecution.findFirst({
      where: { id: executionId, tenantId },
    });

    if (!execution) {
      throw new NotFoundException(
        `Policy execution ${executionId} not found`,
      );
    }

    const updated = await this.prisma.policyExecution.update({
      where: { id: executionId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'policy_execution.approved',
      entityType: 'policy_execution',
      entityId: executionId,
      changes: {
        before: { status: execution.status },
        after: { status: 'approved', approvedBy: userId },
      },
    });

    await this.events.publish({
      type: 'policy.executed',
      tenantId,
      data: {
        executionId,
        policyId: execution.policyId,
        approvedBy: userId,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Policy execution ${executionId} approved by ${userId}`,
    );

    return updated;
  }

  private isInCooldown(policy: any): boolean {
    if (!policy.lastTriggeredAt) return false;

    const cooldownMs = (policy.cooldownMinutes || 60) * 60 * 1000;
    const elapsed = Date.now() - new Date(policy.lastTriggeredAt).getTime();

    return elapsed < cooldownMs;
  }
}
