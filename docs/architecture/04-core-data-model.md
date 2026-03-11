# Section 4 — Core Data Model

## Tenancy Model

All entities include `tenant_id` (UUID, NOT NULL, indexed). PostgreSQL Row Level Security (RLS) enforces tenant isolation at the database layer. Application layer sets `SET app.current_tenant = '<tenant_id>'` on every connection.

## Soft Delete & Archival Strategy

All entities use `deleted_at` (TIMESTAMP, nullable) for soft delete. Archival moves records to `*_archive` tables after configurable retention period. Hard delete only for data subject deletion requests (DSAR).

## Common Fields (all entities)

```
id: UUID (PK, default gen_random_uuid())
tenant_id: UUID (FK → tenants.id, NOT NULL)
created_at: TIMESTAMP WITH TIME ZONE (NOT NULL, default now())
updated_at: TIMESTAMP WITH TIME ZONE (NOT NULL, default now())
created_by: UUID (FK → users.id)
updated_by: UUID (FK → users.id)
deleted_at: TIMESTAMP WITH TIME ZONE (nullable)
```

---

## Entity Definitions

### 1. Tenant

**Description**: Top-level organizational entity. Each customer is a tenant.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| name | VARCHAR(255) | Y | Company name |
| slug | VARCHAR(100) | Y | URL-safe identifier, unique |
| domain | VARCHAR(255) | N | Primary email domain |
| subscription_tier | ENUM | Y | free, starter, professional, enterprise |
| status | ENUM | Y | active, suspended, trial, deactivated |
| settings | JSONB | N | Tenant-specific config |
| data_residency_region | VARCHAR(50) | Y | e.g., 'in-west-1', 'eu-west-1' |
| encryption_key_id | VARCHAR(255) | Y | KMS key reference |
| trial_expires_at | TIMESTAMP | N | |
| metadata | JSONB | N | |

**Indexes**: slug (unique), domain, status
**Lifecycle**: active → suspended → deactivated

---

### 2. User

**Description**: Platform user belonging to a tenant.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK → tenants |
| email | VARCHAR(255) | Y | Unique within tenant |
| name | VARCHAR(255) | Y | |
| status | ENUM | Y | active, invited, disabled |
| auth_provider | ENUM | Y | local, saml, oidc, scim |
| external_id | VARCHAR(255) | N | IdP subject ID |
| mfa_enabled | BOOLEAN | Y | Default false |
| last_login_at | TIMESTAMP | N | |
| preferences | JSONB | N | UI preferences |

**Indexes**: (tenant_id, email) unique, external_id, status
**Lifecycle**: invited → active → disabled

---

### 3. Role

**Description**: RBAC role definitions.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | N | NULL = system role |
| name | VARCHAR(100) | Y | |
| slug | VARCHAR(100) | Y | |
| description | TEXT | N | |
| permissions | JSONB | Y | Array of permission strings |
| is_system | BOOLEAN | Y | Cannot be modified if true |

**Indexes**: (tenant_id, slug) unique

---

### 4. UserRole (join table)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| user_id | UUID | Y | FK → users |
| role_id | UUID | Y | FK → roles |
| scope | JSONB | N | Optional scope restrictions (business unit, module) |

---

### 5. DataSource

**Description**: A connected external system (cloud account, database, SaaS app).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| type | ENUM | Y | aws_s3, aws_rds, azure_blob, gcp_storage, postgresql, mysql, mongodb, snowflake, bigquery, google_drive, onedrive, sharepoint, salesforce, github, slack, m365, generic_rest |
| status | ENUM | Y | connected, disconnected, error, pending_setup |
| connection_config | JSONB | Y | Encrypted connection details |
| auth_method | ENUM | Y | iam_role, access_key, oauth2, service_account, connection_string, api_key |
| credential_id | UUID | N | FK → credentials (vault reference) |
| last_connected_at | TIMESTAMP | N | |
| last_scan_at | TIMESTAMP | N | |
| scan_schedule | VARCHAR(50) | N | Cron expression |
| metadata | JSONB | N | Cloud account ID, region, etc. |
| tags | JSONB | N | User-defined tags |

**Indexes**: tenant_id, type, status
**Lifecycle**: pending_setup → connected → disconnected | error

