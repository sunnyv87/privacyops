import { Module } from '@nestjs/common';
import { PlatformOptimizationController } from './platform-optimization.controller';
import { OptimizationAnalyzer } from './optimization-analyzer.service';

@Module({
  controllers: [PlatformOptimizationController],
  providers: [OptimizationAnalyzer],
  exports: [OptimizationAnalyzer],
})
export class PlatformOptimizationModule {}
