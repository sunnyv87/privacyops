import { Injectable, Logger } from '@nestjs/common';
import { TemporalClient } from './temporal.client';
import { PrismaService } from '@/core/prisma/prisma.service';

export const TASK_QUEUES = {
  SCAN: 'scan-queue',
  DSAR: 'dsar-queue',
  CONSENT: 'consent-queue',
  BREACH: 'breach-queue',
  RETENTION: 'retention-queue',
  APPROVAL: 'approval-queue',
  VENDOR: 'vendor-queue',
} as const;

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly temporal: TemporalClient,
    private readonly prisma: PrismaService,
  ) {}

  async startScanWorkflow(input: {
    scanJobId: string;
    tenantId: string;
    dataSourceId: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; scan workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('scanWorkflow', {
      taskQueue: TASK_QUEUES.SCAN,
      workflowId: `scan-${input.scanJobId}`,
      args: [input],
    });

    this.logger.log(`Started scan workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startDsarWorkflow(input: {
    requestId: string;
    tenantId: string;
    type: string;
    dueDateIso: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; DSAR workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('dsarWorkflow', {
      taskQueue: TASK_QUEUES.DSAR,
      workflowId: `dsar-${input.requestId}`,
      args: [input],
    });

    this.logger.log(`Started DSAR workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startBreachWorkflow(input: {
    incidentId: string;
    tenantId: string;
    severity: string;
    deadlineIso: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; breach workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('breachNotificationWorkflow', {
      taskQueue: TASK_QUEUES.BREACH,
      workflowId: `breach-${input.incidentId}`,
      args: [input],
    });

    this.logger.log(`Started breach workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startRetentionDisposalWorkflow(input: {
    policyId: string;
    tenantId: string;
    action: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; retention workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('retentionDisposalWorkflow', {
      taskQueue: TASK_QUEUES.RETENTION,
      workflowId: `retention-${input.policyId}-${Date.now()}`,
      args: [input],
    });

    this.logger.log(`Started retention workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startDpiaApprovalWorkflow(input: {
    assessmentId: string;
    tenantId: string;
    reviewerId: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; DPIA approval workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('dpiaApprovalWorkflow', {
      taskQueue: TASK_QUEUES.APPROVAL,
      workflowId: `dpia-approval-${input.assessmentId}`,
      args: [input],
    });

    this.logger.log(`Started DPIA approval workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startRemediationWorkflow(input: {
    findingId: string;
    tenantId: string;
    actionType: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; remediation workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('remediationWorkflow', {
      taskQueue: TASK_QUEUES.APPROVAL,
      workflowId: `remediation-${input.findingId}`,
      args: [input],
    });

    this.logger.log(`Started remediation workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startVendorReviewWorkflow(input: {
    vendorId: string;
    assessmentId: string;
    tenantId: string;
    dueDate: string;
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; vendor review workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('vendorReviewWorkflow', {
      taskQueue: TASK_QUEUES.VENDOR,
      workflowId: `vendor-review-${input.assessmentId}`,
      args: [input],
    });

    this.logger.log(`Started vendor review workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async startDataDeletionWorkflow(input: {
    policyId: string;
    tenantId: string;
    assetIds: string[];
  }) {
    if (!this.temporal.isConnected) {
      this.logger.warn('Temporal not connected; data deletion workflow will not start');
      return null;
    }

    const handle = await this.temporal.client.workflow.start('dataDeletionWorkflow', {
      taskQueue: TASK_QUEUES.RETENTION,
      workflowId: `data-deletion-${input.policyId}-${Date.now()}`,
      args: [input],
    });

    this.logger.log(`Started data deletion workflow: ${handle.workflowId}`);
    return handle.workflowId;
  }

  async getWorkflowTasks(tenantId: string, workflowId: string) {
    return this.prisma.workflow_tasks.findMany({
      where: { tenant_id: tenantId, workflow_id: workflowId },
      orderBy: { created_at: 'asc' },
    });
  }

  async updateTaskStatus(tenantId: string, taskId: string, status: string, userId: string) {
    const task = await this.prisma.workflow_tasks.update({
      where: { id: taskId, tenant_id: tenantId },
      data: {
        status,
        updated_by: userId,
        updated_at: new Date(),
        ...(status === 'completed' ? { completed_at: new Date() } : {}),
      },
    });

    this.logger.log(`Task ${taskId} updated to ${status} by ${userId}`);
    return task;
  }

  async createWorkflowRecord(
    tenantId: string,
    type: string,
    entityType: string,
    entityId: string,
    temporalWorkflowId: string,
    triggerType?: string,
    priority?: string,
    assigneeId?: string,
  ) {
    const record = await this.prisma.workflows.create({
      data: {
        tenant_id: tenantId,
        type,
        entity_type: entityType,
        entity_id: entityId,
        temporal_workflow_id: temporalWorkflowId,
        trigger_type: triggerType ?? 'manual',
        priority: priority ?? 'medium',
        assignee_id: assigneeId,
        status: 'running',
        created_at: new Date(),
      },
    });

    this.logger.log(`Created workflow record ${record.id} for ${type}`);
    return record;
  }

  async getWorkflowStatus(workflowId: string) {
    if (!this.temporal.isConnected) return null;

    try {
      const handle = this.temporal.client.workflow.getHandle(workflowId);
      const description = await handle.describe();
      return {
        workflowId,
        status: description.status.name,
        startTime: description.startTime,
        closeTime: description.closeTime,
      };
    } catch {
      return null;
    }
  }
}
