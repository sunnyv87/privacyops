'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useVendors } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';

const riskTierMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: 'Vendor',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'riskTier',
    header: 'Risk Tier',
    cell: ({ row }) => (
      <SeverityBadge severity={riskTierMap[row.original.riskTier] || 'info'} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: 'contactEmail', header: 'Contact' },
  {
    accessorKey: 'contractExpiry',
    header: 'Contract Expiry',
    cell: ({ row }) =>
      row.original.contractExpiry
        ? new Date(row.original.contractExpiry).toLocaleDateString()
        : '-',
  },
];

export default function VendorsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useVendors({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Risk Management"
        description="Third-party vendor risk assessments and DPA tracking"
        action={{ label: 'Add Vendor', onClick: () => {} }}
      />

      {(data?.data || []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No vendors tracked"
          description="Add your third-party vendors to track data processing agreements and risk assessments."
          action={{ label: 'Add Vendor', onClick: () => {} }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data || []}
          pagination={data?.pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
