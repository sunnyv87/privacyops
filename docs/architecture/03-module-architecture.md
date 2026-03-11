# Section 3 — Module Architecture

## Module 1: DSPM (Data Security Posture Management)

**Purpose**: Continuously discover, classify, and assess security posture of sensitive data across all environments.

**Business Outcomes**: Reduce data breach risk, eliminate shadow data, enforce least-privilege access to sensitive data, demonstrate data security compliance.

**Primary Users**: CISO, Security Analyst, SOC Analyst, Data Steward

**Core Features (MVP)**:
- Cloud connector framework (AWS, Azure, GCP)
- Database connectors (PostgreSQL, MySQL, SQL Server, MongoDB)
- Metadata discovery and content sampling
- Automated classification with built-in patterns
- Risk scoring per data store / dataset
- Access posture analysis (who has access to what sensitive data)
- Data exposure detection (public buckets, open databases)
- Interactive data map
- Findings dashboard with severity/trending

**Advanced Features (Phase 2-3)**:
- Data lineage tracking
- Toxic combination detection (PII + financial in same store)
- Stale/duplicate data detection
- Secrets discovery in code/configs
- Shadow data discovery
- Attack path analysis (data perspective)
- Encryption posture validation
- SaaS connector expansion (Salesforce, Slack, M365)

**Inputs**: Connector credentials, scan policies, classification rules
**Outputs**: Data map, findings, risk scores, remediation recommendations

**Dependencies**: Data Discovery, Data Classification, Asset Registry (shared)

**APIs Required**:
- `POST /api/v1/connectors` — register data source
- `POST /api/v1/scans` — launch scan job
- `GET /api/v1/findings` — list findings with filters
- `GET /api/v1/data-map` — get data map visualization data
- `GET /api/v1/risk-scores` — get risk scores by data store
- `PATCH /api/v1/findings/:id/status` — update finding status

**Events Produced**:
- `connector.created`, `connector.tested`, `connector.failed`
- `scan.started`, `scan.progress`, `scan.completed`, `scan.failed`
- `finding.created`, `finding.updated`, `finding.resolved`
- `risk.score.changed`

**Events Consumed**:
- `classification.completed` — update findings with labels
- `consent.revoked` — flag data stores with revoked consent data
- `retention.policy.violated` — create retention findings

**Storage**: PostgreSQL (findings, scores), OpenSearch (search/analytics), Object Storage (scan artifacts)

**Security**: Connector credentials encrypted with KMS, scan data never leaves tenant boundary, sampling data auto-purged after classification

**Audit Logging**: All connector CRUD, scan launches, finding status changes, risk score overrides

**AI Opportunities**: Natural language finding summaries, remediation suggestions, risk trend explanations, anomaly detection in access patterns

---

## Module 2: Data Discovery

**Purpose**: Find and catalog all data assets across connected sources.

**Business Outcomes**: Complete data inventory, eliminate unknown data stores, foundation for all privacy/security operations.

**Primary Users**: Data Steward, Security Analyst, DPO

**Core Features (MVP)**:
- Structured data discovery (databases, warehouses)
- Semi-structured discovery (JSON, XML, CSV in object storage)
- Table/collection/bucket/container enumeration
- Column/field profiling (types, cardinality, nullability, sample values)
- Schema extraction and versioning
- Asset registration and metadata enrichment

**Advanced Features (Phase 2-3)**:
- Unstructured discovery (documents, images via OCR)
- File share / endpoint discovery
- API endpoint discovery
- Code repository scanning
- Data lineage extraction
- Automated data owner suggestion

**Inputs**: Connected data sources, scan configuration
**Outputs**: Asset inventory, schema metadata, profiling statistics

**Dependencies**: Connector Framework (shared with DSPM)

**APIs**:
- `GET /api/v1/assets` — list discovered assets
- `GET /api/v1/assets/:id/schema` — get schema details
- `GET /api/v1/assets/:id/profile` — get profiling stats
- `POST /api/v1/discovery/jobs` — launch discovery job

**Events Produced**: `asset.discovered`, `asset.updated`, `asset.removed`, `schema.changed`
**Events Consumed**: `connector.created` — auto-discover on new connector

**Storage**: PostgreSQL (asset metadata), OpenSearch (search), Object Storage (schema snapshots)

---

## Module 3: Data Classification

