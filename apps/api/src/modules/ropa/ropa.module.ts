import { Module } from '@nestjs/common';
import { RopaController } from './ropa.controller';
import { RopaService } from './ropa.service';

@Module({
  controllers: [RopaController],
  providers: [RopaService],
  exports: [RopaService],
})
export class RopaModule {}
