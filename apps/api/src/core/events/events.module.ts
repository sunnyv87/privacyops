import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { EventConsumersService } from './event-consumers.service';

@Global()
@Module({
  providers: [EventBusService, EventConsumersService],
  exports: [EventBusService],
})
export class EventsModule {}
