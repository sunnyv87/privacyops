import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { RemediationExecutorService } from './remediation-executor.service';
import { RemediationFilterDto } from './dto/remediation.dto';

@Injectable()
export class RemediationService {
  private readonly logger = new Logger(RemediationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly executor: RemediationExecutorService,
  ) {}

  async proposeAction(
    tenantId: string,
    findingId: string,
    actionType: string,
    userId: string,
  ) {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: findingId, tenantId, deletedAt: null },
    });

    if (!finding) {
      throw new NotFoundException(`Risk finding ${findingId} not found`);
    }

    // Capture rollback state before creating the action
    const rollbackData = await this.executor.captureRollbackState(tenantId, findingId);

    const action = await this.prisma.remediationAction.create({
      data: {
        tenantId,
        findingId,
        actionType,
        status: 'proposed',
        proposedBy: userId,
        rollbackData: rollbackData || {},
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'remediation.proposed',
      entityType: 'remediation_action',
      entityId: action.id,
      changes: {
        after: { actionType, findingId, status: 'proposed' },
      },
    });

    await this.events.publish({
      type: 'remediation.proposed',
      tenantId,
      data: { actionId: action.id, findingId, actionType },
      timestamp: new Date(),
    });

    return action;
  }

  async approveAction(tenantId: string, actionId: string, userId: string) {
    const action = await this.prisma.remediationAction.findFirst({
      where: { id: actionId, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Remediation action ${actionId} not found`);
    }

    const updated = await this.prisma.remediationAction.update({
      where: { id: actionId },
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
      action: 'remediation.approved',
      entityType: 'remediation_action',
      entityId: actionId,
      changes: {
        before: { status: action.status },
        after: { status: 'approved' },
      },
    });

    await this.events.publish({
      type: 'remediation.approved',
      tenantId,
      data: { actionId, approvedBy: userId },
      timestamp: new Date(),
    });

    return updated;
  }

  async executeAction(tenantId: string, actionId: string, userId: string) {
    const action = await this.prisma.remediationAction.findFirst({
      where: { id: actionId, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Remediation action ${actionId} not found`);
    }

    // Validate before execution
    const validation = await this.executor.validate(action);
    if (!validation.valid) {
      throw new Error(`Action cannot be executed: ${validation.message}`);
    }

    await this.prisma.remediationAction.update({
      where: { id: actionId },
      data: { status: 'executing', executedAt: new Date() },
    });

    try {
      const result = await this.executor.execute(action);

      const updated = await this.prisma.remediationAction.update({
        where: { id: actionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          executionResult: result,
        },
      });

      await this.audit.log({
        tenantId,
        actorId: userId,
        actorType: 'user',
        action: 'remediation.executed',
        entityType: 'remediation_action',
        entityId: actionId,
        changes: {
          after: { status: 'completed', result },
        },
      });

      await this.events.publish({
        type: 'remediation.completed',
        tenantId,
        data: { actionId, executedBy: userId, result },
        timestamp: new Date(),
      });

      return updated;
    } catch (error) {
      await this.prisma.remediationAction.update({
        where: { id: actionId },
        data: {
          status: 'failed',
          executionResult: { error: error.message },
        },
      });

      this.logger.error(
        `Remediation action ${actionId} failed: ${error.message}`,
      );

      throw error;
    }
  }

  async rollbackAction(tenantId: string, actionId: string, userId: string) {
    const action = await this.prisma.remediationAction.findFirst({
      where: { id: actionId, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Remediation action ${actionId} not found`);
    }

    const rollbackData = action.rollbackData as Record<string, any>;
    if (!rollbackData || Object.keys(rollbackData).length === 0) {
      throw new Error('No rollback data available for this action');
    }

    // Restore the previous state
    if (rollbackData.assetId && rollbackData.assetMetadata) {
      await this.prisma.asset.update({
        where: { id: rollbackData.assetId },
        data: { metadata: rollbackData.assetMetadata },
      });
    }

    if (rollbackData.findingId && rollbackData.findingStatus) {
      await this.prisma.riskFinding.update({
        where: { id: rollbackData.findingId },
        data: { status: rollbackData.findingStatus },
      });
    }

    const updated = await this.prisma.remediationAction.update({
      where: { id: actionId },
      data: {
        status: 'rolled_back',
        rolledBackAt: new Date(),
        rolledBackBy: userId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'remediation.rolled_back',
      entityType: 'remediation_action',
      entityId: actionId,
      changes: {
        before: { status: action.status },
        after: { status: 'rolled_back' },
      },
    });

    await this.events.publish({
      type: 'remediation.rolled_back',
      tenantId,
      data: { actionId, rolledBackBy: userId },
      timestamp: new Date(),
    });

    return updated;
  }

  async findActions(tenantId: string, filters: RemediationFilterDto = {}) {
    const { page = 1, pageSize = 20, status, actionType, findingId } = filters;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(actionType && { actionType }),
      ...(findingId && { findingId }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.remediationAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.remediationAction.count({ where }),
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
    const action = await this.prisma.remediationAction.findFirst({
      where: { id, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Remediation action ${id} not found`);
    }

    return action;
  }
}
