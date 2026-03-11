'use client';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Clock } from 'lucide-react';

export default function RetentionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Retention"
        description="Manage retention policies and data lifecycle"
        action={{ label: 'Create Policy', onClick: () => {} }}
      />

      <EmptyState
        icon={Clock}
        title="No retention policies"
        description="Define retention policies to automate data lifecycle management and ensure compliance."
        action={{ label: 'Create Policy', onClick: () => {} }}
      />
    </div>
  );
}
