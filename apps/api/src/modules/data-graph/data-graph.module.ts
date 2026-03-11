import { Module } from '@nestjs/common';
import { DataGraphController } from './data-graph.controller';
import { DataGraphService } from './data-graph.service';
import { DataGraphSyncService } from './data-graph-sync.service';

@Module({
  controllers: [DataGraphController],
  providers: [DataGraphService, DataGraphSyncService],
  exports: [DataGraphService, DataGraphSyncService],
})
export class DataGraphModule {}
