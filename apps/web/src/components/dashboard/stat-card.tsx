import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  suffix?: string;
  description?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  variant?: 'default' | 'destructive';
}

export function StatCard({
  title,
  value,
  suffix,
  description,
  trend,
  variant = 'default',
}: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            'text-3xl font-bold',
            variant === 'destructive' && 'text-destructive',
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-lg text-muted-foreground">{suffix}</span>
        )}
        {trend && (
          <span
            className={cn(
              'ml-2 flex items-center text-sm font-medium',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600',
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
