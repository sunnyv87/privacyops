import { Global, Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantGuard } from './guards/tenant.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';

@Global()
@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantGuard, TenantInterceptor],
  exports: [TenantService, TenantGuard, TenantInterceptor],
})
export class TenantModule {}
