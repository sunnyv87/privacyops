'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useAssets } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  type: string;
  dataSource: { name: string; type: string };
  _count: { classifications: number; riskFindings: number };
  createdAt: string;
}

const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: 'name',
    header: 'Asset',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.dataSource?.name}</p>
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="text-xs uppercase tracking-wider">{row.original.type}</span>
    ),
  },
  {
    header: 'Classifications',
    cell: ({ row }) => row.original._count?.classifications || 0,
  },
  {
    header: 'Findings',
    cell: ({ row }) => row.original._count?.riskFindings || 0,
  },
  {
    accessorKey: 'createdAt',
    header: 'Discovered',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
];

export default function AssetsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAssets({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  const assets = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader title="Data Catalog" description="Discovered data assets across your data sources" />

      {assets.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No assets discovered"
          description="Run a discovery scan to populate your data catalog."
        />
      ) : (
        <DataTable columns={columns} data={assets} pagination={pagination} onPageChange={setPage} />
      )}
    </div>
  );
}
