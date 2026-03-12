import { Global, Module } from '@nestjs/common';
import { TemporalClient } from './temporal.client';
import { WorkflowService } from './workflow.service';
import { EventTriggerService } from './event-trigger.service';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { WorkflowGateway } from './workflow.gateway';

@Global()
@Module({
  providers: [
    TemporalClient,
    WorkflowService,
    EventTriggerService,
    ScheduledJobsService,
    WorkflowGateway,
  ],
  exports: [WorkflowService, EventTriggerService, WorkflowGateway],
})
export class WorkflowModule {}
