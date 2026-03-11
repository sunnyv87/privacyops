import { Module } from '@nestjs/common';
import { DsarController } from './dsar.controller';
import { DsarService } from './dsar.service';

@Module({
  controllers: [DsarController],
  providers: [DsarService],
  exports: [DsarService],
})
export class DsarModule {}
