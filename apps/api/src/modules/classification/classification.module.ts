import { Module } from '@nestjs/common';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './classification.service';
import { MlClassifierClient } from './engine/ml-classifier.client';

@Module({
  controllers: [ClassificationController],
  providers: [ClassificationService, MlClassifierClient],
  exports: [ClassificationService, MlClassifierClient],
})
export class ClassificationModule {}
