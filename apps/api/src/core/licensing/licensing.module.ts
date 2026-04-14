import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/core/prisma/prisma.module';
import { LicensingService } from './licensing.service';
import { FeatureGateGuard } from './guards/feature-gate.guard';

/**
 * Global licensing module. Exports LicensingService and
 * FeatureGateGuard so they can be consumed across the app without
 * reimporting.
 *
 * LicensingService uses an in-process cache (see its JSDoc) so no
 * Redis wiring is required here. QuotaCheckService is provided by
 * MeteringModule, which is @Global and therefore already reachable
 * via DI without an explicit import.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [LicensingService, FeatureGateGuard],
  exports: [LicensingService, FeatureGateGuard],
})
export class LicensingModule {}
