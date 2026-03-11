import { Module } from '@nestjs/common';
import { AiGovernanceController } from './ai-governance.controller';
import { AiGovernanceService } from './ai-governance.service';
import { AiRiskClassifierService } from './ai-risk-classifier.service';
import { AiLineageTrackerService } from './ai-lineage-tracker.service';
import { AiGovernanceIntelligenceController } from './ai-governance-intelligence.controller';

@Module({
  controllers: [AiGovernanceController, AiGovernanceIntelligenceController],
  providers: [AiGovernanceService, AiRiskClassifierService, AiLineageTrackerService],
  exports: [AiGovernanceService],
})
export class AiGovernanceModule {}
