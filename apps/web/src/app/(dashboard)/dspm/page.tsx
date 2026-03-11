'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/hooks/use-api';

export default function DspmPage() {
  const { data, isLoading } = useDashboardStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Map & DSPM"
        description="Data Security Posture Management overview"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data?.data?.dataSourcesConnected || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Discovered Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">--</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Critical Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">
                  {data?.data?.criticalFindings || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Health Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data?.data?.privacyHealthScore || 0}/100</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Data Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Interactive data map visualization will render here.
                <br />
                Shows data flows between sources, assets, and classifications.
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
