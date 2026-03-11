import { Module } from '@nestjs/common';
import { AdaptivePoliciesController } from './adaptive-policies.controller';
import { AdaptivePolicyService } from './adaptive-policy.service';
import { PolicyEvaluationEngine } from './policy-evaluation.engine';

@Module({
  controllers: [AdaptivePoliciesController],
  providers: [AdaptivePolicyService, PolicyEvaluationEngine],
  exports: [AdaptivePolicyService],
})
export class AdaptivePoliciesModule {}