---

### 6. Credential

**Description**: Encrypted credential storage (secrets reference).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| type | ENUM | Y | access_key, oauth_token, service_account_key, connection_string, api_key |
| encrypted_value | BYTEA | Y | Encrypted with tenant KMS key |
| vault_reference | VARCHAR(500) | N | External vault path if using HashiCorp Vault |
| expires_at | TIMESTAMP | N | |
| last_rotated_at | TIMESTAMP | N | |

---

### 7. ScanJob

**Description**: A discovery/classification scan execution.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| data_source_id | UUID | Y | FK → data_sources |
| type | ENUM | Y | discovery, classification, full, incremental |
| status | ENUM | Y | queued, running, completed, failed, cancelled |
| started_at | TIMESTAMP | N | |
| completed_at | TIMESTAMP | N | |
| stats | JSONB | N | {assets_found, fields_scanned, classifications_applied, errors} |
| error_message | TEXT | N | |
| config | JSONB | N | Scan-specific config overrides |
| triggered_by | ENUM | Y | scheduled, manual, event |

**Indexes**: tenant_id, data_source_id, status, started_at

---

### 8. Asset

**Description**: A discovered data asset (table, bucket, collection, file, API endpoint).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| data_source_id | UUID | Y | FK → data_sources |
| name | VARCHAR(500) | Y | Table name, bucket name, etc. |
| type | ENUM | Y | table, view, bucket, container, collection, file, api_endpoint, channel, repository |
| path | VARCHAR(2000) | N | Full path/URI |
| parent_asset_id | UUID | N | FK → assets (for hierarchical assets) |
| status | ENUM | Y | active, stale, deleted_upstream |
| discovered_at | TIMESTAMP | Y | |
| last_scanned_at | TIMESTAMP | N | |
| row_count_estimate | BIGINT | N | |
| size_bytes | BIGINT | N | |
| schema_snapshot | JSONB | N | Latest schema |
| owner_user_id | UUID | N | FK → users (assigned data steward) |
| tags | JSONB | N | |
| metadata | JSONB | N | Source-specific metadata |

**Indexes**: tenant_id, data_source_id, type, path, name
**OpenSearch**: Full-text search on name, path, tags, metadata

---

### 9. AssetField

**Description**: A column/field within a data asset.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| asset_id | UUID | Y | FK → assets |
| name | VARCHAR(500) | Y | Column/field name |
| data_type | VARCHAR(100) | N | SQL type or inferred type |
| ordinal_position | INTEGER | N | |
| nullable | BOOLEAN | N | |
| sample_values | JSONB | N | Redacted/masked samples |
| profiling_stats | JSONB | N | {distinct_count, null_pct, min, max, pattern_distribution} |

**Indexes**: (asset_id, name), tenant_id

---

### 10. ClassificationLabel

**Description**: A sensitivity/regulatory label that can be applied to assets or fields.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | N | NULL = system-defined |
| name | VARCHAR(255) | Y | e.g., "Aadhaar Number", "Email Address", "Credit Card" |
| category | ENUM | Y | pii, pfi, phi, sensitive, business, public, internal, confidential |
| sensitivity_level | INTEGER | Y | 1-5 (5 = most sensitive) |
| regulation_tags | JSONB | N | ["DPDP", "GDPR", "PCI-DSS"] |
| detection_patterns | JSONB | N | {regex: [], keywords: [], ner_labels: []} |
| description | TEXT | N | |
| is_system | BOOLEAN | Y | |

**Indexes**: tenant_id, category, sensitivity_level

---

### 11. Classification

**Description**: An applied classification on an asset field.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| asset_id | UUID | Y | FK → assets |
| asset_field_id | UUID | N | FK → asset_fields |
| label_id | UUID | Y | FK → classification_labels |
| confidence | DECIMAL(3,2) | Y | 0.00 - 1.00 |
| method | ENUM | Y | regex, dictionary, ml, manual |
| status | ENUM | Y | auto_applied, confirmed, overridden, rejected |
| scan_job_id | UUID | N | FK → scan_jobs |
| reviewed_by | UUID | N | FK → users |
| reviewed_at | TIMESTAMP | N | |

**Indexes**: tenant_id, asset_id, label_id, status, confidence

