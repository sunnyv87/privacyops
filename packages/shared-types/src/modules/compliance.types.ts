import { ControlStatus } from '../enums';

export interface RegulationResponse {
  id: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  obligationCount: number;
  complianceScore: number;
}

export interface ObligationResponse {
  id: string;
  regulationId: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  controlCount: number;
  compliantControlCount: number;
}

export interface ControlResponse {
  id: string;
  code: string;
  title: string;
  description: string;
  status: ControlStatus;
  ownerId: string | null;
  ownerName: string | null;
  evidenceCount: number;
  obligations: string[];
  lastReviewedAt: string | null;
}

export interface ComplianceScorecard {
  overallScore: number;
  byRegulation: { regulation: string; score: number; total: number; compliant: number }[];
  gapCount: number;
  upcomingDeadlines: { obligation: string; deadline: string }[];
}
