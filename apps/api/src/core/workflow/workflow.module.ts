import { Global, Module } from '@nestjs/common';
import { TemporalClient } from './temporal.client';
import { WorkflowService } from './workflow.service';

@Global()
@Module({
  providers: [TemporalClient, WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
