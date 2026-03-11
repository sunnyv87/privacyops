import { IncidentSeverity, IncidentStatus } from '../enums';

export interface IncidentResponse {
  id: string;
  reference: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  affectedDataSubjects: number;
  affectedAssets: string[];
  isBreach: boolean;
  breachNotificationDeadline: string | null;
  rootCause: string | null;
  containmentActions: string | null;
  reportedAt: string;
  containedAt: string | null;
  resolvedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
}

export interface IncidentTimeline {
  id: string;
  incidentId: string;
  action: string;
  description: string;
  actorName: string;
  createdAt: string;
}

export interface BreachNotification {
  regulatoryBody: string;
  deadline: string;
  notifiedAt: string | null;
  status: 'pending' | 'notified' | 'overdue';
}
