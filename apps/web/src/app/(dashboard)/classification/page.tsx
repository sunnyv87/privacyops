'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { Tags } from 'lucide-react';

export default function ClassificationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Classification"
        description="Automated and manual data classification labels"
        action={{ label: 'Create Label', onClick: () => {} }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PII Labels Detected
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">--</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Financial Data (PFI)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">--</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toxic Combinations
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-destructive">--</p></CardContent>
        </Card>
      </div>

      <EmptyState
        icon={Tags}
        title="No classifications yet"
        description="Run a classification scan on discovered assets to detect sensitive data labels."
      />
    </div>
  );
}
