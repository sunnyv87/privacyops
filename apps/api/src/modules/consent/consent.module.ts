import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller';
import { ConsentPublicController } from './consent-public.controller';
import { ConsentService } from './consent.service';

@Module({
  controllers: [ConsentController, ConsentPublicController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
