import { Module } from '@nestjs/common';
import { ShadowDataController } from './shadow-data.controller';
import { ShadowDataService } from './shadow-data.service';
import { FingerprintService } from './fingerprint.service';
import { OwnershipInferenceService } from './ownership-inference.service';

@Module({
  controllers: [ShadowDataController],
  providers: [ShadowDataService, FingerprintService, OwnershipInferenceService],
  exports: [ShadowDataService],
})
export class ShadowDataModule {}