---

### 12. RiskFinding

**Description**: A security/privacy risk finding from DSPM or other assessment.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| source | ENUM | Y | dspm, dpia, tprm, compliance, manual |
| category | ENUM | Y | exposure, access, encryption, retention, configuration, compliance |
| severity | ENUM | Y | critical, high, medium, low, info |
| title | VARCHAR(500) | Y | |
| description | TEXT | Y | |
| asset_id | UUID | N | FK → assets |
| data_source_id | UUID | N | FK → data_sources |
| status | ENUM | Y | open, in_progress, mitigated, accepted, false_positive |
| risk_score | DECIMAL(5,2) | Y | 0-100 |
| remediation_guidance | TEXT | N | |
| evidence | JSONB | N | |
| assigned_to | UUID | N | FK → users |
| due_date | DATE | N | |
| resolved_at | TIMESTAMP | N | |
| scan_job_id | UUID | N | FK → scan_jobs |

**Indexes**: tenant_id, severity, status, category, asset_id, risk_score

---

### 13. DataSubject

**Description**: A data subject (individual whose data is processed).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| external_id | VARCHAR(500) | N | Customer-provided identifier |
| email_hash | VARCHAR(64) | N | SHA-256 of normalized email |
| identity_attributes | JSONB | Y | Encrypted: {email, phone, name, identifiers} |
| status | ENUM | Y | active, merged, anonymized |
| first_seen_at | TIMESTAMP | Y | |
| last_activity_at | TIMESTAMP | N | |
| jurisdiction | VARCHAR(50) | N | Inferred or declared |

**Indexes**: tenant_id, email_hash, external_id, status
**Note**: identity_attributes uses field-level encryption

---

### 14. ConsentRecord

**Description**: A consent grant or denial by a data subject.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| data_subject_id | UUID | Y | FK → data_subjects |
| notice_id | UUID | Y | FK → consent_notices |
| notice_version | INTEGER | Y | Version at time of consent |
| purpose_id | UUID | Y | FK → processing_purposes |
| status | ENUM | Y | granted, denied, revoked, expired |
| granted_at | TIMESTAMP | N | |
| revoked_at | TIMESTAMP | N | |
| expires_at | TIMESTAMP | N | |
| channel | VARCHAR(100) | Y | web, mobile, api, email, offline |
| ip_address | VARCHAR(45) | N | Encrypted |
| user_agent | TEXT | N | |
| proof | JSONB | N | Consent proof artifacts |
| lawful_basis | ENUM | Y | consent, contract, legal_obligation, vital_interest, public_task, legitimate_interest |

**Indexes**: tenant_id, data_subject_id, purpose_id, status
**Note**: This table is append-mostly (immutable consent ledger pattern). Status changes create new records.

---

### 15. ConsentNotice

**Description**: A consent notice/banner template.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| version | INTEGER | Y | Auto-incremented |
| status | ENUM | Y | draft, published, archived |
| content | JSONB | Y | Structured notice content |
| purposes | JSONB | Y | Array of purpose IDs and descriptions |
| published_at | TIMESTAMP | N | |

---

### 16. ProcessingPurpose

**Description**: A declared purpose for processing personal data.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| description | TEXT | N | |
| lawful_basis | ENUM | Y | consent, contract, legal_obligation, vital_interest, public_task, legitimate_interest |
| is_active | BOOLEAN | Y | |
| parent_purpose_id | UUID | N | For purpose hierarchy |

---

### 17. DSARRequest

**Description**: A data subject rights request.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| reference_number | VARCHAR(50) | Y | Human-readable, unique per tenant |
| data_subject_id | UUID | N | FK → data_subjects (linked after verification) |
| type | ENUM | Y | access, deletion, correction, portability, objection, restriction |
| status | ENUM | Y | submitted, identity_verification, in_progress, review, ready_to_send, completed, rejected, cancelled |
| channel | VARCHAR(100) | Y | portal, email, api, phone |
| submitted_at | TIMESTAMP | Y | |
| verified_at | TIMESTAMP | N | |
| due_date | TIMESTAMP | Y | Calculated from submission + SLA |
| completed_at | TIMESTAMP | N | |
| requestor_info | JSONB | Y | Encrypted: name, email, phone, relationship |
| identity_proof | JSONB | N | Reference to uploaded documents |
| notes | TEXT | N | Internal notes |
| assigned_to | UUID | N | FK → users |
| legal_hold | BOOLEAN | Y | Default false |
| rejection_reason | TEXT | N | |
| response_package_url | VARCHAR(2000) | N | Signed URL to response |

