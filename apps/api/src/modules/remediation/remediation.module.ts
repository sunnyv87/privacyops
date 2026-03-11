import { Module } from '@nestjs/common';
import { RemediationController } from './remediation.controller';
import { RemediationService } from './remediation.service';
import { RemediationExecutorService } from './remediation-executor.service';
import { RemediationAgentService } from './remediation-agent.service';
import { RemediationAgentController } from './remediation-agent.controller';

@Module({
  controllers: [RemediationController, RemediationAgentController],
  providers: [RemediationService, RemediationExecutorService, RemediationAgentService],
  exports: [RemediationService],
})
export class RemediationModule {}
