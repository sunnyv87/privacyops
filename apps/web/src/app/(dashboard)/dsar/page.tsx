'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useDsarRequests } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck } from 'lucide-react';

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.reference}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.type}
      </Badge>
    ),
  },
  { accessorKey: 'dataSubjectEmail', header: 'Data Subject' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    cell: ({ row }) => {
      const due = new Date(row.original.dueDate);
      const isOverdue = due < new Date() && row.original.status !== 'completed';
      return (
        <span className={isOverdue ? 'text-destructive font-medium' : ''}>
          {due.toLocaleDateString()}
          {isOverdue && ' (Overdue)'}
        </span>
      );
    },
  },
  { accessorKey: 'assigneeName', header: 'Assignee' },
];

export default function DsarPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDsarRequests({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Subject Access Requests"
        description="Manage DSAR requests and track SLA compliance"
        action={{ label: 'New Request', onClick: () => {} }}
      />

      {(data?.data || []).length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No DSAR requests"
          description="Data subject access requests will appear here when received."
          action={{ label: 'Create Request', onClick: () => {} }}
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
