import { Module } from '@nestjs/common';
import { DataGraphController } from './data-graph.controller';
import { DataGraphService } from './data-graph.service';
import { DataGraphSyncService } from './data-graph-sync.service';
import { GraphAnalyticsService } from './graph-analytics.service';
import { GraphEnrichmentService } from './graph-enrichment.service';
import { GraphAnalyticsController } from './graph-analytics.controller';

@Module({
  controllers: [DataGraphController, GraphAnalyticsController],
  providers: [DataGraphService, DataGraphSyncService, GraphAnalyticsService, GraphEnrichmentService],
  exports: [DataGraphService, DataGraphSyncService, GraphAnalyticsService, GraphEnrichmentService],
})
export class DataGraphModule {}