**Indexes**: tenant_id, reference_number (unique), status, type, due_date, data_subject_id

---

### 18. RetentionPolicy

**Description**: Data retention policy rules.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| description | TEXT | N | |
| record_category | VARCHAR(255) | Y | e.g., "customer_records", "employee_data" |
| retention_period_days | INTEGER | Y | |
| action_on_expiry | ENUM | Y | delete, archive, review, anonymize |
| legal_basis | TEXT | N | |
| applicable_regulations | JSONB | N | |
| status | ENUM | Y | active, draft, retired |
| applies_to | JSONB | N | Asset/data source filters |

---

### 19. PrivacyAssessment (DPIA/PIA)

**Description**: A privacy impact assessment.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| title | VARCHAR(500) | Y | |
| type | ENUM | Y | dpia, pia, tia, lia |
| status | ENUM | Y | draft, in_review, approved, rejected, archived |
| template_id | UUID | N | FK → assessment_templates |
| owner_id | UUID | Y | FK → users |
| reviewer_id | UUID | N | FK → users |
| processing_description | TEXT | Y | |
| data_categories | JSONB | Y | |
| risk_items | JSONB | Y | Array of {risk, likelihood, impact, score, mitigation, residual_risk} |
| overall_risk_score | DECIMAL(5,2) | N | |
| overall_risk_level | ENUM | N | low, medium, high, very_high |
| approved_at | TIMESTAMP | N | |
| approved_by | UUID | N | FK → users |
| next_review_date | DATE | N | |
| linked_ropa_id | UUID | N | FK → ropa_entries |
| evidence_ids | JSONB | N | Array of evidence artifact IDs |

---

### 20. Incident / BreachEvent

**Description**: A security incident that may involve personal data breach.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| reference_number | VARCHAR(50) | Y | |
| title | VARCHAR(500) | Y | |
| status | ENUM | Y | reported, triaging, confirmed_breach, contained, resolved, closed, false_alarm |
| severity | ENUM | Y | critical, high, medium, low |
| is_personal_data_breach | BOOLEAN | N | |
| detected_at | TIMESTAMP | Y | |
| reported_at | TIMESTAMP | Y | |
| contained_at | TIMESTAMP | N | |
| resolved_at | TIMESTAMP | N | |
| description | TEXT | Y | |
| affected_assets | JSONB | N | Array of asset IDs |
| affected_data_types | JSONB | N | Classification labels involved |
| estimated_subjects_affected | INTEGER | N | |
| root_cause | TEXT | N | |
| remediation_actions | JSONB | N | |
| regulatory_notifications | JSONB | N | [{authority, due_date, sent_at, reference}] |
| assigned_to | UUID | N | FK → users |
| forensic_evidence_ids | JSONB | N | |

---

### 21. Vendor

**Description**: A third-party vendor/processor.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(255) | Y | |
| type | ENUM | Y | processor, sub_processor, controller, joint_controller |
| risk_tier | ENUM | Y | critical, high, medium, low |
| status | ENUM | Y | active, under_review, approved, rejected, offboarded |
| country | VARCHAR(100) | N | |
| contact_email | VARCHAR(255) | N | |
| services_provided | TEXT | N | |
| data_shared | JSONB | N | Categories of data shared |
| dpa_status | ENUM | N | not_started, in_progress, signed, expired |
| dpa_document_id | UUID | N | FK → evidence_artifacts |
| contract_expiry | DATE | N | |
| last_assessment_date | DATE | N | |
| next_review_date | DATE | N | |
| risk_score | DECIMAL(5,2) | N | |

---

### 22. VendorAssessment

