import { Module } from '@nestjs/common';
import { ThreatHuntingController } from './threat-hunting.controller';
import { ThreatHuntingService } from './threat-hunting.service';
import { AccessPatternAnalyzer } from './access-pattern-analyzer.service';

@Module({
  controllers: [ThreatHuntingController],
  providers: [ThreatHuntingService, AccessPatternAnalyzer],
  exports: [ThreatHuntingService],
})
export class ThreatHuntingModule {}
