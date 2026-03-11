import { Module } from '@nestjs/common';
import { AttackPathsController } from './attack-paths.controller';
import { AttackPathsService } from './attack-paths.service';
import { AttackPathAnalyzer } from './attack-path-analyzer';
import { AttackSimulationService } from './attack-simulation.service';
import { AttackSimulationController } from './attack-simulation.controller';

@Module({
  controllers: [AttackPathsController, AttackSimulationController],
  providers: [AttackPathsService, AttackPathAnalyzer, AttackSimulationService],
  exports: [AttackPathsService],
})
export class AttackPathsModule {}
