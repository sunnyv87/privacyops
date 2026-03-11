import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ShadowDataService } from './shadow-data.service';
import { AiDatasetService } from './ai-dataset.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, ShadowDataService, AiDatasetService],
  exports: [DiscoveryService, ShadowDataService, AiDatasetService],
})
export class DiscoveryModule {}
