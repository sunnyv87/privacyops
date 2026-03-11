import { Module } from '@nestjs/common';
import { DspmController } from './dspm.controller';
import { DspmService } from './dspm.service';

@Module({
  controllers: [DspmController],
  providers: [DspmService],
  exports: [DspmService],
})
export class DspmModule {}
