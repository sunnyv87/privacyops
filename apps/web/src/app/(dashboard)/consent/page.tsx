'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConsentRecords } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCheck } from 'lucide-react';

const recordColumns: ColumnDef<any>[] = [
  { accessorKey: 'dataSubjectEmail', header: 'Data Subject' },
  { accessorKey: 'noticeName', header: 'Notice' },
  { accessorKey: 'purposeName', header: 'Purpose' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'grantedAt',
    header: 'Granted',
    cell: ({ row }) =>
      row.original.grantedAt ? new Date(row.original.grantedAt).toLocaleDateString() : '-',
  },
];

export default function ConsentPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useConsentRecords({ page, page_size: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consent Management"
        description="Manage consent notices, purposes, and records"
        action={{ label: 'Create Notice', onClick: () => {} }}
      />

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Consent Records</TabsTrigger>
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="purposes">Purposes</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (data?.data || []).length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No consent records"
              description="Consent records will appear here once data subjects interact with your consent notices."
            />
          ) : (
            <DataTable
              columns={recordColumns}
              data={data?.data || []}
              pagination={data?.pagination}
              onPageChange={setPage}
            />
          )}
        </TabsContent>

        <TabsContent value="notices" className="mt-4">
          <EmptyState
            icon={FileCheck}
            title="No consent notices"
            description="Create consent notices to collect data subject consent."
            action={{ label: 'Create Notice', onClick: () => {} }}
          />
        </TabsContent>

        <TabsContent value="purposes" className="mt-4">
          <EmptyState
            icon={FileCheck}
            title="No processing purposes"
            description="Define processing purposes for your data collection activities."
            action={{ label: 'Add Purpose', onClick: () => {} }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