**Purpose**: Automatically and manually classify data by sensitivity, regulatory category, and business context.

**Business Outcomes**: Know what sensitive data exists where, enable policy enforcement, support compliance reporting.

**Primary Users**: Data Steward, DPO, Security Analyst

**Core Features (MVP)**:
- Built-in classification taxonomy (PII, PFI, PHI, business-critical, public)
- India-specific patterns (Aadhaar, PAN, GSTIN, Indian mobile, Indian passport)
- Global patterns (SSN, credit card, IBAN, email, phone)
- Regex + dictionary-based detection
- Confidence scoring per classification
- Manual label override with audit trail
- Classification policy builder

**Advanced Features (Phase 2-3)**:
- ML-based classification (NER, custom models)
- Context-aware classification (column name + content + neighboring columns)
- Multi-language support (Hindi, regional languages)
- Classification inheritance rules
- Review queues for low-confidence classifications
- Custom label creation

**Inputs**: Discovered assets, classification policies, custom patterns
**Outputs**: Classification labels per column/field/object, confidence scores

**Dependencies**: Data Discovery

**APIs**:
- `GET /api/v1/classifications` — list classifications
- `POST /api/v1/classifications/policies` — create classification policy
- `PUT /api/v1/classifications/:id/override` — manual override
- `GET /api/v1/classifications/taxonomy` — get label taxonomy

**Events Produced**: `classification.completed`, `classification.label.assigned`, `classification.overridden`
**Events Consumed**: `asset.discovered`, `scan.completed`

---

## Module 4: Consent Management

**Purpose**: Capture, store, and operationalize data subject consent across channels.

**Business Outcomes**: Lawful basis compliance, consent audit trail, preference management, revocation handling.

**Primary Users**: DPO, Legal Counsel, Compliance Manager, Business Unit Owner

**Core Features (MVP)**:
- Consent notice designer (visual builder)
- Notice versioning with diff tracking
- Purpose and lawful basis mapping
- Consent capture API/SDK (web, mobile, API)
- Consent receipt generation (ISO 27560 aligned)
- Preference center (embeddable widget)
- Revocation management with downstream triggers
- Consent ledger (immutable audit trail)

**Advanced Features (Phase 2-3)**:
- Omni-channel consent (email, SMS, call center, offline)
- Consent analytics and conversion tracking
- A/B testing for consent notices
- Granular purpose hierarchy
- Consent validation service (check consent before processing)
- Cookie consent integration

**Inputs**: Notice templates, purpose definitions, data subject interactions
**Outputs**: Consent records, consent receipts, preference states, revocation events

**Dependencies**: Data Subject identity, Processing Purpose registry

**APIs**:
- `POST /api/v1/consent/notices` — create notice
- `POST /api/v1/consent/records` — record consent
- `GET /api/v1/consent/records?subject_id=X` — get consent status
- `POST /api/v1/consent/revoke` — revoke consent
- `GET /api/v1/consent/validate` — validate consent for purpose

**Events Produced**: `consent.granted`, `consent.revoked`, `consent.expired`, `notice.published`
**Events Consumed**: `dsar.deletion.requested` — check consent implications

---

## Module 5: Data Subject Rights Management (DSAR)

**Purpose**: Manage data subject access, deletion, correction, portability, and other rights requests end-to-end.

**Business Outcomes**: Regulatory compliance (DPDP Act, GDPR), SLA adherence, operational efficiency, audit evidence.

**Primary Users**: DPO, Compliance Manager, Legal Counsel, Data Steward

**Core Features (MVP)**:
- Public intake portal (branded, embeddable)
- Identity verification workflow (email, ID upload, knowledge-based)
- Request types: Access, Deletion, Correction, Portability, Objection, Restriction
- Auto-routing to data stewards by system/business unit
- Data collection from connected systems
- Review and redaction interface
- Response package generation (PDF, machine-readable)
- SLA tracking with escalation rules
- Legal hold exception handling
- Fulfillment evidence logging

**Advanced Features (Phase 2-3)**:
- Automated data collection via connectors
- AI-assisted redaction suggestions
- Batch request handling
- Agent/authorized representative support
- Multi-jurisdiction workflow routing
- Appeal handling

**Inputs**: Data subject requests, identity proof, collected data packages
**Outputs**: Response packages, fulfillment evidence, SLA reports

