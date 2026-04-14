import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { StartCheckoutDto } from './dto/start-checkout.dto';

/**
 * Tenant-facing billing controller. The webhook handler lives in
 * StripeWebhookController so it can be marked @Public and skip the global
 * auth chain.
 */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('overview')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'Get billing snapshot for the current tenant' })
  async overview(@CurrentUser('tenantId') tenantId: string) {
    const snapshot = await this.billing.getBillingSnapshot(tenantId);
    return { data: snapshot };
  }

  @Get('plans')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'List available plans in the catalogue' })
  async plans() {
    const plans = await this.billing.listPlans();
    return { data: plans };
  }

  @Get('invoices')
  @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'List recent invoices for the current tenant' })
  async invoices(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    // Read-path goes through the snapshot method to keep a single SQL source.
    const snapshot = await this.billing.getBillingSnapshot(tenantId);
    const parsedLimit = limit ? Math.min(Math.max(Number(limit) || 25, 1), 100) : 25;
    return { data: snapshot.invoices.slice(0, parsedLimit) };
  }

  @Post('checkout')
  @RequirePermissions('billing:write')
  @ApiOperation({ summary: 'Start a hosted checkout session to purchase a plan' })
  async checkout(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: StartCheckoutDto,
  ) {
    const session = await this.billing.startCheckout(
      tenantId,
      userId,
      body.planCode,
      body.successUrl,
      body.cancelUrl,
    );
    return { data: session };
  }

  @Delete('subscription')
  @RequirePermissions('billing:write')
  @ApiOperation({ summary: 'Cancel the current tenant subscription' })
  async cancel(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('at_period_end') atPeriodEnd?: string,
  ) {
    const cancelAtPeriodEnd = atPeriodEnd === 'false' ? false : true;
    await this.billing.cancelSubscription(tenantId, userId, cancelAtPeriodEnd);
    return { data: { ok: true } };
  }
}
