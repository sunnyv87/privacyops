import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@/core/prisma/prisma.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';
import { BILLING_PROVIDER } from './providers/billing-provider.interface';
import { NullBillingProvider } from './providers/null.provider';
import { StripeBillingProvider } from './providers/stripe.provider';

/**
 * Billing module. Exposes BillingService (for in-process callers like
 * TenantService.provisionTenant) and wires two HTTP controllers:
 *   - BillingController — tenant-facing billing API
 *   - StripeWebhookController — public webhook endpoint
 *
 * The active provider is selected by `BILLING_PROVIDER` env:
 *   - `stripe`  → StripeBillingProvider
 *   - anything else (or unset) → NullBillingProvider (stub)
 *
 * LicensingModule is @Global() so LicensingService is reachable here without
 * an explicit import.
 */
@Global()
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [
    BillingService,
    NullBillingProvider,
    StripeBillingProvider,
    {
      provide: BILLING_PROVIDER,
      inject: [ConfigService, NullBillingProvider, StripeBillingProvider],
      useFactory: (
        config: ConfigService,
        nullProvider: NullBillingProvider,
        stripeProvider: StripeBillingProvider,
      ) => {
        const name = (config.get<string>('BILLING_PROVIDER') ?? 'null').toLowerCase();
        switch (name) {
          case 'stripe':
            return stripeProvider;
          case 'null':
          case '':
          default:
            return nullProvider;
        }
      },
    },
  ],
  exports: [BillingService, BILLING_PROVIDER],
})
export class BillingModule {}
