'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useAssessments } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, FileCheck, Shield, TrendingUp } from 'lucide-react';

const typeLabels: Record<string, string> = {
  dpia: 'DPIA',
  pia: 'PIA',
  tia: 'TIA',
  lia: 'LIA',
};

const riskLevelColors: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
};

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'title',
    header: 'Assessment Title',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.title}</span>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {row.original.processingDescription}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="outline">{typeLabels[row.original.type] || row.original.type}</Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'overallRiskLevel',
    header: 'Risk Level',
    cell: ({ row }) => {
      const level = row.original.overallRiskLevel;
      if (!level) return <span className="text-muted-foreground">--</span>;
      return (
        <span className={`font-medium capitalize ${riskLevelColors[level] || ''}`}>
          {level}
        </span>
      );
    },
  },
  {
    accessorKey: 'overallRiskScore',
    header: 'Risk Score',
    cell: ({ row }) => {
      const score = row.original.overallRiskScore;
      if (score == null) return <span className="text-muted-foreground">--</span>;
      const color =
        score >= 75 ? 'text-red-600' : score >= 50 ? 'text-orange-600' : score >= 25 ? 'text-yellow-600' : 'text-green-600';
      return <span className={`font-mono font-medium ${color}`}>{score}</span>;
    },
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

function AssessmentStats({ assessments }: { assessments: any[] }) {
  const draft = assessments.filter((a) => a.status === 'draft').length;
  const inReview = assessments.filter((a) => a.status === 'in_review').length;
  const approved = assessments.filter((a) => a.status === 'approved').length;
  const highRisk = assessments.filter(
    (a) => a.overallRiskLevel === 'critical' || a.overallRiskLevel === 'high',
  ).length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileCheck className="h-4 w-4" /> Approved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{approved}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-4 w-4" /> In Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{inReview}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Drafts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{draft}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> High/Critical Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{highRisk}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RiskAssessmentsPage() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const typeFilter = activeTab === 'all' ? undefined : activeTab;
  const { data, isLoading } = useAssessments({
    page,
    page_size: 20,
    ...(typeFilter && { type: typeFilter }),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  const assessments = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Assessments"
        description="Privacy Impact Assessments (DPIA/PIA/TIA/LIA)"
        action={{ label: 'New Assessment', onClick: () => {} }}
      />

      {assessments.length === 0 && activeTab === 'all' ? (
        <EmptyState
          icon={AlertTriangle}
          title="No assessments"
          description="Create privacy impact assessments to evaluate and document data processing risks as required by GDPR Article 35 and DPDP Act."
          action={{ label: 'Start Assessment', onClick: () => {} }}
        />
      ) : (
        <>
          <AssessmentStats assessments={assessments} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="dpia">DPIA</TabsTrigger>
              <TabsTrigger value="pia">PIA</TabsTrigger>
              <TabsTrigger value="tia">TIA</TabsTrigger>
              <TabsTrigger value="lia">LIA</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <DataTable
                columns={columns}
                data={assessments}
                pagination={data?.pagination}
                onPageChange={setPage}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
