import { Module } from '@nestjs/common';
import { DspmController } from './dspm.controller';
import { DspmService } from './dspm.service';
import { RiskIntelligenceService } from './risk-intelligence.service';
import { RiskIntelligenceController } from './risk-intelligence.controller';
import { PredictiveRiskService } from './predictive-risk.service';
import { PredictiveRiskController } from './predictive-risk.controller';

@Module({
  controllers: [DspmController, RiskIntelligenceController, PredictiveRiskController],
  providers: [DspmService, RiskIntelligenceService, PredictiveRiskService],
  exports: [DspmService, RiskIntelligenceService, PredictiveRiskService],
})
export class DspmModule {}
