import { Module } from '@nestjs/common';
import { CoPilotController } from './co-pilot.controller';
import { CoPilotService } from './co-pilot.service';
import { QueryInterpreterService } from './query-interpreter.service';
import { ContextAssemblerService } from './context-assembler.service';

@Module({
  controllers: [CoPilotController],
  providers: [CoPilotService, QueryInterpreterService, ContextAssemblerService],
  exports: [CoPilotService],
})
export class CoPilotModule {}
