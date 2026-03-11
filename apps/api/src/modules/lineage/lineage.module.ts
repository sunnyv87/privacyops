import { Module } from '@nestjs/common';
import { LineageController } from './lineage.controller';
import { LineageService } from './lineage.service';
import { BreachImpactAnalyzer } from './breach-impact-analyzer';

@Module({
  controllers: [LineageController],
  providers: [LineageService, BreachImpactAnalyzer],
  exports: [LineageService],
})
export class LineageModule {}