**Dependencies**: Data Discovery (to know where subject data exists), Connectors, Classification

**APIs**:
- `POST /api/v1/dsar/requests` — submit request
- `GET /api/v1/dsar/requests/:id` — get request detail
- `POST /api/v1/dsar/requests/:id/verify` — verify identity
- `POST /api/v1/dsar/requests/:id/collect` — trigger data collection
- `POST /api/v1/dsar/requests/:id/respond` — submit response
- `GET /api/v1/dsar/requests/:id/timeline` — get request timeline

**Events Produced**: `dsar.submitted`, `dsar.verified`, `dsar.collecting`, `dsar.ready_for_review`, `dsar.completed`, `dsar.overdue`
**Events Consumed**: `asset.discovered` — update data source mappings for collection

---

## Module 6: Privacy Risk Management / DPIA

**Purpose**: Assess privacy risks of processing activities, conduct DPIAs/PIAs, track mitigations.

**Business Outcomes**: Identify high-risk processing before it causes harm, demonstrate accountability, regulatory compliance.

**Primary Users**: DPO, Compliance Manager, Legal Counsel, Business Unit Owner

**Core Features (MVP)**:
- Assessment template library (DPIA, PIA, TIA, LIA)
- Configurable risk scoring (likelihood × impact matrix)
- Workflow engine (draft → review → approve → monitor)
- Residual risk tracking after controls applied
- Mitigation task assignment and tracking
- Evidence linkage (attach documents, screenshots, policies)
- Risk heatmap visualization
- DPDP Act screening questions (threshold assessment)

**Advanced Features (Phase 2-3)**:
- AI-assisted risk identification
- Auto-populate from RoPA/data map
- Risk aggregation across assessments
- Continuous risk monitoring (re-assess on data changes)
- Integration with GRC tools

**Inputs**: Processing activity details, data categories, systems, recipients, controls
**Outputs**: Risk scores, DPIA reports, mitigation plans, approval records

**Dependencies**: RoPA, Classification, Policy & Control Management

**APIs**:
- `POST /api/v1/assessments` — create assessment
- `GET /api/v1/assessments/:id` — get assessment detail
- `PUT /api/v1/assessments/:id/risks` — update risk items
- `POST /api/v1/assessments/:id/submit` — submit for review
- `POST /api/v1/assessments/:id/approve` — approve
- `GET /api/v1/assessments/dashboard` — risk dashboard data

**Events Produced**: `assessment.created`, `assessment.submitted`, `assessment.approved`, `risk.identified`, `risk.mitigated`
**Events Consumed**: `ropa.entry.created` — suggest DPIA if high-risk processing

---

## Module 7: Data Breach Monitoring & Incident Response

**Purpose**: Detect, assess, and respond to data breaches with regulatory notification workflows.

**Business Outcomes**: Faster breach response, regulatory compliance (72-hour GDPR, 6-hour CERT-In), reduced breach impact.

**Primary Users**: CISO, SOC Analyst, DPO, Legal Counsel

**Core Features (MVP)**:
- Incident intake (manual, API, webhook from SIEM)
- Breach qualification workflow (is it a personal data breach?)
- Impact estimation (data subjects affected, data types exposed)
- Correlation with DSPM findings (which classified data was in scope)
- Regulatory notification timeline tracker (DPDP Board, DPAs, CERT-In)
- Notification template generator
- SLA timers with escalation
- Post-incident action tracking
- Evidence collection and chain of custody

**Advanced Features (Phase 2-3)**:
- Automated breach detection from DSPM anomalies
- Data subject notification workflow
- Insurance claim preparation
- Cross-border breach impact analysis
- Forensic evidence handling with integrity verification

**Inputs**: Incident reports, DSPM findings, affected system details
**Outputs**: Breach assessments, notification packages, post-incident reports

**Dependencies**: DSPM, Classification, Data Discovery

**APIs**:
- `POST /api/v1/incidents` — create incident
- `POST /api/v1/incidents/:id/qualify` — qualify as breach
- `GET /api/v1/incidents/:id/impact` — get impact assessment
- `POST /api/v1/incidents/:id/notify` — trigger notification workflow
- `GET /api/v1/incidents/:id/timeline` — get incident timeline

**Events Produced**: `incident.created`, `breach.confirmed`, `notification.due`, `notification.sent`, `incident.closed`
**Events Consumed**: `finding.created` (high-severity) — auto-create incident

