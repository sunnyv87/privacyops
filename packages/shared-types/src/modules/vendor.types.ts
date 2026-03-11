import { VendorRiskTier, VendorStatus } from '../enums';

export interface VendorResponse {
  id: string;
  name: string;
  description: string;
  riskTier: VendorRiskTier;
  status: VendorStatus;
  contactName: string | null;
  contactEmail: string | null;
  contractExpiry: string | null;
  dpaSignedAt: string | null;
  dataProcessingPurposes: string[];
  dataCategories: string[];
  lastAssessmentDate: string | null;
  nextAssessmentDate: string | null;
  createdAt: string;
}

export interface VendorAssessmentResponse {
  id: string;
  vendorId: string;
  vendorName: string;
  assessorName: string;
  riskScore: number;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved';
  findings: { category: string; finding: string; severity: string }[];
  completedAt: string | null;
  createdAt: string;
}
