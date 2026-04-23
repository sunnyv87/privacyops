import { Module } from '@nestjs/common';
import { RedactionService } from './redaction.service';
import { RedactionController } from './redaction.controller';

/**
 * Redaction Engine module — isolated, additive. Exports RedactionService
 * for other modules (DSAR, future export flows) to consume without any
 * change to their existing surface.
 */
@Module({
  controllers: [RedactionController],
  providers: [RedactionService],
  exports: [RedactionService],
})
export class RedactionEngineModule {}
