import { Module } from '@nestjs/common';
import { DsarController } from './dsar.controller';
import { DsarService } from './dsar.service';
import { RedactionEngineModule } from '../redaction-engine/redaction-engine.module';
import { IdentityMatcherService } from './identity-matcher.service';

@Module({
  imports: [RedactionEngineModule],
  controllers: [DsarController],
  providers: [DsarService, IdentityMatcherService],
  exports: [DsarService, IdentityMatcherService],
})
export class DsarModule {}
