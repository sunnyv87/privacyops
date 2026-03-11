// ──────────────────────────────────────────────────────────────
// Shared Enums — single source of truth across API + Web
// ──────────────────────────────────────────────────────────────

export enum DataSourceType {
  AWS_S3 = 'aws_s3',
  AWS_RDS = 'aws_rds',
  AZURE_BLOB = 'azure_blob',
  GCP_STORAGE = 'gcp_storage',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  SNOWFLAKE = 'snowflake',
  BIGQUERY = 'bigquery',
  SALESFORCE = 'salesforce',
  SLACK = 'slack',
  MS365 = 'ms365',
}

export enum DataSourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  PENDING = 'pending',
}

export enum ScanJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AssetType {
  TABLE = 'table',
  BUCKET = 'bucket',
  COLLECTION = 'collection',
  FILE = 'file',
  DATASET = 'dataset',
  SCHEMA = 'schema',
}

export enum ClassificationMethod {
  REGEX = 'regex',
  DICTIONARY = 'dictionary',
  ML = 'ml',
  MANUAL = 'manual',
}

export enum ClassificationCategory {
  PII = 'pii',
  PFI = 'pfi',
  PHI = 'phi',
  SENSITIVE = 'sensitive',
  PUBLIC = 'public',
}

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum RiskFindingStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  MITIGATED = 'mitigated',
  ACCEPTED = 'accepted',
  FALSE_POSITIVE = 'false_positive',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum DsarRequestType {
  ACCESS = 'access',
  DELETION = 'deletion',
  RECTIFICATION = 'rectification',
  PORTABILITY = 'portability',
  OBJECTION = 'objection',
  RESTRICTION = 'restriction',
}

export enum DsarRequestStatus {
  RECEIVED = 'received',
  IDENTITY_VERIFICATION = 'identity_verification',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  OVERDUE = 'overdue',
}

export enum AssessmentType {
  DPIA = 'dpia',
  PIA = 'pia',
  TIA = 'tia',
  LIA = 'lia',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export enum IncidentSeverity {
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
  P4 = 'p4',
}

export enum IncidentStatus {
  REPORTED = 'reported',
  CONFIRMED = 'confirmed',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum RetentionAction {
  DELETE = 'delete',
  ANONYMIZE = 'anonymize',
  ARCHIVE = 'archive',
}

export enum VendorRiskTier {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum VendorStatus {
  ACTIVE = 'active',
  UNDER_REVIEW = 'under_review',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum ControlStatus {
  IMPLEMENTED = 'implemented',
  PARTIAL = 'partial',
  PLANNED = 'planned',
  NOT_APPLICABLE = 'not_applicable',
}

export enum LawfulBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTEREST = 'vital_interest',
  PUBLIC_INTEREST = 'public_interest',
  LEGITIMATE_INTEREST = 'legitimate_interest',
}

export enum SubscriptionTier {
  TRIAL = 'trial',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
