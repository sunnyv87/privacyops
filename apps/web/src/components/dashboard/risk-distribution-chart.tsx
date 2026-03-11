'use client';

export function RiskDistributionChart() {
  // Placeholder — will use Recharts in implementation
  const data = [
    { severity: 'Critical', count: 3, color: '#dc2626' },
    { severity: 'High', count: 8, color: '#ea580c' },
    { severity: 'Medium', count: 15, color: '#d97706' },
    { severity: 'Low', count: 24, color: '#2563eb' },
    { severity: 'Info', count: 42, color: '#6b7280' },
  ];

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-semibold">Risk Findings Distribution</h3>
      <div className="mt-4 space-y-3">
        {data.map((item) => (
          <div key={item.severity} className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="w-16 text-sm">{item.severity}</span>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${(item.count / total) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
            <span className="w-8 text-right text-sm font-medium">
              {item.count}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Total: {total} findings across {12} data sources
      </p>
    </div>
  );
}
