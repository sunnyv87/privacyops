import { Module } from '@nestjs/common';
import { RemediationController } from './remediation.controller';
import { RemediationService } from './remediation.service';
import { RemediationExecutorService } from './remediation-executor.service';

@Module({
  controllers: [RemediationController],
  providers: [RemediationService, RemediationExecutorService],
  exports: [RemediationService],
})
export class RemediationModule {}