**Description**: A risk assessment questionnaire for a vendor.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| vendor_id | UUID | Y | FK → vendors |
| template_id | UUID | N | FK → assessment_templates |
| status | ENUM | Y | draft, sent, in_progress, submitted, reviewed, completed |
| sent_at | TIMESTAMP | N | |
| due_date | DATE | N | |
| submitted_at | TIMESTAMP | N | |
| reviewed_by | UUID | N | FK → users |
| responses | JSONB | N | |
| risk_score | DECIMAL(5,2) | N | |
| findings | JSONB | N | |
| remediation_items | JSONB | N | |

---

### 23. Regulation

**Description**: A regulation/standard (DPDP Act, GDPR, ISO 27701).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | N | NULL = system-provided |
| name | VARCHAR(255) | Y | |
| short_name | VARCHAR(50) | Y | e.g., "DPDP", "GDPR" |
| jurisdiction | VARCHAR(100) | Y | |
| version | VARCHAR(50) | N | |
| effective_date | DATE | N | |
| status | ENUM | Y | active, draft, superseded |
| description | TEXT | N | |

---

### 24. Obligation

**Description**: A specific obligation from a regulation.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| regulation_id | UUID | Y | FK → regulations |
| reference | VARCHAR(100) | Y | e.g., "Article 5(1)(a)" |
| title | VARCHAR(500) | Y | |
| description | TEXT | Y | |
| category | VARCHAR(100) | N | |

---

### 25. Control

**Description**: A privacy/security control that addresses obligations.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | N | NULL = system-provided |
| code | VARCHAR(50) | Y | e.g., "CTRL-DG-001" |
| title | VARCHAR(500) | Y | |
| description | TEXT | Y | |
| category | VARCHAR(100) | Y | |
| implementation_status | ENUM | N | not_started, in_progress, implemented, not_applicable |
| owner_id | UUID | N | FK → users |
| evidence_ids | JSONB | N | |

---

### 26. EvidenceArtifact

**Description**: A document or record serving as compliance evidence.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| name | VARCHAR(500) | Y | |
| type | ENUM | Y | document, screenshot, log, report, certificate, policy, auto_collected |
| file_path | VARCHAR(2000) | N | Object storage path |
| file_hash | VARCHAR(64) | N | SHA-256 for integrity |
| mime_type | VARCHAR(100) | N | |
| size_bytes | BIGINT | N | |
| linked_control_ids | JSONB | N | |
| linked_obligation_ids | JSONB | N | |
| collected_at | TIMESTAMP | Y | |
| expires_at | TIMESTAMP | N | |
| metadata | JSONB | N | |

---

### 27. RoPAEntry

**Description**: Record of Processing Activity entry.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| title | VARCHAR(500) | Y | |
| status | ENUM | Y | draft, active, under_review, archived |
| processing_purpose | TEXT | Y | |
| lawful_basis | ENUM | Y | |
| data_subject_categories | JSONB | Y | |
| personal_data_categories | JSONB | Y | |
| recipients | JSONB | N | |
| cross_border_transfers | JSONB | N | |
| retention_period | VARCHAR(255) | N | |
| security_measures | TEXT | N | |
| systems_involved | JSONB | N | Asset IDs |
| owner_id | UUID | Y | FK → users |
| approved_by | UUID | N | FK → users |
| approved_at | TIMESTAMP | N | |
| last_reviewed_at | TIMESTAMP | N | |
| next_review_date | DATE | N | |
| linked_dpia_id | UUID | N | FK → privacy_assessments |
| linked_consent_purposes | JSONB | N | |

---

### 28. Workflow

**Description**: A workflow instance (DSAR fulfillment, breach response, DPIA review, etc.).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| type | ENUM | Y | dsar, breach, dpia, retention_disposition, vendor_review, policy_approval |
| status | ENUM | Y | active, completed, cancelled, failed |
| entity_type | VARCHAR(100) | Y | The entity this workflow is for |
| entity_id | UUID | Y | FK to the entity |
| current_step | VARCHAR(100) | N | |
| temporal_workflow_id | VARCHAR(500) | N | Temporal execution ID |
| started_at | TIMESTAMP | Y | |
| completed_at | TIMESTAMP | N | |
| metadata | JSONB | N | |

---

### 29. AuditLog

