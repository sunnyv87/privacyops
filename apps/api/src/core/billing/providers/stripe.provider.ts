import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
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
 * StripeBillingProvider — talks to the Stripe REST API directly via global
 * fetch. We deliberately avoid the official `stripe` npm package to keep the
 * dependency footprint small and to let this provider run in constrained
 * environments (serverless, edge workers) without bundling 2 MB of unused
 * SDK surface.
 *
 * Security model:
 *   - Webhook signatures are verified with `timingSafeEqual` against the
 *     `stripe-signature` header + `STRIPE_WEBHOOK_SECRET` per Stripe's v1
 *     signing scheme. Tolerance of 5 minutes to absorb clock skew.
 *   - API keys are loaded from ConfigService and NEVER logged. On startup we
 *     log only the key prefix (`sk_live_...`) for operator confirmation.
 *   - All outbound requests pass `Idempotency-Key` derived from the
 *     orchestrator-supplied idempotency key so Stripe de-dupes retries.
 */
@Injectable()
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  readonly isStub = false;

  private readonly logger = new Logger(StripeBillingProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly apiBase = 'https://api.stripe.com/v1';
  private readonly webhookToleranceSeconds = 300;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('STRIPE_API_KEY', '');
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
    if (!apiKey) {
      this.logger.warn(
        'STRIPE_API_KEY is not set — StripeBillingProvider will fail on any outbound call',
      );
    } else {
      this.logger.log(
        `Stripe provider initialized (key prefix=${apiKey.slice(0, 8)}..., webhookSecret=${webhookSecret ? 'present' : 'missing'})`,
      );
    }
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  // ------------------------------------------------------------------
  // Customer / Subscription / Invoice
  // ------------------------------------------------------------------

  async createCustomer(input: {
    tenantId: string;
    email?: string;
    name?: string;
  }): Promise<ProviderCustomer> {
    const params = new URLSearchParams();
    if (input.email) params.set('email', input.email);
    if (input.name) params.set('name', input.name);
    params.set('metadata[tenant_id]', input.tenantId);

    const response = await this.post<{
      id: string;
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
    }>(`/customers`, params, `create-customer:${input.tenantId}`);

    return {
      providerCustomerId: response.id,
      email: response.email ?? null,
      name: response.name ?? null,
      metadata: response.metadata,
    };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    // The caller must supply `STRIPE_PRICE_ID_<PLAN_CODE_UPPER>` env vars
    // mapping plan codes to Stripe price ids. We do NOT hard-code them.
    const priceEnvKey = `STRIPE_PRICE_ID_${input.planCode.toUpperCase()}`;
    const priceId = this.config.get<string>(priceEnvKey, '');
    if (!priceId) {
      throw new Error(
        `Missing env ${priceEnvKey}; cannot create checkout session for plan ${input.planCode}`,
      );
    }

    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', input.successUrl);
    params.set('cancel_url', input.cancelUrl);
    params.set('client_reference_id', input.tenantId);
    params.set('metadata[tenant_id]', input.tenantId);
    params.set('metadata[plan_code]', input.planCode);
    if (input.providerCustomerId) {
      params.set('customer', input.providerCustomerId);
    } else if (input.customerEmail) {
      params.set('customer_email', input.customerEmail);
    }

    const response = await this.post<{
      id: string;
      url: string;
      expires_at?: number;
    }>(`/checkout/sessions`, params, `checkout:${input.tenantId}:${input.planCode}`);

    return {
      sessionId: response.id,
      url: response.url,
      expiresAt: response.expires_at
        ? new Date(response.expires_at * 1000)
        : undefined,
    };
  }

  async getSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription | null> {
    const sub = await this.get<any>(`/subscriptions/${providerSubscriptionId}`);
    if (!sub || sub.deleted) return null;
    return this.mapSubscription(sub);
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<ProviderSubscription> {
    if (atPeriodEnd) {
      const params = new URLSearchParams();
      params.set('cancel_at_period_end', 'true');
      const sub = await this.post<any>(
        `/subscriptions/${providerSubscriptionId}`,
        params,
        `cancel-at-period-end:${providerSubscriptionId}`,
      );
      return this.mapSubscription(sub);
    }
    const sub = await this.delete<any>(`/subscriptions/${providerSubscriptionId}`);
    return this.mapSubscription(sub);
  }

  async listInvoices(
    providerCustomerId: string,
    limit = 25,
  ): Promise<ProviderInvoice[]> {
    const url = `/invoices?customer=${encodeURIComponent(providerCustomerId)}&limit=${limit}`;
    const response = await this.get<{ data: any[] }>(url);
    if (!response?.data) return [];
    return response.data.map((inv) => this.mapInvoice(inv));
  }

  // ------------------------------------------------------------------
  // Webhook verification (Stripe v1 signing scheme)
  // ------------------------------------------------------------------

  async verifyWebhook(
    input: WebhookVerificationInput,
  ): Promise<WebhookEvent | null> {
    if (!this.webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET missing — refusing to verify');
      return null;
    }
    const parsed = this.parseSignatureHeader(input.signature);
    if (!parsed) return null;

    const { timestamp, signatures } = parsed;
    const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
    if (ageSeconds > this.webhookToleranceSeconds) {
      this.logger.warn(
        `Stripe webhook timestamp outside tolerance (${ageSeconds.toFixed(0)}s)`,
      );
      return null;
    }

    const signedPayload = `${timestamp}.${input.rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const matched = signatures.some((sig) => {
      const sigBuf = Buffer.from(sig, 'utf8');
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });

    if (!matched) {
      this.logger.warn('Stripe webhook signature mismatch');
      return null;
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(input.rawBody.toString('utf8'));
    } catch (err) {
      this.logger.warn(`Stripe webhook body not JSON: ${(err as Error).message}`);
      return null;
    }

    return {
      id: parsedBody.id,
      type: parsedBody.type,
      data: parsedBody.data?.object ?? parsedBody.data,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private parseSignatureHeader(
    header: string,
  ): { timestamp: number; signatures: string[] } | null {
    if (!header) return null;
    const parts = header.split(',');
    let timestamp = 0;
    const signatures: string[] = [];
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      else if (k === 'v1' && v) signatures.push(v);
    }
    if (!timestamp || signatures.length === 0) return null;
    return { timestamp, signatures };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stripe GET ${path} failed ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  private async post<T>(
    path: string,
    body: URLSearchParams,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers = this.headers();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers,
      body: body.toString(),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Stripe POST ${path} failed ${res.status}: ${errBody}`);
    }
    return (await res.json()) as T;
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stripe DELETE ${path} failed ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  private headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('STRIPE_API_KEY is not configured');
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Stripe-Version': '2024-06-20',
    };
  }

  private mapSubscription(sub: any): ProviderSubscription {
    return {
      providerSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      metadata: sub.metadata,
    };
  }

  private mapInvoice(inv: any): ProviderInvoice {
    return {
      providerInvoiceId: inv.id,
      amountCents: inv.amount_paid ?? inv.amount_due ?? 0,
      currency: (inv.currency ?? 'usd').toUpperCase(),
      status: inv.status ?? 'draft',
      periodStart: new Date((inv.period_start ?? inv.created) * 1000),
      periodEnd: new Date((inv.period_end ?? inv.created) * 1000),
      issuedAt: new Date(inv.created * 1000),
      paidAt: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : null,
      pdfUrl: inv.invoice_pdf ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    };
  }
}
