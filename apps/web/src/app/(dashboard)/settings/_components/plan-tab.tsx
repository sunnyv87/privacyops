'use client';

import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlanDetails, useBillingPlans } from '@/hooks/use-billing';

function formatPrice(priceCents: number, currency: string, interval: string) {
  if (priceCents === 0 && interval === 'custom') return 'Custom pricing';
  if (priceCents === 0) return 'Free';
  const amount = (priceCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  });
  return `${amount} / ${interval}`;
}

function formatMetric(metric: string) {
  return metric
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatLimit(limitValue: number) {
  if (limitValue < 0) return 'Unlimited';
  return limitValue.toLocaleString();
}

export function PlanTab() {
  const { data: planData, isLoading: planLoading } = usePlanDetails();
  const { data: catalogData, isLoading: catalogLoading } = useBillingPlans();

  if (planLoading || catalogLoading) {
    return <Skeleton className="h-64" />;
  }

  const planDetails = planData?.data;
  const catalog = catalogData?.data || [];
  const currentCode = planDetails?.planCode;

  // Resolve the full catalogue entry for the current plan so we can show
  // price and description alongside the lightweight entitlements payload.
  const currentCatalogEntry =
    currentCode && catalog.find((p) => p.code === currentCode);

  // Build a set of feature keys present on the plan so we can render
  // overrides separately with an "Override" badge.
  const overrideKeys = new Set(
    (planDetails?.overrides || []).map((o) => o.featureKey),
  );

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your active subscription and the features it unlocks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {planDetails?.planCode ? (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">
                    {planDetails.planName || planDetails.planCode}
                  </span>
                  <Badge variant="secondary" className="uppercase">
                    {planDetails.planCode}
                  </Badge>
                  {planDetails.subscriptionStatus && (
                    <Badge variant="outline" className="capitalize">
                      {planDetails.subscriptionStatus}
                    </Badge>
                  )}
                </div>
                {currentCatalogEntry?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentCatalogEntry.description}
                  </p>
                )}
              </div>
              {currentCatalogEntry && (
                <div className="text-right">
                  <p className="text-lg font-mono">
                    {formatPrice(
                      currentCatalogEntry.priceCents,
                      currentCatalogEntry.currency,
                      currentCatalogEntry.billingInterval,
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active plan — please contact your administrator.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Features unlocked by your current plan. Overrides take precedence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(planDetails?.features || []).map((f) => (
              <div
                key={f.featureKey}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  {f.enabled ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-mono">{f.featureKey}</span>
                </div>
                {overrideKeys.has(f.featureKey) && (
                  <Badge variant="outline" className="text-xs">
                    Override
                  </Badge>
                )}
              </div>
            ))}
            {(!planDetails?.features || planDetails.features.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No features configured for this plan.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
          <CardDescription>
            Metered resources included with your plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(planDetails?.limits || []).map((l) => (
              <div
                key={l.metric}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <span className="text-sm font-medium">
                    {formatMetric(l.metric)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Per {l.period}
                    {l.quotaEnforced && ' · Enforced'}
                  </p>
                </div>
                <span className="text-sm font-mono">
                  {formatLimit(l.limitValue)}
                </span>
              </div>
            ))}
            {(!planDetails?.limits || planDetails.limits.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No limits configured for this plan.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catalogue */}
      {catalog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Compare plans and upgrade from the Billing tab
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {catalog.map((p) => {
                const isCurrent = p.code === currentCode;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-4 ${
                      isCurrent ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.name}</span>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-mono mt-2">
                      {formatPrice(p.priceCents, p.currency, p.billingInterval)}
                    </p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium">
                        {p.features.length} features
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.limits.length} metered limits
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