---

## Module 8: Data Governance & Retention

**Purpose**: Define and enforce data retention policies, manage legal holds, track deletion/archival.

**Business Outcomes**: Reduce data hoarding risk, comply with retention obligations, defensible deletion.

**Primary Users**: DPO, Compliance Manager, Legal Counsel, Data Steward

**Core Features (MVP)**:
- Retention schedule builder (by data category, purpose, jurisdiction)
- Policy engine (evaluate retention rules against discovered data)
- Record category mapping to data stores
- Legal hold management (preserve data despite retention expiry)
- Archive/delete workflow with approval
- Disposition approval and sign-off
- Proof of deletion tracking (certificates)
- Exception management with justification

**Advanced Features (Phase 2-3)**:
- Automated retention enforcement via connectors
- Retention conflict resolution (multiple regulations)
- Storage cost optimization insights
- Integration with backup/archive systems

**Inputs**: Retention policies, record categories, legal hold orders
**Outputs**: Retention compliance reports, deletion certificates, disposition logs

**Dependencies**: Data Discovery, Classification, Asset Registry

**APIs**:
- `POST /api/v1/retention/policies` — create policy
- `GET /api/v1/retention/compliance` — retention compliance status
- `POST /api/v1/retention/holds` — create legal hold
- `POST /api/v1/retention/dispositions` — request disposition
- `POST /api/v1/retention/dispositions/:id/approve` — approve deletion

**Events Produced**: `retention.policy.violated`, `retention.hold.created`, `retention.deletion.completed`
**Events Consumed**: `classification.completed` — evaluate retention policies

---

## Module 9: Third-Party Risk Management (TPRM)

**Purpose**: Assess and monitor privacy/security risks of vendors and third parties who process data.

**Business Outcomes**: Vendor due diligence, DPA compliance, supply chain risk reduction.

**Primary Users**: Vendor Risk Reviewer, DPO, Compliance Manager, Legal Counsel

**Core Features (MVP)**:
- Vendor register with risk tiering (critical, high, medium, low)
- Questionnaire engine (customizable templates)
- Control mapping (vendor controls → required controls)
- Evidence upload and review
- Remediation tracking
- Renewal/review cycle management
- DPA/contract artifact management
- Vendor risk dashboard

**Advanced Features (Phase 2-3)**:
- Automated vendor risk scoring
- Continuous vendor monitoring (breach feeds, news)
- Vendor compliance certification tracking
- Sub-processor management
- API-based questionnaire exchange

**Inputs**: Vendor details, questionnaire responses, evidence documents
**Outputs**: Risk assessments, remediation plans, vendor scorecards

**Dependencies**: Policy & Control Management

---

## Module 10: Compliance Automation

**Purpose**: Map regulations to obligations, controls, and evidence for continuous compliance monitoring.

**Business Outcomes**: Audit readiness, compliance gap identification, reduced manual compliance effort.

**Primary Users**: Compliance Manager, DPO, Auditor

**Core Features (MVP)**:
- Regulation library (DPDP Act, GDPR, ISO 27701 preloaded)
- Obligation extraction and mapping
- Control library (shared with Policy & Control Management)
- Evidence mapping (control → evidence artifact)
- Gap analysis dashboard
- Compliance scorecards per regulation
- Audit readiness view

**Advanced Features (Phase 2-3)**:
- Continuous control monitoring
- Automated evidence collection
- Custom regulation import
- Cross-regulation control deduplication
- Compliance trend reporting

**Inputs**: Regulations, controls, evidence artifacts
**Outputs**: Compliance scores, gap reports, audit packages

**Dependencies**: Policy & Control Management, Evidence Repository

---

## Module 11: AI Compliance Engine

**Purpose**: Inventory, assess, and govern AI systems used within the organization.

**Business Outcomes**: AI governance readiness, responsible AI practices, regulatory preparation.

**Primary Users**: CISO, DPO, Compliance Manager, Data Steward

**Core Features (MVP - Phase 2)**:
- AI system inventory (models, use cases, data inputs, outputs)
- Model risk register
- AI use-case review workflow (approve/deny/conditional)
- Training data declaration and lineage
- AI control library
- AI policy management

**Advanced Features (Phase 3)**:
- Prompt/data usage governance
- Bias assessment templates
- Explainability documentation
- Automated AI policy checks
- Integration with MLOps platforms

