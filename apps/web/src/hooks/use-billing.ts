'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * SaaS billing / plan / usage hooks.
 *
 * These endpoints are additive and gated by `billing:*` and
 * `dashboard:stats:read` permissions on the API side. If a tenant lacks
 * the billing module these queries return 404/403 — callers should handle
 * the error state gracefully.
 *
 * Response shapes here mirror the actual API contracts in
 *   apps/api/src/modules/dashboard/dashboard.service.ts
 *   apps/api/src/core/billing/billing.service.ts
 * Keep these in sync when the service changes.
 */

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  subscriptionTier: string;
  dataResidencyRegion: string;
  trialExpiresAt: string | null;
  createdAt: string;
}

export interface TenantSubscriptionSummary {
  status: string;
  planCode: string | null | undefined;
  planName: string | null | undefined;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

export interface TenantOnboardingSummary {
  status: string;
  currentStep: string;
  completedSteps: unknown;
  completedAt: string | null;
}

export interface TenantInfo {
  tenant: TenantProfile | null;
  subscription: TenantSubscriptionSummary | null;
  onboarding: TenantOnboardingSummary | null;
}

export interface PlanFeatureEntry {
  featureKey: string;
  enabled: boolean;
}

export interface PlanLimitEntry {
  metric: string;
  limitValue: number;
  period: string;
  quotaEnforced: boolean;
}

export interface PlanOverrideEntry {
  featureKey: string;
  enabled: boolean;
  expiresAt: string | null;
}

export interface PlanDetails {
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  features: PlanFeatureEntry[];
  limits: PlanLimitEntry[];
  overrides: PlanOverrideEntry[];
}

export interface UsageMetric {
  metric: string;
  used: number;
  limit: number | null;
  percentUsed: number | null;
  remaining: number | null;
}

export interface UsageStats {
  period: 'day' | 'month';
  periodStart: string;
  metrics: UsageMetric[];
}

export interface BillingInvoice {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
}

export interface BillingSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  provider: string;
  providerSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEndsAt: string | null;
}

export interface BillingAccount {
  id: string;
  tenantId: string;
  provider: string;
  providerCustomerId: string | null;
  billingEmail: string | null;
  billingName: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  taxId: string | null;
}

export interface BillingOverview {
  provider: string;
  providerIsStub: boolean;
  subscription: BillingSubscription | null;
  billingAccount: BillingAccount | null;
  invoices: BillingInvoice[];
}

export interface PlanCatalogEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string;
  features: Array<{ featureKey: string; enabled: boolean }>;
  limits: Array<{ metric: string; limitValue: number | string; period: string }>;
}

export function useTenantInfo() {
  return useQuery({
    queryKey: ['tenant', 'info'],
    queryFn: () => api.get<{ data: TenantInfo }>('/dashboard/tenant-info'),
  });
}

export function usePlanDetails() {
  return useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: () => api.get<{ data: PlanDetails }>('/dashboard/plan'),
  });
}

export function useUsageStats(period: 'day' | 'month' = 'month') {
  return useQuery({
    queryKey: ['tenant', 'usage', period],
    queryFn: () =>
      api.get<{ data: UsageStats }>('/dashboard/usage', { period }),
  });
}

export function useConnectorStatus() {
  return useQuery({
    queryKey: ['tenant', 'connector-status'],
    queryFn: () => api.get<{ data: any }>('/dashboard/connector-status'),
  });
}

export function useBillingOverview() {
  return useQuery({
    queryKey: ['billing', 'overview'],
    queryFn: () => api.get<{ data: BillingOverview }>('/billing/overview'),
  });
}

export function useBillingPlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () =>
      api.get<{ data: PlanCatalogEntry[] }>('/billing/plans'),
  });
}

export function useStartCheckout() {
  const queryClient = useQueryClient();
  return useMutation<
    { data: { url: string; sessionId: string } },
    Error,
    { planCode: string; successUrl: string; cancelUrl: string }
  >({
    mutationFn: (input) =>
      api.post<{ data: { url: string; sessionId: string } }>(
        '/billing/checkout',
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'plan'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation<
    { data: any },
    Error,
    { atPeriodEnd?: boolean } | void
  >({
    mutationFn: (input) => {
      const qs =
        input && typeof input.atPeriodEnd === 'boolean'
          ? `?at_period_end=${input.atPeriodEnd ? 'true' : 'false'}`
          : '';
      return api.delete<{ data: any }>(`/billing/subscription${qs}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'info'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'plan'] });
    },
  });
}
