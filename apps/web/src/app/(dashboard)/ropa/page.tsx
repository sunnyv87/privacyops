'use client';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { ScrollText, Download } from 'lucide-react';

export default function RopaPage() {
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

      <EmptyState
        icon={ScrollText}
        title="No RoPA entries"
        description="Create records of processing activities to maintain compliance with GDPR Article 30 and DPDP Act requirements."
        action={{ label: 'Add Entry', onClick: () => {} }}
      />
    </div>
  );
}
