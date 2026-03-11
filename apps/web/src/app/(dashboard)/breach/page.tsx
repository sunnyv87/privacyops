'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useIncidents } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  p1: 'critical',
  p2: 'high',
  p3: 'medium',
  p4: 'low',
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.reference}</span>,
  },
  { accessorKey: 'title', header: 'Title' },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => (
      <SeverityBadge severity={severityMap[row.original.severity] || 'info'} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'isBreach',
    header: 'Breach',
    cell: ({ row }) =>
      row.original.isBreach ? (
        <Badge variant="destructive">Breach</Badge>
      ) : (
        <Badge variant="secondary">Incident</Badge>
      ),
  },
  {
    accessorKey: 'reportedAt',
    header: 'Reported',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
];

export default function BreachPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useIncidents({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Breach & Incidents"
        description="Track and manage security incidents and data breaches"
        action={{ label: 'Report Incident', onClick: () => {} }}
      />

      {(data?.data || []).length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents reported"
          description="Security incidents and data breaches will be tracked here."
          action={{ label: 'Report Incident', onClick: () => {} }}
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
