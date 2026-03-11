'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useRetentionPolicies } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Archive, Trash2, AlertTriangle } from 'lucide-react';

const actionIcons: Record<string, typeof Trash2> = {
  delete: Trash2,
  archive: Archive,
  anonymize: AlertTriangle,
  review: Clock,
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: 'Policy Name',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        {row.original.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'recordCategory',
    header: 'Record Category',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.recordCategory}
      </Badge>
    ),
  },
  {
    accessorKey: 'retentionPeriodDays',
    header: 'Retention Period',
    cell: ({ row }) => {
      const days = row.original.retentionPeriodDays;
      if (days >= 365) return `${Math.round(days / 365)} year${days >= 730 ? 's' : ''}`;
      if (days >= 30) return `${Math.round(days / 30)} month${days >= 60 ? 's' : ''}`;
      return `${days} day${days !== 1 ? 's' : ''}`;
    },
  },
  {
    accessorKey: 'actionOnExpiry',
    header: 'Expiry Action',
    cell: ({ row }) => {
      const action = row.original.actionOnExpiry;
      const Icon = actionIcons[action] || Clock;
      return (
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="capitalize">{action}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'applicableRegulations',
    header: 'Regulations',
    cell: ({ row }) => {
      const regs = row.original.applicableRegulations || [];
      return (
        <div className="flex gap-1 flex-wrap">
          {regs.slice(0, 3).map((r: string) => (
            <Badge key={r} variant="secondary" className="text-xs">
              {r}
            </Badge>
          ))}
          {regs.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{regs.length - 3}
            </Badge>
          )}
        </div>
      );
    },
  },
];

function RetentionStats({ policies }: { policies: any[] }) {
  const active = policies.filter((p) => p.status === 'active').length;
  const totalCategories = new Set(policies.map((p) => p.recordCategory)).size;
  const deletePolicies = policies.filter((p) => p.actionOnExpiry === 'delete').length;
  const archivePolicies = policies.filter((p) => p.actionOnExpiry === 'archive').length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Active Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{active}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Record Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCategories}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Auto-Delete</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{deletePolicies}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Auto-Archive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{archivePolicies}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RetentionPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRetentionPolicies({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  const policies = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Retention"
        description="Manage retention policies and data lifecycle governance"
        action={{ label: 'Create Policy', onClick: () => {} }}
      />

      {policies.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No retention policies"
          description="Define retention policies to automate data lifecycle management and ensure compliance with GDPR, DPDP, and other regulations."
          action={{ label: 'Create Policy', onClick: () => {} }}
        />
      ) : (
        <>
          <RetentionStats policies={policies} />
          <DataTable
            columns={columns}
            data={policies}
            pagination={data?.pagination}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
