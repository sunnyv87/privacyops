import { Injectable, Logger } from '@nestjs/common';
import { TemporalClient } from './temporal.client';

export const TASK_QUEUES = {
  SCAN: 'scan-queue',
  DSAR: 'dsar-queue',
  CONSENT: 'consent-queue',
  BREACH: 'breach-queue',
  RETENTION: 'retention-queue',
} as const;

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly temporal: TemporalClient) {}

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
