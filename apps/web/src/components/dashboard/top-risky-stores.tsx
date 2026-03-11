'use client';

import { SeverityBadge } from '@/components/ui/severity-badge';

export function TopRiskyStores() {
  // Placeholder data
  const stores = [
    {
      name: 'customer-data-bucket',
      type: 'S3 Bucket',
      source: 'AWS Production',
      riskScore: 95,
      severity: 'critical' as const,
      findings: 3,
    },
    {
      name: 'users_pii',
      type: 'PostgreSQL Table',
      source: 'Production DB',
      riskScore: 82,
      severity: 'high' as const,
      findings: 5,
    },
    {
      name: 'payments_archive',
      type: 'S3 Bucket',
      source: 'AWS Production',
      riskScore: 78,
      severity: 'high' as const,
      findings: 2,
    },
    {
      name: 'employee_records',
      type: 'PostgreSQL Table',
      source: 'HR Database',
      riskScore: 65,
      severity: 'medium' as const,
      findings: 4,
    },
    {
      name: 'analytics_events',
      type: 'BigQuery Dataset',
      source: 'GCP Analytics',
      riskScore: 55,
      severity: 'medium' as const,
      findings: 2,
    },
  ];

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-semibold">Top Risky Data Stores</h3>
      <div className="mt-4">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2">Asset</th>
              <th className="pb-2">Risk Score</th>
              <th className="pb-2">Severity</th>
              <th className="pb-2 text-right">Findings</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {stores.map((store) => (
              <tr key={store.name} className="border-t">
                <td className="py-3">
                  <div>
                    <p className="font-medium">{store.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {store.type} / {store.source}
                    </p>
                  </div>
                </td>
                <td className="py-3">
                  <span className="font-mono font-medium">
                    {store.riskScore}
                  </span>
                </td>
                <td className="py-3">
                  <SeverityBadge severity={store.severity} />
                </td>
                <td className="py-3 text-right">{store.findings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
