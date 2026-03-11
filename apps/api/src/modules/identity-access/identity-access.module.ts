import { Module } from '@nestjs/common';
import { IdentityAccessController } from './identity-access.controller';
import { IdentityAccessService } from './identity-access.service';
import { AccessAnalyzer } from './access-analyzer';

@Module({
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService, AccessAnalyzer],
  exports: [IdentityAccessService],
})
export class IdentityAccessModule {}