**Description**: Immutable audit trail of all significant actions.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | |
| actor_id | UUID | N | FK → users (null for system actions) |
| actor_type | ENUM | Y | user, system, api_key, workflow |
| action | VARCHAR(100) | Y | e.g., "connector.created", "finding.status.changed" |
| entity_type | VARCHAR(100) | Y | |
| entity_id | UUID | Y | |
| changes | JSONB | N | {before: {}, after: {}} |
| ip_address | VARCHAR(45) | N | |
| user_agent | TEXT | N | |
| timestamp | TIMESTAMP | Y | |
| integrity_hash | VARCHAR(64) | Y | SHA-256 chain hash |

**Indexes**: tenant_id, actor_id, action, entity_type, entity_id, timestamp
**Note**: Append-only table. No UPDATE or DELETE. Integrity verified via hash chain.
**Storage**: Also replicated to OpenSearch for search/analytics.

---

### 30. AIRecommendation

**Description**: An AI-generated recommendation or suggestion.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| type | ENUM | Y | classification, control, remediation, summary, draft, mapping |
| entity_type | VARCHAR(100) | Y | |
| entity_id | UUID | Y | |
| recommendation | JSONB | Y | Structured recommendation |
| confidence | DECIMAL(3,2) | N | |
| model_id | VARCHAR(100) | Y | Which AI model generated this |
| prompt_hash | VARCHAR(64) | N | For reproducibility |
| status | ENUM | Y | pending, accepted, rejected, expired |
| reviewed_by | UUID | N | FK → users |
| reviewed_at | TIMESTAMP | N | |

---

### 31. CrossBorderTransfer

**Description**: A documented cross-border data transfer.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Y | PK |
| tenant_id | UUID | Y | FK |
| source_country | VARCHAR(100) | Y | |
| destination_country | VARCHAR(100) | Y | |
| transfer_mechanism | ENUM | Y | adequacy, sccs, bcrs, consent, derogation, dpdp_provision |
| data_categories | JSONB | Y | |
| recipient_name | VARCHAR(255) | Y | |
| recipient_type | ENUM | Y | processor, controller, joint_controller |
| status | ENUM | Y | active, under_review, suspended |
| safeguards | TEXT | N | |
| tia_assessment_id | UUID | N | FK → privacy_assessments |
| linked_ropa_id | UUID | N | FK → ropa_entries |

---

## ERD Summary (Key Relationships)

```
Tenant 1───∞ User
Tenant 1───∞ DataSource
Tenant 1───∞ Asset
Tenant 1───∞ DataSubject

User ∞───∞ Role (via UserRole)

DataSource 1───∞ Asset
DataSource 1───∞ ScanJob
DataSource 1───1 Credential

Asset 1───∞ AssetField
Asset 1───∞ Classification
Asset 1───∞ RiskFinding

AssetField 1───∞ Classification
Classification ∞───1 ClassificationLabel

DataSubject 1───∞ ConsentRecord
DataSubject 1───∞ DSARRequest

ConsentRecord ∞───1 ConsentNotice
ConsentRecord ∞───1 ProcessingPurpose

RoPAEntry ∞───1 PrivacyAssessment (optional)

Regulation 1───∞ Obligation
Obligation ∞───∞ Control (via obligation_controls)
Control ∞───∞ EvidenceArtifact (via control_evidence)

Vendor 1───∞ VendorAssessment

Incident 1───∞ Asset (via affected_assets JSONB)
```

## Database Choices

| Store | Use Case | Technology |
|-------|----------|------------|
| Primary OLTP | All entities above | PostgreSQL 15+ with RLS |
| Search & Analytics | Full-text search, log analytics, dashboards | OpenSearch 2.x |
| Cache & Sessions | Session cache, rate limiting, job queues | Redis 7+ |
| Object Storage | Files, evidence, scan artifacts, exports | S3-compatible (MinIO for self-hosted) |
| Graph (Phase 3) | Data lineage, relationship mapping | Neo4j or Apache AGE (PostgreSQL extension) |
| Document Store | Not needed separately — JSONB in PostgreSQL covers it |

## Indexing Strategy

- All `tenant_id` columns: B-tree index (partition key candidate for large tables)
- Status/enum columns: B-tree index
- Timestamp columns used in queries: B-tree index
- JSONB columns with query patterns: GIN index
- Full-text search columns: OpenSearch
- Large tables (audit_logs, classifications, consent_records): Consider table partitioning by tenant_id or date range
