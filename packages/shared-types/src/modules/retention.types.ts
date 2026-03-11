import { RetentionAction } from '../enums';

export interface RetentionPolicyResponse {
  id: string;
  name: string;
  recordCategory: string;
  retentionDays: number;
  actionOnExpiry: RetentionAction;
  legalBasis: string | null;
  regulationReference: string | null;
  isActive: boolean;
  affectedAssetCount: number;
  nextDisposalDate: string | null;
  createdAt: string;
}

export interface RetentionDisposalJob {
  id: string;
  policyId: string;
  policyName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assetsProcessed: number;
  assetsTotal: number;
  startedAt: string | null;
  completedAt: string | null;
}
