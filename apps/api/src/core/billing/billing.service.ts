import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { LicensingService } from '@/core/licensing/licensing.service';
import {
  BILLING_PROVIDER,
  BillingProvider,
  CheckoutSession,
  WebhookEvent,
} from './providers/billing-provider.interface';

/**
 * BillingService — the single orchestrator that ties a tenant's local
 * Subscription / BillingAccount / Invoice rows to whatever external provider
 * is active. It NEVER talks to the provider directly for state reads; it
 * reads Prisma and uses the provider only for mutations (checkout, cancel)
 * and for reconciling inbound webhooks.
 *
 * Idempotency:
 *   - `applyWebhook` relies on `Invoice.providerEventId` and a soft check on
 *     `Subscription.providerSubscriptionId` so replaying a webhook is a no-op.
 *   - `startCheckout` is not idempotent at the provider layer, but that is
 *     fine: users explicitly click "upgrade" and a fresh session per click
 *     is expected.
 *
 * Audit: every mutation that changes a tenant's plan / status is written via
 * AuditService.logAdminAction so platform admins can see the change trail.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly licensing: LicensingService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
  ) {}

  // ------------------------------------------------------------------
  // Read-side (used by controller + dashboard)
  // ------------------------------------------------------------------

  async getBillingSnapshot(tenantId: string) {
    const [subscription, account, invoices] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: { include: { features: true, limits: true } } },
      }),
      this.prisma.billingAccount.findUnique({ where: { tenantId } }),
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { issuedAt: 'desc' },
        take: 25,
      }),
    ]);
    return {
      provider: this.provider.name,
      providerIsStub: this.provider.isStub,
      subscription: subscription ?? null,
      billingAccount: account ?? null,
      invoices,
    };
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      include: { features: true, limits: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ------------------------------------------------------------------
  // Mutations (all go through the provider)
  // ------------------------------------------------------------------

  /**
   * Creates a hosted checkout session for a tenant + plan. If the tenant
   * does not yet have a BillingAccount, one is created along with the
   * upstream customer record so subsequent renewals reuse the same customer.
   */
  async startCheckout(
    tenantId: string,
    actorId: string,
    planCode: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSession> {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plan ${planCode} not found or inactive`);
    }

    // Ensure we have a BillingAccount + provider customer id.
    let account = await this.prisma.billingAccount.findUnique({ where: { tenantId } });
    if (!account) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      const customer = await this.provider.createCustomer({
        tenantId,
        name: tenant?.name,
      });
      account = await this.prisma.billingAccount.create({
        data: {
          tenantId,
          provider: this.provider.name,
          providerCustomerId: customer.providerCustomerId,
          billingEmail: customer.email ?? undefined,
          billingName: customer.name ?? undefined,
        },
      });
      // Backlink via Tenant.billingAccountId is maintained by upstream
      // services; avoid touching Tenant here to keep the mutation surface small.
    }

    const session = await this.provider.createCheckoutSession({
      tenantId,
      planCode,
      successUrl,
      cancelUrl,
      providerCustomerId: account.providerCustomerId ?? undefined,
      customerEmail: account.billingEmail ?? undefined,
    });

    await this.audit.logAdminAction({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'billing.checkout.started',
      entityType: 'subscription',
      entityId: tenantId,
      changes: { after: { planCode, sessionId: session.sessionId } },
    });

    return session;
  }

  async cancelSubscription(
    tenantId: string,
    actorId: string,
    atPeriodEnd = true,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) {
      throw new NotFoundException('no active subscription');
    }

    if (subscription.providerSubscriptionId) {
      const updated = await this.provider.cancelSubscription(
        subscription.providerSubscriptionId,
        atPeriodEnd,
      );
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: updated.status,
          cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
          canceledAt: updated.canceledAt ?? undefined,
        },
      });
    } else {
      // No provider wiring — local-only cancel.
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: atPeriodEnd ? 'active' : 'canceled',
          cancelAtPeriodEnd: atPeriodEnd,
          canceledAt: atPeriodEnd ? undefined : new Date(),
        },
      });
    }

    this.licensing.invalidate(tenantId);

    await this.audit.logAdminAction({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'billing.subscription.canceled',
      entityType: 'subscription',
      entityId: tenantId,
      changes: { after: { atPeriodEnd } },
    });
  }

  // ------------------------------------------------------------------
  // Webhook reconciliation
  // ------------------------------------------------------------------

  /**
   * Applies a provider webhook to local state. Called by
   * StripeWebhookController after signature verification. The method is
   * idempotent — re-delivery of the same event is a no-op.
   *
   * Webhooks arrive unauthenticated (no JWT, no tenant context), so the
   * handler runs inside a transaction that opts into the RLS
   * platform-admin bypass. This is the same pattern used by the usage
   * aggregator.
   */
  async applyWebhook(event: WebhookEvent): Promise<void> {
    this.logger.log(`billing webhook ${event.type} id=${event.id}`);
    await this.prisma.$transaction(async (tx) => {
      // Enable platform-admin RLS bypass for this transaction only.
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.platform_admin', 'true', true)`,
      );
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event, tx);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionEvent(event, tx);
          break;
        case 'invoice.paid':
        case 'invoice.payment_failed':
        case 'invoice.finalized':
          await this.handleInvoiceEvent(event, tx);
          break;
        default:
          this.logger.debug(`billing webhook ${event.type} — no handler`);
      }
    });
  }

  private async handleCheckoutCompleted(event: WebhookEvent, tx: any): Promise<void> {
    const obj = event.data ?? {};
    const tenantId: string | undefined =
      obj.client_reference_id ?? obj.metadata?.tenant_id;
    const planCode: string | undefined = obj.metadata?.plan_code;
    const providerSubscriptionId: string | undefined = obj.subscription;
    const providerCustomerId: string | undefined = obj.customer;
    if (!tenantId || !planCode || !providerSubscriptionId) {
      this.logger.warn(
        `checkout.session.completed missing fields (tenant=${tenantId}, plan=${planCode}, sub=${providerSubscriptionId})`,
      );
      return;
    }

    const plan = await tx.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      this.logger.warn(`checkout.session.completed for unknown plan ${planCode}`);
      return;
    }

    // Upsert Subscription row; provider subscription takes precedence.
    await tx.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        provider: this.provider.name,
        providerSubscriptionId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        planId: plan.id,
        provider: this.provider.name,
        providerSubscriptionId,
        status: 'active',
      },
    });

    if (providerCustomerId) {
      await tx.billingAccount.upsert({
        where: { tenantId },
        create: {
          tenantId,
          provider: this.provider.name,
          providerCustomerId,
        },
        update: { providerCustomerId },
      });
    }

    // Also cache plan selection on Tenant for fast reads.
    await tx.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id },
    });

    this.licensing.invalidate(tenantId);
  }

  private async handleSubscriptionEvent(event: WebhookEvent, tx: any): Promise<void> {
    const obj = event.data ?? {};
    const providerSubscriptionId: string | undefined = obj.id;
    if (!providerSubscriptionId) return;

    const existing = await tx.subscription.findFirst({
      where: { providerSubscriptionId },
    });
    if (!existing) {
      this.logger.warn(
        `subscription webhook for unknown subscription ${providerSubscriptionId}`,
      );
      return;
    }

    await tx.subscription.update({
      where: { tenantId: existing.tenantId },
      data: {
        status: obj.status ?? existing.status,
        currentPeriodStart: obj.current_period_start
          ? new Date(obj.current_period_start * 1000)
          : undefined,
        currentPeriodEnd: obj.current_period_end
          ? new Date(obj.current_period_end * 1000)
          : undefined,
        cancelAtPeriodEnd: obj.cancel_at_period_end ?? undefined,
        canceledAt: obj.canceled_at ? new Date(obj.canceled_at * 1000) : undefined,
        trialEndsAt: obj.trial_end ? new Date(obj.trial_end * 1000) : undefined,
      },
    });

    this.licensing.invalidate(existing.tenantId);
  }

  private async handleInvoiceEvent(event: WebhookEvent, tx: any): Promise<void> {
    const obj = event.data ?? {};
    const providerInvoiceId: string | undefined = obj.id;
    if (!providerInvoiceId) return;

    // Locate tenant via the linked subscription's provider id.
    const providerSubscriptionId: string | undefined = obj.subscription;
    let tenantId: string | undefined;
    if (providerSubscriptionId) {
      const sub = await tx.subscription.findFirst({
        where: { providerSubscriptionId },
        select: { tenantId: true },
      });
      tenantId = sub?.tenantId;
    }
    // Fallback: metadata.tenant_id
    if (!tenantId && obj.metadata?.tenant_id) {
      tenantId = obj.metadata.tenant_id;
    }
    if (!tenantId) {
      this.logger.warn(`invoice webhook ${providerInvoiceId} has no resolvable tenant`);
      return;
    }

    // Idempotency: providerEventId is unique. Upsert on providerInvoiceId.
    await tx.invoice.upsert({
      where: { providerInvoiceId },
      create: {
        tenantId,
        providerInvoiceId,
        providerEventId: event.id,
        amountCents: obj.amount_paid ?? obj.amount_due ?? 0,
        currency: (obj.currency ?? 'USD').toUpperCase(),
        status: obj.status ?? 'open',
        periodStart: new Date((obj.period_start ?? obj.created) * 1000),
        periodEnd: new Date((obj.period_end ?? obj.created) * 1000),
        issuedAt: new Date(obj.created * 1000),
        paidAt: obj.status_transitions?.paid_at
          ? new Date(obj.status_transitions.paid_at * 1000)
          : null,
        pdfUrl: obj.invoice_pdf ?? null,
        hostedInvoiceUrl: obj.hosted_invoice_url ?? null,
      },
      update: {
        status: obj.status ?? undefined,
        amountCents: obj.amount_paid ?? obj.amount_due ?? undefined,
        paidAt: obj.status_transitions?.paid_at
          ? new Date(obj.status_transitions.paid_at * 1000)
          : undefined,
        hostedInvoiceUrl: obj.hosted_invoice_url ?? undefined,
        pdfUrl: obj.invoice_pdf ?? undefined,
      },
    });
  }
}
