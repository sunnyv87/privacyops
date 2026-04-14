import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/core/prisma/prisma.module';
import { MeteringService } from './metering.service';
import { UsageAggregatorService } from './usage-aggregator.service';
import { QuotaCheckService } from './quota-check.service';
import { UsageEventConsumer } from './consumers/usage-event.consumer';

/**
 * Global metering module. Exports MeteringService and QuotaCheckService
 * so any feature module can inject them without re-importing this
 * module. The aggregator + consumer are singletons that run on
 * startup.
 *
 * EventsModule is already @Global() so EventBusService is available
 * via DI without an explicit import here.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    MeteringService,
    UsageAggregatorService,
    QuotaCheckService,
    UsageEventConsumer,
  ],
  exports: [MeteringService, QuotaCheckService],
})
export class MeteringModule {}
