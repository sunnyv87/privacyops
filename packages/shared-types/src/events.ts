// ──────────────────────────────────────────────────────────────
// Event Types — NATS JetStream event contracts
// ──────────────────────────────────────────────────────────────

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string;
  actorId?: string;
  timestamp: string;
  payload: T;
}

// ── Event Type Constants ─────────────────────────────────────

export const EventTypes = {
  // Connectors
  CONNECTOR_CREATED: 'connector.created',
  CONNECTOR_UPDATED: 'connector.updated',
  CONNECTOR_DELETED: 'connector.deleted',
  CONNECTOR_TESTED: 'connector.tested',
  CONNECTOR_FAILED: 'connector.failed',

  // Discovery & Scanning
  SCAN_QUEUED: 'scan.queued',
  SCAN_STARTED: 'scan.started',
  SCAN_COMPLETED: 'scan.completed',
  SCAN_FAILED: 'scan.failed',
  ASSET_DISCOVERED: 'asset.discovered',

  // Classification
  CLASSIFICATION_STARTED: 'classification.started',
  CLASSIFICATION_COMPLETED: 'classification.completed',
  TOXIC_COMBINATION_DETECTED: 'toxic_combination.detected',

  // DSPM / Risk
  RISK_SCORE_CALCULATED: 'risk.score.calculated',
  RISK_SCORE_CHANGED: 'risk.score.changed',
  FINDING_CREATED: 'finding.created',
  FINDING_STATUS_CHANGED: 'finding.status.changed',

  // Consent
  CONSENT_GRANTED: 'consent.granted',
  CONSENT_REVOKED: 'consent.revoked',
  CONSENT_EXPIRED: 'consent.expired',

  // DSAR
  DSAR_RECEIVED: 'dsar.received',
  DSAR_VERIFIED: 'dsar.verified',
  DSAR_IN_PROGRESS: 'dsar.in_progress',
  DSAR_COMPLETED: 'dsar.completed',
  DSAR_OVERDUE: 'dsar.overdue',

  // Incidents
  INCIDENT_REPORTED: 'incident.reported',
  INCIDENT_CONFIRMED: 'incident.confirmed',
  INCIDENT_CONTAINED: 'incident.contained',
  INCIDENT_RESOLVED: 'incident.resolved',

  // Retention
  RETENTION_POLICY_TRIGGERED: 'retention.policy.triggered',
  RETENTION_DISPOSAL_COMPLETED: 'retention.disposal.completed',

  // Compliance
  COMPLIANCE_SCORE_CHANGED: 'compliance.score.changed',
  CONTROL_STATUS_CHANGED: 'control.status.changed',

  // Vendor
  VENDOR_ASSESSMENT_DUE: 'vendor.assessment.due',
  VENDOR_RISK_CHANGED: 'vendor.risk.changed',

  // Approval Workflows
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_APPROVED: 'approval.approved',
  APPROVAL_REJECTED: 'approval.rejected',

  // Assessments / DPIA
  ASSESSMENT_SUBMITTED: 'assessment.submitted',
  ASSESSMENT_APPROVED: 'assessment.approved',
  ASSESSMENT_REJECTED: 'assessment.rejected',

  // Remediation
  REMEDIATION_PROPOSED: 'remediation.proposed',
  REMEDIATION_APPROVED: 'remediation.approved',
  REMEDIATION_EXECUTED: 'remediation.executed',
  REMEDIATION_ROLLED_BACK: 'remediation.rolled_back',
  REMEDIATION_FAILED: 'remediation.failed',

  // Shadow Data
  SHADOW_DATA_DETECTED: 'shadow_data.detected',
  SHADOW_DATA_RESOLVED: 'shadow_data.resolved',

  // Attack Paths
  ATTACK_PATH_DETECTED: 'attack_path.detected',
  ATTACK_PATH_MITIGATED: 'attack_path.mitigated',

  // Data Lineage
  LINEAGE_RECORD_CREATED: 'lineage.record.created',
  LINEAGE_BREACH_IMPACT_ANALYZED: 'lineage.breach_impact.analyzed',

  // Identity Access
  IDENTITY_ACCESS_ANOMALY_DETECTED: 'identity_access.anomaly.detected',
  IDENTITY_ACCESS_EXCESSIVE: 'identity_access.excessive',

  // AI Governance
  AI_SYSTEM_REGISTERED: 'ai_governance.system.registered',
  AI_DATASET_USAGE_RECORDED: 'ai_governance.dataset_usage.recorded',
  AI_COMPLIANCE_VIOLATION: 'ai_governance.compliance.violation',

  // Data Graph
  DATA_GRAPH_SYNCED: 'data_graph.synced',

  // Retention Governance
  RETENTION_VIOLATION_DETECTED: 'retention.violation.detected',
  RETENTION_DISPOSITION_CERTIFIED: 'retention.disposition.certified',

  // Breach Detection
  BREACH_DETECTED: 'breach.detected',
  BREACH_NOTIFICATION_SENT: 'breach.notification.sent',
} as const;
