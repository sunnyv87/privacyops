import { AssessmentType, AssessmentStatus, Severity } from '../enums';

export interface AssessmentResponse {
  id: string;
  title: string;
  type: AssessmentType;
  status: AssessmentStatus;
  riskScore: number | null;
  description: string;
  ownerId: string;
  ownerName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  findings: AssessmentFinding[];
  createdAt: string;
}

export interface AssessmentFinding {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  recommendation: string;
  status: 'open' | 'mitigated' | 'accepted';
}

export interface AssessmentTemplate {
  id: string;
  name: string;
  type: AssessmentType;
  sections: { title: string; questions: string[] }[];
}
