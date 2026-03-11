import { DsarRequestType, DsarRequestStatus } from '../enums';

export interface DsarRequestResponse {
  id: string;
  reference: string;
  type: DsarRequestType;
  status: DsarRequestStatus;
  dataSubjectEmail: string;
  description: string;
  dueDate: string;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  legalHold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DsarTimeline {
  id: string;
  requestId: string;
  status: DsarRequestStatus;
  note: string;
  actorName: string;
  createdAt: string;
}

export interface DsarStats {
  total: number;
  byStatus: Record<DsarRequestStatus, number>;
  avgCompletionDays: number;
  slaCompliance: number;
  overdueCount: number;
}
