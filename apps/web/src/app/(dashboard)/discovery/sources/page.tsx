'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useDataSources } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastConnectedAt: string | null;
  createdAt: string;
}

const columns: ColumnDef<DataSource>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="text-xs uppercase tracking-wider bg-muted px-2 py-1 rounded">
        {row.original.type.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'lastConnectedAt',
    header: 'Last Connected',
    cell: ({ row }) =>
      row.original.lastConnectedAt
        ? new Date(row.original.lastConnectedAt).toLocaleDateString()
        : 'Never',
  },
];

export default function DataSourcesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDataSources({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  const sources = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="Connected data sources for discovery and scanning"
        action={{ label: 'Add Data Source', onClick: () => {} }}
      />

      {sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No data sources connected"
          description="Connect your first data source to start discovering and classifying your data."
          action={{ label: 'Connect Data Source', onClick: () => {} }}
        />
      ) : (
        <DataTable columns={columns} data={sources} pagination={pagination} onPageChange={setPage} />
      )}
    </div>
  );
}
