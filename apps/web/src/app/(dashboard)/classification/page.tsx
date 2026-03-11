'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useClassificationLabels } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tags, Shield, CreditCard, HeartPulse, Eye } from 'lucide-react';

const categoryIcons: Record<string, typeof Shield> = {
  pii: Shield,
  pfi: CreditCard,
  phi: HeartPulse,
  sensitive: Eye,
};

const categoryColors: Record<string, string> = {
  pii: 'bg-blue-100 text-blue-800',
  pfi: 'bg-purple-100 text-purple-800',
  phi: 'bg-red-100 text-red-800',
  sensitive: 'bg-orange-100 text-orange-800',
  business: 'bg-yellow-100 text-yellow-800',
  public: 'bg-green-100 text-green-800',
};

const sensitivityColors: Record<number, string> = {
  1: 'text-green-600',
  2: 'text-yellow-600',
  3: 'text-orange-600',
  4: 'text-red-600',
  5: 'text-red-800',
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: 'Label',
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
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const cat = row.original.category;
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${categoryColors[cat] || 'bg-gray-100 text-gray-800'}`}>
          {cat}
        </span>
      );
    },
  },
  {
    accessorKey: 'sensitivityLevel',
    header: 'Sensitivity',
    cell: ({ row }) => {
      const level = row.original.sensitivityLevel;
      const labels = ['', 'Low', 'Medium', 'High', 'Very High', 'Critical'];
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-2 w-4 rounded-sm ${i <= level ? 'bg-current' : 'bg-muted'}`}
                style={{ color: i <= level ? (sensitivityColors[level] || '#666') : undefined }}
              />
            ))}
          </div>
          <span className={`text-xs font-medium ${sensitivityColors[level] || ''}`}>
            {labels[level] || level}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'regulationTags',
    header: 'Regulations',
    cell: ({ row }) => {
      const tags = row.original.regulationTags || [];
      return (
        <div className="flex gap-1 flex-wrap">
          {tags.slice(0, 3).map((t: string) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">+{tags.length - 3}</Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'isSystem',
    header: 'Source',
    cell: ({ row }) => (
      <Badge variant={row.original.isSystem ? 'secondary' : 'outline'}>
        {row.original.isSystem ? 'System' : 'Custom'}
      </Badge>
    ),
  },
];

function ClassificationStats({ labels }: { labels: any[] }) {
  const pii = labels.filter((l) => l.category === 'pii').length;
  const pfi = labels.filter((l) => l.category === 'pfi').length;
  const phi = labels.filter((l) => l.category === 'phi').length;
  const critical = labels.filter((l) => l.sensitivityLevel >= 4).length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-blue-600" /> PII Labels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{pii}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-purple-600" /> Financial (PFI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{pfi}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <HeartPulse className="h-4 w-4 text-red-600" /> Health (PHI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{phi}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-orange-600" /> High Sensitivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{critical}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClassificationPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useClassificationLabels();

  if (isLoading) return <Skeleton className="h-96" />;

  const labels = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Classification"
        description="Automated and manual data classification labels"
        action={{ label: 'Create Label', onClick: () => {} }}
      />

      {labels.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No classifications yet"
          description="Run a classification scan on discovered assets to detect sensitive data labels."
        />
      ) : (
        <>
          <ClassificationStats labels={labels} />
          <DataTable columns={columns} data={labels} />
        </>
      )}
    </div>
  );
}
