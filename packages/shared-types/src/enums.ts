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
  CREDENTIALS = 'credentials',
  BIOMETRIC = 'biometric',
  GOVERNMENT_ID = 'government_id',
  AI_TRAINING = 'ai_training',
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

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum AuthProvider {
  LOCAL = 'local',
  OIDC = 'oidc',
  SAML = 'saml',
  SCIM = 'scim',
}

export enum Permission {
  // Wildcard
  ALL = '*',

  // Admin
  ADMIN_TENANT_CONFIGURE = 'admin:tenant:configure',
  ADMIN_USERS_MANAGE = 'admin:users:manage',
  ADMIN_ROLES_MANAGE = 'admin:roles:manage',
  ADMIN_SECRETS_READ = 'admin:secrets:read',

  // Users
  USERS_CREATE = 'users:users:create',
  USERS_READ = 'users:users:read',
  USERS_UPDATE = 'users:users:update',
  USERS_DELETE = 'users:users:delete',

  // DSPM
  DSPM_ALL = 'dspm:*',
  DSPM_FINDINGS_READ = 'dspm:findings:read',
  DSPM_FINDINGS_UPDATE = 'dspm:findings:update',
  DSPM_CONNECTORS_READ = 'dspm:connectors:read',

  // Discovery
  DISCOVERY_ALL = 'discovery:*',
  DISCOVERY_ASSETS_READ = 'discovery:assets:read',
  DISCOVERY_ASSETS_UPDATE = 'discovery:assets:update',

  // Classification
  CLASSIFICATION_ALL = 'classification:*',
  CLASSIFICATION_READ = 'classification:read',
  CLASSIFICATION_REVIEW = 'classification:review',

  // Consent
  CONSENT_ALL = 'consent:*',
  CONSENT_READ = 'consent:read',

  // DSAR
  DSAR_ALL = 'dsar:*',
  DSAR_READ = 'dsar:read',
  DSAR_PII_READ = 'dsar:pii:read',

  // Risk
  RISK_ALL = 'risk:*',
  RISK_READ = 'risk:read',

  // Breach
  BREACH_ALL = 'breach:*',
  BREACH_READ = 'breach:read',

  // Retention
  RETENTION_ALL = 'retention:*',
  RETENTION_READ = 'retention:read',

  // Vendors
  VENDORS_ALL = 'vendors:*',
  VENDORS_READ = 'vendors:read',

  // Compliance
  COMPLIANCE_ALL = 'compliance:*',
  COMPLIANCE_READ = 'compliance:read',

  // RoPA
  ROPA_ALL = 'ropa:*',
  ROPA_READ = 'ropa:read',

  // Dashboard
  DASHBOARD_ALL = 'dashboard:*',
  DASHBOARD_READ = 'dashboard:read',

  // Audit
  AUDIT_READ = 'audit:read',
  AUDIT_ADMIN = 'audit:admin',
  AUDIT_EXPORT = 'audit:export',
  AUDIT_PII_READ = 'audit:pii:read',

  // Data Graph
  DATA_GRAPH_READ = 'dspm:data-graph:read',
  DATA_GRAPH_ADMIN = 'dspm:data-graph:admin',

  // Identity Access
  IDENTITY_ACCESS_READ = 'dspm:identity-access:read',
  IDENTITY_ACCESS_ADMIN = 'dspm:identity-access:admin',

  // Shadow Data
  SHADOW_DATA_READ = 'dspm:shadow-data:read',
  SHADOW_DATA_ADMIN = 'dspm:shadow-data:admin',

  // Lineage
  LINEAGE_READ = 'dspm:lineage:read',
  LINEAGE_ADMIN = 'dspm:lineage:admin',

  // Attack Paths
  ATTACK_PATHS_READ = 'dspm:attack-paths:read',
  ATTACK_PATHS_ADMIN = 'dspm:attack-paths:admin',

  // Remediation
  REMEDIATION_READ = 'remediation:read',
  REMEDIATION_ADMIN = 'remediation:admin',
  REMEDIATION_EXECUTE = 'remediation:execute',

  // AI Governance
  AI_GOVERNANCE_READ = 'ai-governance:read',
  AI_GOVERNANCE_ADMIN = 'ai-governance:admin',
}

// ── New Module Enums ─────────────────────────────────────────

export enum RemediationActionType {
  REMOVE_PUBLIC_ACCESS = 'remove_public_access',
  REVOKE_PERMISSIONS = 'revoke_permissions',
  APPLY_RETENTION = 'apply_retention',
  QUARANTINE = 'quarantine',
  TRIGGER_REVIEW = 'trigger_review',
}

export enum RemediationStatus {
  PROPOSED = 'proposed',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum ShadowDataAlertType {
  DUPLICATE = 'duplicate',
  ORPHANED = 'orphaned',
  STALE_EXPORT = 'stale_export',
  SHADOW_SAAS = 'shadow_saas',
  BACKUP_COPY = 'backup_copy',
  AI_SANDBOX = 'ai_sandbox',
}

export enum IdentityType {
  USER = 'user',
  SERVICE_ACCOUNT = 'service_account',
  VENDOR = 'vendor',
  GROUP = 'group',
  PUBLIC = 'public',
}

export enum LineageTransformType {
  COPY = 'copy',
  ETL = 'etl',
  EXPORT = 'export',
  SHARE = 'share',
  API_SYNC = 'api_sync',
  BACKUP = 'backup',
  AI_TRAINING = 'ai_training',
}

export enum AttackPathStatus {
  ACTIVE = 'active',
  MITIGATED = 'mitigated',
  FALSE_POSITIVE = 'false_positive',
}

export enum AiSystemRiskCategory {
  UNACCEPTABLE = 'unacceptable',
  HIGH = 'high',
  LIMITED = 'limited',
  MINIMAL = 'minimal',
}

export enum AiSystemStatus {
  ACTIVE = 'active',
  DEVELOPMENT = 'development',
  DEPRECATED = 'deprecated',
  RETIRED = 'retired',
}

export enum AiDatasetUsageType {
  TRAINING = 'training',
  VALIDATION = 'validation',
  INFERENCE = 'inference',
  FINE_TUNING = 'fine_tuning',
}

export enum DataGraphNodeType {
  ASSET = 'asset',
  DATASET = 'dataset',
  COLUMN = 'column',
  IDENTITY = 'identity',
  VENDOR = 'vendor',
  AI_SYSTEM = 'ai_system',
  PROCESSING_ACTIVITY = 'processing_activity',
  RETENTION_POLICY = 'retention_policy',
}

export enum DataGraphRelationshipType {
  CONTAINS = 'CONTAINS',
  STORED_IN = 'STORED_IN',
  ACCESSIBLE_BY = 'ACCESSIBLE_BY',
  OWNED_BY = 'OWNED_BY',
  SHARED_WITH = 'SHARED_WITH',
  USED_BY_AI = 'USED_BY_AI',
  GOVERNED_BY = 'GOVERNED_BY',
}

export enum RetentionViolationType {
  NO_POLICY = 'no_policy',
  EXPIRED = 'expired',
  OVERDUE_REVIEW = 'overdue_review',
}

export enum ControlCheckResult {
  PASS = 'pass',
  FAIL = 'fail',
  PARTIAL = 'partial',
  ERROR = 'error',
}

export enum BreachDetectionRuleType {
  LARGE_EXPORT = 'large_export',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  EXTERNAL_EXPOSURE = 'external_exposure',
  ANOMALY = 'anomaly',
}
