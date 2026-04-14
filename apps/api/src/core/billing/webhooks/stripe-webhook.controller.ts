import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/core/auth/decorators/public.decorator';
import { BillingService } from '../billing.service';
import { Inject } from '@nestjs/common';
import {
  BILLING_PROVIDER,
  BillingProvider,
} from '../providers/billing-provider.interface';

/**
 * Stripe webhook endpoint. Marked @Public so the global JWT + Tenant guards
 * skip it (there is no user session for inbound Stripe traffic). Signature
 * verification is delegated to the active BillingProvider — if verification
 * fails, the request is rejected with 400 before any DB work happens.
 *
 * The raw request body is required for HMAC verification. We rely on an
 * express.raw() middleware mounted for THIS path in main.ts that runs
 * BEFORE the global express.json() parser. When that middleware fires,
 * `req.body` is a Buffer; otherwise verification will fail loudly.
 */
@ApiExcludeController()
@Controller('billing/webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly billing: BillingService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(200)
  async stripe(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('missing stripe-signature header');
    }

    // express.raw() mounts the raw bytes as req.body (Buffer). When the
    // middleware is missing (e.g. dev hot-reload edge case) fall back to
    // serialising whatever the JSON parser produced — this WILL fail the
    // HMAC check and is the correct behaviour, surfacing the misconfig.
    let rawBody: Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else {
      this.logger.warn(
        'stripe webhook body is not a Buffer — raw body parser may not be mounted',
      );
      rawBody = Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    }

    const event = await this.provider.verifyWebhook({ rawBody, signature });
    if (!event) {
      throw new BadRequestException('invalid webhook signature');
    }

    try {
      await this.billing.applyWebhook(event);
    } catch (err) {
      this.logger.error(
        `webhook ${event.type} (${event.id}) failed: ${(err as Error).message}`,
      );
      // Re-throw so Stripe retries. We still return 200 for signature
      // errors above because those will never succeed on retry.
      throw err;
    }

    return { received: true };
  }
}
