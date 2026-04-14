import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BillingProvider,
  CheckoutSession,
  CreateCheckoutSessionInput,
  ProviderCustomer,
  ProviderInvoice,
  ProviderSubscription,
  WebhookEvent,
  WebhookVerificationInput,
} from './billing-provider.interface';

/**
 * NullBillingProvider — the default when `BILLING_PROVIDER` is unset or
 * `null`. Every method returns a deterministic stub value so the rest of the
 * SaaS surface (Subscription rows, Invoice history, webhook endpoints) can be
 * exercised in dev and CI without a real Stripe account.
 *
 * The stub:
 *   - Assigns synthetic provider ids prefixed with `null_` so they are
 *     visually distinguishable from real provider ids.
 *   - Always returns an "active" subscription with a 30-day period.
 *   - Treats webhooks as valid as long as the signature is the literal string
 *     `stub` — prevents accidental wiring of real Stripe webhooks to the null
 *     provider in a production env.
 */
@Injectable()
export class NullBillingProvider implements BillingProvider {
  readonly name = 'null';
  readonly isStub = true;

  private readonly logger = new Logger(NullBillingProvider.name);

  async createCustomer(input: {
    tenantId: string;
    email?: string;
    name?: string;
  }): Promise<ProviderCustomer> {
    this.logger.debug(`[stub] createCustomer tenant=${input.tenantId}`);
    return {
      providerCustomerId: `null_cus_${input.tenantId}`,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: { stub: true },
    };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    this.logger.debug(
      `[stub] createCheckoutSession tenant=${input.tenantId} plan=${input.planCode}`,
    );
    // In dev the "checkout" is just an immediate redirect back to the success
    // URL with a fake session id. Frontend can treat this identically to a
    // real Stripe redirect.
    const sessionId = `null_cs_${randomUUID()}`;
    return {
      sessionId,
      url: `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}session_id=${sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription | null> {
    if (!providerSubscriptionId.startsWith('null_')) return null;
    const now = new Date();
    return {
      providerSubscriptionId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
      metadata: { stub: true },
    };
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<ProviderSubscription> {
    const now = new Date();
    return {
      providerSubscriptionId,
      status: atPeriodEnd ? 'active' : 'canceled',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: atPeriodEnd,
      canceledAt: atPeriodEnd ? null : now,
      trialEndsAt: null,
      metadata: { stub: true },
    };
  }

  async listInvoices(
    _providerCustomerId: string,
    _limit?: number,
  ): Promise<ProviderInvoice[]> {
    return [];
  }

  async verifyWebhook(
    input: WebhookVerificationInput,
  ): Promise<WebhookEvent | null> {
    if (input.signature !== 'stub') {
      this.logger.warn(
        '[stub] rejecting webhook with non-stub signature — wire the real provider if you need this',
      );
      return null;
    }
    try {
      const parsed = JSON.parse(input.rawBody.toString('utf8'));
      return {
        id: parsed.id ?? `null_evt_${randomUUID()}`,
        type: parsed.type ?? 'stub.event',
        data: parsed.data ?? {},
      };
    } catch {
      return null;
    }
  }
}