**Inputs**: AI system registrations, risk assessments, policies
**Outputs**: AI inventory, risk scores, approval records

**Dependencies**: Policy & Control Management, Risk Management

---

## Module 12: Policy & Control Management

**Purpose**: Central library of privacy/security policies and controls linked to regulations.

**Primary Users**: Compliance Manager, DPO, CISO

**Core Features (MVP)**:
- Policy lifecycle (draft → review → approve → publish → retire)
- Control library with categorization
- Policy-to-control mapping
- Control-to-evidence mapping
- Policy acknowledgment tracking
- Version history

**Dependencies**: None (foundational module)

---

## Module 13: RoPA (Record of Processing Activities)

**Purpose**: Maintain Article 30 GDPR / DPDP Act compliant processing activity register.

**Primary Users**: DPO, Compliance Manager, Business Unit Owner

**Core Features (MVP)**:
- Processing activity inventory
- Categories of data subjects and personal data
- Processing purposes and lawful bases
- Recipients and transfers
- Retention periods
- Technical/organizational security measures
- Data flow diagrams (auto-generated from data map)
- Ownership and approval workflow
- Export (PDF, CSV)

**Dependencies**: Data Discovery, Classification, Consent Management

---

## Module 14: Cross-border Data Transfer Governance

**Purpose**: Manage and document cross-border personal data transfers with appropriate safeguards.

**Primary Users**: DPO, Legal Counsel, Compliance Manager

**Core Features (Phase 2)**:
- Transfer inventory
- Transfer mechanism selection (adequacy, SCCs, BCRs, consent, DPDP Act provisions)
- Transfer impact assessment (TIA)
- Safeguard documentation
- Transfer map visualization

**Dependencies**: RoPA, Data Discovery, DPIA

---

## Module 15: Privacy-by-Design Workflow

**Purpose**: Embed privacy considerations into project/product development lifecycle.

**Primary Users**: DPO, Business Unit Owner, Compliance Manager

**Core Features (Phase 2)**:
- PbD checklist templates
- Project intake form with privacy screening
- Integration with DPIA (trigger DPIA if needed)
- Design review workflow
- Privacy requirements tracking

**Dependencies**: DPIA, Policy & Control Management

---

## Module 16: Incident & Regulatory Response Workflow

**Purpose**: Orchestrate response to regulatory inquiries, audits, and enforcement actions.

**Primary Users**: DPO, Legal Counsel, Compliance Manager

**Core Features (Phase 2)**:
- Regulatory inquiry tracker
- Response workflow with deadlines
- Document request management
- Response package assembly
- Historical inquiry archive

**Dependencies**: Evidence Repository, Compliance Automation

---

## Module 17: Privacy Intelligence Dashboard

**Purpose**: Executive and operational dashboards across all modules.

**Primary Users**: All roles (role-specific views)

**Core Features (MVP)**:
- Executive summary (overall privacy health score)
- CISO view (data risk, exposure, DSPM metrics)
- DPO view (DSAR SLAs, consent stats, breach status, compliance scores)
- Operational view (pending tasks, overdue items, trends)
- Drill-down to module-specific dashboards
- Export and scheduling

**Dependencies**: All modules (aggregation layer)

---

## Module 18: Evidence Repository & Audit Readiness

**Purpose**: Centralized store for compliance evidence with integrity verification.

**Primary Users**: Compliance Manager, Auditor, DPO

**Core Features (MVP)**:
- Evidence upload with metadata tagging
- Auto-collected evidence from platform operations
- Evidence-to-control-to-regulation linkage
- Integrity verification (hash-based)
- Audit package generation
- Evidence expiry and refresh tracking
- Auditor access portal (read-only scoped access)

**Dependencies**: All modules (evidence source)

---

## Module Dependency Graph

```
[Asset Registry] ← [Data Discovery] ← [Connectors]
       ↓                  ↓
[Data Classification]  [Schema Catalog]
       ↓
[DSPM Risk Engine] → [Privacy Intelligence Dashboard]
       ↓
[Risk Findings] → [Breach Monitoring]
                → [Compliance Automation] ← [Policy & Control Mgmt]
                → [DSAR] ← [Consent Management]
                → [Retention] ← [RoPA]
                → [DPIA]
                → [TPRM]
                → [Evidence Repository]
```
