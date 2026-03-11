import { Severity } from '../enums';

export interface DashboardStats {
  privacyHealthScore: number;
  criticalFindings: number;
  dsarSlaCompliance: number;
  dataSourcesConnected: number;
  trends: {
    healthScoreDelta: number;
    criticalFindingsDelta: number;
    dsarComplianceDelta: number;
  };
}

export interface RiskDistribution {
  severity: Severity;
  count: number;
  percentage: number;
}

export interface TopRiskyAsset {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  riskScore: number;
  severity: Severity;
  findingCount: number;
}

export interface ComplianceOverview {
  overallScore: number;
  regulations: { name: string; score: number }[];
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  severity: Severity | null;
  createdAt: string;
}
