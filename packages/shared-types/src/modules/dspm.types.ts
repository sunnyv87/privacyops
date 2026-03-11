import { Severity, RiskFindingStatus } from '../enums';

export interface RiskScoreBreakdown {
  sensitivity: number;
  exposure: number;
  access: number;
  volumeModifier: number;
  baseScore: number;
  adjustments: { reason: string; points: number }[];
  finalScore: number;
  severity: Severity;
}

export interface FindingResponse {
  id: string;
  assetId: string;
  assetName: string;
  assetType: string;
  dataSourceName: string;
  severity: Severity;
  score: number;
  status: RiskFindingStatus;
  exposure: Record<string, unknown>;
  accessControl: Record<string, unknown>;
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DataMapNode {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  riskScore: number;
  severity: Severity;
  classificationLabels: string[];
  location: string;
  connections: string[];
}
