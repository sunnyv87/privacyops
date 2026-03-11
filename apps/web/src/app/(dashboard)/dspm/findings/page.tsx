'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useFindings } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';

interface Finding {
  id: string;
  assetName: string;
  dataSourceName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  score: number;
  status: string;
  createdAt: string;
}

const columns: ColumnDef<Finding>[] = [
  {
    accessorKey: 'assetName',
    header: 'Asset',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.assetName}</p>
        <p className="text-xs text-muted-foreground">{row.original.dataSourceName}</p>
      </div>
    ),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    accessorKey: 'score',
    header: 'Risk Score',
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.score}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Detected',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
];

export default function FindingsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFindings({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  const findings = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader title="Risk Findings" description="Security and privacy risk findings across your data estate" />

      {findings.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No findings yet"
          description="Run a discovery scan on your data sources to detect risk findings."
        />
      ) : (
        <DataTable
          columns={columns}
          data={findings}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
