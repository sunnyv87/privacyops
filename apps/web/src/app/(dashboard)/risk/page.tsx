'use client';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { AlertTriangle } from 'lucide-react';

export default function RiskAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Assessments"
        description="Privacy Impact Assessments (DPIA/PIA/TIA/LIA)"
        action={{ label: 'New Assessment', onClick: () => {} }}
      />

      <EmptyState
        icon={AlertTriangle}
        title="No assessments"
        description="Create privacy impact assessments to evaluate data processing risks."
        action={{ label: 'Start Assessment', onClick: () => {} }}
      />
    </div>
  );
}
