'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCompliance } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="flex flex-col items-center">
      <div className={`text-4xl font-bold ${color}`}>{score}%</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function CompliancePage() {
  const { data, isLoading } = useCompliance();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Regulatory compliance monitoring and control management"
        action={{ label: 'Add Control', onClick: () => {} }}
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Overall Compliance</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ScoreRing score={data?.data?.overallScore || 0} label="Overall" />
              </CardContent>
            </Card>

            {(data?.data?.byRegulation || []).map((reg: any) => (
              <Card key={reg.regulation}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">{reg.regulation}</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ScoreRing score={reg.score || 0} label={`${reg.compliant}/${reg.total} controls`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Controls & Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Control listing with evidence management will render here.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
