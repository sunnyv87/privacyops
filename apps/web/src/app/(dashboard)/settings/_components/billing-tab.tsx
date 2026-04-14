'use client';

import { useState } from 'react';
import { CreditCard, FileText, Download, ExternalLink } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBillingOverview,
  useBillingPlans,
  useStartCheckout,
  useCancelSubscription,
  useTenantInfo,
} from '@/hooks/use-billing';

function formatMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString();
}

const invoiceColumns: ColumnDef<any>[] = [
  {
    accessorKey: 'issuedAt',
    header: 'Issued',
    cell: ({ row }) => (
      <span className="text-xs">{formatDate(row.original.issuedAt)}</span>
    ),
  },
  {
    accessorKey: 'periodStart',
    header: 'Period',
    cell: ({ row }) => (
      <span className="text-xs">
        {formatDate(row.original.periodStart)} –{' '}
        {formatDate(row.original.periodEnd)}
      </span>
    ),
  },
  {
    accessorKey: 'amountCents',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="text-sm font-mono">
        {formatMoney(row.original.amountCents, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status as string;
      const variant =
        status === 'paid'
          ? 'default'
          : status === 'open' || status === 'draft'
          ? 'secondary'
          : 'outline';
      return (
        <Badge variant={variant} className="text-xs capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex gap-2 justify-end">
        {row.original.hostedInvoiceUrl && (
          <a
            href={row.original.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
        {row.original.pdfUrl && (
          <a href={row.original.pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
      </div>
    ),
  },
];

export function BillingTab() {
  const { data: overview, isLoading: overviewLoading } = useBillingOverview();
  const { data: tenantInfo } = useTenantInfo();
  const { data: catalog } = useBillingPlans();
  const startCheckout = useStartCheckout();
  const cancelSubscription = useCancelSubscription();
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (overviewLoading) return <Skeleton className="h-64" />;

  const subscription = overview?.data?.subscription;
  const billingAccount = overview?.data?.billingAccount;
  const invoices = overview?.data?.invoices || [];

  const handleUpgrade = (planCode: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    startCheckout.mutate({
      planCode,
      successUrl: `${origin}/settings?checkout=success`,
      cancelUrl: `${origin}/settings?checkout=canceled`,
    }, {
      onSuccess: (result) => {
        if (result?.data?.url && typeof window !== 'undefined') {
          window.location.href = result.data.url;
        }
      },
    });
  };

  const handleCancel = () => {
    if (!window.confirm('Cancel subscription at the end of the current period?')) {
      return;
    }
    setCancelError(null);
    cancelSubscription.mutate(
      { atPeriodEnd: true },
      {
        onError: (err) => setCancelError(err.message || 'Failed to cancel'),
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Subscription summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>
                Your active billing arrangement
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      subscription.status === 'active'
                        ? 'default'
                        : subscription.status === 'trialing'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="capitalize mt-1"
                  >
                    {subscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium capitalize">
                    {subscription.provider}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Renews</p>
                  <p className="text-sm font-medium">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
                  Subscription scheduled for cancellation on{' '}
                  {formatDate(subscription.currentPeriodEnd)}.
                </div>
              )}
              {!subscription.cancelAtPeriodEnd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? 'Cancelling…' : 'Cancel subscription'}
                </Button>
              )}
              {cancelError && (
                <p className="text-xs text-red-600">{cancelError}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active subscription for tenant{' '}
              <span className="font-mono">
                {tenantInfo?.data?.tenant?.slug || '--'}
              </span>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Billing account */}
      {billingAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Account</CardTitle>
            <CardDescription>Invoice and payment details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Billing email</p>
                <p className="text-sm">{billingAccount.billingEmail || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Billing name</p>
                <p className="text-sm">{billingAccount.billingName || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment method</p>
                <p className="text-sm">
                  {billingAccount.paymentMethodBrand && billingAccount.paymentMethodLast4
                    ? `${billingAccount.paymentMethodBrand.toUpperCase()} ···· ${billingAccount.paymentMethodLast4}`
                    : 'Not on file'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax ID</p>
                <p className="text-sm">{billingAccount.taxId || '--'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Recent billing history</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={invoiceColumns} data={invoices} />
          {invoices.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No invoices yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade options */}
      {catalog?.data && catalog.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
            <CardDescription>
              Upgrade or switch your subscription via secure hosted checkout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {catalog.data.map((p) => {
                const isCurrent =
                  subscription && p.id === subscription.planId;
                return (
                  <div key={p.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.name}</span>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-mono mt-1">
                      {p.priceCents === 0 && p.billingInterval === 'custom'
                        ? 'Custom'
                        : p.priceCents === 0
                        ? 'Free'
                        : `${formatMoney(p.priceCents, p.currency)} / ${p.billingInterval}`}
                    </p>
                    <Button
                      variant={isCurrent ? 'outline' : 'default'}
                      size="sm"
                      className="mt-3 w-full"
                      disabled={!!isCurrent || startCheckout.isPending}
                      onClick={() => handleUpgrade(p.code)}
                    >
                      {isCurrent ? 'Current' : 'Select'}
                    </Button>
                  </div>
                );
              })}
            </div>
            {startCheckout.isError && (
              <p className="text-xs text-red-600 mt-2">
                {(startCheckout.error as Error)?.message || 'Checkout failed'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
