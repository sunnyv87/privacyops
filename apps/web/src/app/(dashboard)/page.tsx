import { StatCard } from '@/components/dashboard/stat-card';
import { RiskDistributionChart } from '@/components/dashboard/risk-distribution-chart';
import { TopRiskyStores } from '@/components/dashboard/top-risky-stores';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Privacy health overview for your organization
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Privacy Health Score"
          value="72"
          suffix="/100"
          trend={{ value: 5, direction: 'up' }}
          description="Overall privacy maturity"
        />
        <StatCard
          title="Critical Findings"
          value="3"
          trend={{ value: 1, direction: 'down' }}
          description="Requires immediate attention"
          variant="destructive"
        />
        <StatCard
          title="DSAR SLA Compliance"
          value="94%"
          trend={{ value: 2, direction: 'up' }}
          description="Requests completed on time"
        />
        <StatCard
          title="Data Sources Connected"
          value="12"
          description="Across 3 cloud providers"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RiskDistributionChart />
        <TopRiskyStores />
      </div>
    </div>
  );
}
