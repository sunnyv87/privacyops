/**
 * BillingProvider — abstraction over external billing backends (Stripe today,
 * Paddle / Chargebee tomorrow). Every provider implementation must be fully
 * self-contained: it receives tenant + plan identifiers and returns the
 * provider-side customer / subscription / invoice snapshots needed by
 * BillingService to reconcile local state.
 *
 * Providers MUST be idempotent — BillingService may retry on network errors.
 * Providers MUST NOT write directly to Prisma; persistence is the orchestrator's
 * responsibility.
 */

export interface ProviderCustomer {
  providerCustomerId: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, any>;
}

export interface ProviderSubscription {
  providerSubscriptionId: string;
  status: string; // active | past_due | canceled | trialing | incomplete | paused
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  trialEndsAt?: Date | null;
  metadata?: Record<string, any>;
}

export interface ProviderInvoice {
  providerInvoiceId: string;
  providerEventId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  paidAt?: Date | null;
  pdfUrl?: string | null;
  hostedInvoiceUrl?: string | null;
}

export interface CheckoutSession {
  url: string; // hosted checkout URL
  sessionId: string;
  expiresAt?: Date;
}

export interface CreateCheckoutSessionInput {
  tenantId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  providerCustomerId?: string | null;
}

export interface WebhookVerificationInput {
  rawBody: Buffer; // raw request body, used for signature verification
  signature: string;
}

export interface WebhookEvent {
  id: string; // provider-assigned event id, used for idempotency
  type: string; // e.g. 'customer.subscription.updated'
  data: any;
}

/**
 * Contract every billing backend implements. Methods that the app does not yet
 * exercise can throw `NotImplementedException`; BillingService fans out only
 * to capabilities it actually needs.
 */
export interface BillingProvider {
  /** Human-readable provider name used in logs and the Subscription.provider column. */
  readonly name: string;

  /** Whether this provider is a stub (no real network calls). */
  readonly isStub: boolean;

  createCustomer(input: {
    tenantId: string;
    email?: string;
    name?: string;
  }): Promise<ProviderCustomer>;

  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;

  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription | null>;

  cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<ProviderSubscription>;

  listInvoices(providerCustomerId: string, limit?: number): Promise<ProviderInvoice[]>;

  /**
   * Verifies an inbound webhook and returns the parsed event. MUST return
   * null (not throw) if the signature is invalid — BillingController converts
   * that into a 400.
   */
  verifyWebhook(input: WebhookVerificationInput): Promise<WebhookEvent | null>;
}

/**
 * DI token for the active BillingProvider implementation. Registered in
 * BillingModule via useFactory so operators can swap providers through
 * `BILLING_PROVIDER` env without touching code.
 */
export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');
