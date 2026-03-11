import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '@/core/events/event-bus.service';
import { WorkflowService } from './workflow.service';

interface EventTriggerRule {
  eventPattern: string;
  workflowStarter: string;
  condition?: (data: any) => boolean;
  inputMapper: (data: any) => any;
}

@Injectable()
export class EventTriggerService implements OnModuleInit {
  private readonly logger = new Logger(EventTriggerService.name);
  private rules: EventTriggerRule[] = [];

  constructor(
    private readonly events: EventBusService,
    private readonly workflows: WorkflowService,
  ) {}

  async onModuleInit() {
    this.registerDefaultRules();
    await this.subscribeAll();
  }

  registerRule(rule: EventTriggerRule) {
    this.rules.push(rule);
  }

  private registerDefaultRules() {
    this.registerRule({
      eventPattern: 'privacyops.finding.created',
      workflowStarter: 'startRemediationWorkflow',
      condition: (data) => data.severity === 'critical',
      inputMapper: (data) => ({
        findingId: data.findingId,
        tenantId: data.tenantId,
        actionType: 'trigger_review',
      }),
    });

    this.registerRule({
      eventPattern: 'privacyops.assessment.submitted',
      workflowStarter: 'startDpiaApprovalWorkflow',
      inputMapper: (data) => ({
        assessmentId: data.assessmentId,
        tenantId: data.tenantId,
        reviewerId: data.reviewerId,
      }),
    });

    this.registerRule({
      eventPattern: 'privacyops.vendor.assessment.due',
      workflowStarter: 'startVendorReviewWorkflow',
      inputMapper: (data) => ({
        vendorId: data.vendorId,
        assessmentId: data.assessmentId,
        tenantId: data.tenantId,
        dueDate: data.dueDate,
      }),
    });

    this.registerRule({
      eventPattern: 'privacyops.retention.policy.triggered',
      workflowStarter: 'startDataDeletionWorkflow',
      inputMapper: (data) => ({
        policyId: data.policyId,
        tenantId: data.tenantId,
        assetIds: data.assetIds || [],
      }),
    });
  }

  private async subscribeAll() {
    for (const rule of this.rules) {
      try {
        await this.events.subscribe(
          rule.eventPattern,
          `trigger-${rule.workflowStarter}`,
          async (event) => {
            if (rule.condition && !rule.condition(event.data)) return;
            const input = rule.inputMapper(event.data);
            try {
              await (this.workflows as any)[rule.workflowStarter](input);
              this.logger.log(`Triggered ${rule.workflowStarter} from ${rule.eventPattern}`);
            } catch (err) {
              this.logger.error(`Failed to trigger ${rule.workflowStarter}: ${err.message}`);
            }
          },
        );
      } catch {
        this.logger.warn(`Could not subscribe to ${rule.eventPattern} (NATS may be unavailable)`);
      }
    }
  }
}
