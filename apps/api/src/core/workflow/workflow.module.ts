import { Global, Module } from '@nestjs/common';
import { TemporalClient } from './temporal.client';
import { WorkflowService } from './workflow.service';
import { EventTriggerService } from './event-trigger.service';

@Global()
@Module({
  providers: [TemporalClient, WorkflowService, EventTriggerService],
  exports: [WorkflowService, EventTriggerService],
})
export class WorkflowModule {}
