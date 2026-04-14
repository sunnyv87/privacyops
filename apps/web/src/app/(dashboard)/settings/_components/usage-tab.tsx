'use client';

import { useState } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsageStats, type UsageMetric } from '@/hooks/use-billing';

function formatMetric(metric: string) {
  return metric
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '--';
  return n.toLocaleString();
}

function UsageRow({ metric }: { metric: UsageMetric }) {
  const percent = metric.percentUsed ?? 0;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const isUnlimited = metric.limit === null || metric.limit < 0;
  const warning = !isUnlimited && percent >= 80 && percent < 100;
  const overage = !isUnlimited && percent >= 100;

  const barColor = overage
    ? 'bg-red-500'
    : warning
    ? 'bg-yellow-500'
    : 'bg-primary';

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">
            {formatMetric(metric.metric)}
          </span>
          {overage && (
            <Badge variant="destructive" className="text-xs ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Over limit
            </Badge>
          )}
        </div>
        <span className="text-sm font-mono">
          {formatNumber(metric.used)}
          {!isUnlimited && (
            <span className="text-muted-foreground">
              {' '}
              / {formatNumber(metric.limit)}
            </span>
          )}
          {isUnlimited && (
            <span className="text-muted-foreground"> / unlimited</span>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{percent.toFixed(0)}% used</span>
            <span>{formatNumber(metric.remaining)} remaining</span>
          </div>
        </>
      )}
    </div>
  );
}

export function UsageTab() {
  const [period, setPeriod] = useState<'day' | 'month'>('month');
  const { data, isLoading } = useUsageStats(period);

  if (isLoading) return <Skeleton className="h-64" />;

  const metrics = data?.data?.metrics || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <div>
                <CardTitle>Usage & Metering</CardTitle>
                <CardDescription>
                  Resource consumption for the current{' '}
                  {period === 'month' ? 'billing month' : 'day'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant={period === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('month')}
              >
                Month
              </Button>
              <Button
                variant={period === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('day')}
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No usage recorded yet for the selected period.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {metrics.map((m) => (
                <UsageRow key={m.metric} metric={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
