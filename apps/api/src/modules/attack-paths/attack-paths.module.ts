import { Module } from '@nestjs/common';
import { AttackPathsController } from './attack-paths.controller';
import { AttackPathsService } from './attack-paths.service';
import { AttackPathAnalyzer } from './attack-path-analyzer';

@Module({
  controllers: [AttackPathsController],
  providers: [AttackPathsService, AttackPathAnalyzer],
  exports: [AttackPathsService],
})
export class AttackPathsModule {}
