'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useRopaEntries } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollText, Download, FileText, CheckCircle, Clock } from 'lucide-react';

const lawfulBasisLabels: Record<string, string> = {
  consent: 'Consent',
  contract: 'Contract',
  legal_obligation: 'Legal Obligation',
  vital_interests: 'Vital Interests',
  public_task: 'Public Task',
  legitimate_interests: 'Legitimate Interests',
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'title',
    header: 'Processing Activity',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.title}</span>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {row.original.processingPurpose}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'lawfulBasis',
    header: 'Lawful Basis',
    cell: ({ row }) => (
      <Badge variant="outline">
        {lawfulBasisLabels[row.original.lawfulBasis] || row.original.lawfulBasis}
      </Badge>
    ),
  },
  {
    accessorKey: 'dataSubjectCategories',
    header: 'Data Subjects',
    cell: ({ row }) => {
      const cats = row.original.dataSubjectCategories || [];
      return (
        <div className="flex gap-1 flex-wrap">
          {cats.slice(0, 2).map((c: string) => (
            <Badge key={c} variant="secondary" className="text-xs capitalize">
              {c}
            </Badge>
          ))}
          {cats.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{cats.length - 2}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'personalDataCategories',
    header: 'Data Categories',
    cell: ({ row }) => {
      const cats = row.original.personalDataCategories || [];
      return (
        <div className="flex gap-1 flex-wrap">
          {cats.slice(0, 2).map((c: string) => (
            <Badge key={c} variant="secondary" className="text-xs capitalize">
              {c}
            </Badge>
          ))}
          {cats.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{cats.length - 2}
            </Badge>
          )}
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
    accessorKey: 'nextReviewDate',
    header: 'Next Review',
    cell: ({ row }) => {
      const date = row.original.nextReviewDate;
      if (!date) return <span className="text-muted-foreground">--</span>;
      const d = new Date(date);
      const isOverdue = d < new Date();
      return (
        <span className={isOverdue ? 'text-destructive font-medium' : ''}>
          {d.toLocaleDateString()}
          {isOverdue && ' (Overdue)'}
        </span>
      );
    },
  },
];

function RopaStats({ entries }: { entries: any[] }) {
  const total = entries.length;
  const approved = entries.filter((e) => e.status === 'approved').length;
  const draft = entries.filter((e) => e.status === 'draft').length;
  const reviewsDue = entries.filter((e) => {
    if (!e.nextReviewDate) return false;
    return new Date(e.nextReviewDate) < new Date();
  }).length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <ScrollText className="h-4 w-4" /> Total Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" /> Approved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{approved}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Drafts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{draft}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Reviews Due
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{reviewsDue}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RopaPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRopaEntries({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-96" />;

  const entries = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Records of Processing Activities</h1>
          <p className="text-muted-foreground">
            Maintain your Article 30 processing records inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>Add Entry</Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No RoPA entries"
          description="Create records of processing activities to maintain compliance with GDPR Article 30 and DPDP Act requirements."
          action={{ label: 'Add Entry', onClick: () => {} }}
        />
      ) : (
        <>
          <RopaStats entries={entries} />
          <DataTable
            columns={columns}
            data={entries}
            pagination={data?.pagination}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
