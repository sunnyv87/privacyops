import { Module } from '@nestjs/common';
import { SecurityValidationController } from './security-validation.controller';
import { SecurityValidationService } from './security-validation.service';
import { PostureScorer } from './posture-scorer.service';

@Module({
  controllers: [SecurityValidationController],
  providers: [SecurityValidationService, PostureScorer],
  exports: [SecurityValidationService],
})
export class SecurityValidationModule {}
