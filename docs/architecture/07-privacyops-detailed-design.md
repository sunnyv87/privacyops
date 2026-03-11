# Section 7 — PrivacyOps Module-by-Module Detailed Design

## Module 1: Consent Management

### User Stories
- As a DPO, I want to create consent notices with multiple purposes so that data subjects can make granular choices
- As a developer, I want an API to record consent programmatically so that our apps can capture consent at point of collection
- As a compliance manager, I want to see consent rates and revocation trends so that I can report to management
- As a data subject, I want to manage my preferences through a self-service portal

### Functional Requirements
1. **Notice Designer**: Visual WYSIWYG editor for consent notices. Supports multiple languages, versioning with diff view, purpose grouping, mandatory vs optional purposes
2. **Consent Capture**: REST API + JavaScript SDK + React widget for capturing consent. Supports web, mobile, server-side collection
3. **Consent Ledger**: Immutable append-only log of all consent events (grant, deny, revoke, expire). Each record includes proof (timestamp, IP, user agent, notice version)
4. **Preference Center**: Embeddable widget showing current consent state per purpose with toggle controls
5. **Revocation**: When consent is revoked, emit `consent.revoked` event. Downstream modules react (e.g., flag data for deletion)
6. **Consent Validation API**: Real-time check: "Does subject X have active consent for purpose Y?"

### Non-Functional Requirements
- Consent validation API: <50ms p99 latency (Redis-cached)
- Consent ledger: Append-only, tamper-evident
- SDK bundle size: <10KB gzipped
- Support 10M+ consent records per tenant

### APIs
```
POST   /api/v1/consent/notices              # Create notice
GET    /api/v1/consent/notices              # List notices
GET    /api/v1/consent/notices/:id          # Get notice detail
PUT    /api/v1/consent/notices/:id          # Update notice
POST   /api/v1/consent/notices/:id/publish  # Publish notice version

POST   /api/v1/consent/records              # Record consent (public API)
GET    /api/v1/consent/records              # List consent records
GET    /api/v1/consent/records/:subjectId   # Get subject's consent state

POST   /api/v1/consent/revoke              # Revoke consent
GET    /api/v1/consent/validate             # Validate consent for purpose

GET    /api/v1/consent/purposes             # List purposes
POST   /api/v1/consent/purposes             # Create purpose

GET    /api/v1/consent/analytics            # Consent analytics
```

### Sample Payloads
```json
// POST /api/v1/consent/records
{
  "subject_id": "ext-customer-12345",
  "subject_email": "user@example.com",
  "notice_id": "uuid-notice-1",
  "purposes": [
    { "purpose_id": "uuid-marketing", "granted": true },
    { "purpose_id": "uuid-analytics", "granted": false }
  ],
  "channel": "web",
  "metadata": {
    "page_url": "https://example.com/signup",
    "sdk_version": "1.0.0"
  }
}

// GET /api/v1/consent/validate?subject_id=ext-customer-12345&purpose_id=uuid-marketing
// Response:
{
  "valid": true,
  "consent_record_id": "uuid-record-1",
  "granted_at": "2025-01-15T10:30:00Z",
  "notice_version": 3,
  "expires_at": null
}
```

### Database Tables
- `consent_notices` (see data model)
- `consent_records` (see data model)
- `processing_purposes` (see data model)
- `consent_notice_versions` — version history with content snapshots

### UI Screens
1. **Notice List** — Table of notices with status, version, last published
2. **Notice Designer** — WYSIWYG editor with purpose configuration, preview
3. **Consent Records** — Searchable table with subject, purpose, status, date filters
4. **Consent Analytics** — Charts: consent rate, revocation rate, purpose breakdown, trends
5. **Preference Center Config** — Configure embeddable preference center widget
6. **Purpose Management** — CRUD for processing purposes with lawful basis

### Permissions Matrix
| Action | Super Admin | Tenant Admin | DPO | Compliance Mgr | Developer |
|--------|------------|-------------|-----|----------------|-----------|
| Create notice | ✓ | ✓ | ✓ | ✓ | |
| Publish notice | ✓ | ✓ | ✓ | | |
| View records | ✓ | ✓ | ✓ | ✓ | |
| Record consent (API) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Revoke consent | ✓ | ✓ | ✓ | | |
| View analytics | ✓ | ✓ | ✓ | ✓ | |

---

## Module 2: Data Discovery

(Covered in DSPM detail — shared scanning pipeline. Key additions for standalone use:)

### Additional Features
- **Data Catalog View**: Searchable catalog of all discovered assets with metadata
- **Data Steward Assignment**: Assign owners to assets
- **Tag Management**: Custom tags for business context
- **Schema Change Detection**: Alert when table schema changes between scans
- **Data Profiling Dashboard**: Column-level statistics, data quality indicators

### UI Screens
1. **Data Catalog** — Searchable list/grid of all assets with filters (type, source, classification, owner)
2. **Asset Detail** — Schema, classifications, profiling stats, scan history, risk findings
3. **Data Map** — Interactive graph visualization
4. **Scan Jobs** — List of scan executions with status, stats, errors
5. **Data Steward Dashboard** — Assets assigned to current user, pending reviews

---

## Module 3: Data Classification

### Additional Details Beyond DSPM Classification

### User Stories
- As a data steward, I want to review auto-classifications and confirm or override them
- As a DPO, I want to define custom classification labels specific to our business
- As a compliance manager, I want to see classification coverage across all data sources

### UI Screens
1. **Classification Dashboard** — Coverage stats, label distribution, confidence breakdown
2. **Review Queue** — Low-confidence classifications pending human review
3. **Label Taxonomy Manager** — Create/edit custom labels, sensitivity levels
4. **Classification Policy Builder** — Define rules: "If column name matches X and values match Y, apply label Z"
5. **Classification Report** — Exportable report of all classifications by source/type/label

---

## Module 4: Privacy Risk Management / DPIA

### User Stories
- As a DPO, I want to conduct a DPIA using a structured template that covers DPDP Act requirements
- As a business owner, I want to submit a processing activity for privacy review
- As a compliance manager, I want a heatmap of privacy risks across the organization

### Functional Requirements
1. **Template Library**: Pre-built templates for DPIA (GDPR Article 35), PIA, TIA, LIA. Customizable by tenant
2. **Threshold Assessment**: Screening questionnaire to determine if full DPIA is needed (DPDP Act alignment)
3. **Risk Scoring**: Configurable likelihood × impact matrix (3×3, 4×4, or 5×5)
4. **Workflow**: Draft → Submit → Review → Approve/Reject → Monitor
5. **Mitigation Tracking**: Each risk item can have mitigation actions, owners, deadlines
6. **Evidence Linkage**: Attach policies, controls, screenshots as evidence
7. **Auto-populate**: Pull data categories and systems from RoPA/Data Map

### APIs
```
POST   /api/v1/assessments                     # Create assessment
GET    /api/v1/assessments                     # List assessments
GET    /api/v1/assessments/:id                 # Get detail
PUT    /api/v1/assessments/:id                 # Update
POST   /api/v1/assessments/:id/submit          # Submit for review
POST   /api/v1/assessments/:id/approve         # Approve
POST   /api/v1/assessments/:id/reject          # Reject with reason
GET    /api/v1/assessments/:id/risks           # Get risk items
POST   /api/v1/assessments/:id/risks           # Add risk item
PUT    /api/v1/assessments/:id/risks/:riskId   # Update risk item
GET    /api/v1/assessments/templates            # List templates
GET    /api/v1/assessments/dashboard            # Risk dashboard data
```

### Sample Payload
```json
// POST /api/v1/assessments
{
  "title": "Customer Analytics Platform DPIA",
  "type": "dpia",
  "template_id": "uuid-dpia-template",
  "processing_description": "Collection and analysis of customer behavior data for personalization",
  "data_categories": ["browsing_history", "purchase_history", "email", "name"],
  "data_subject_categories": ["customers", "website_visitors"],
  "systems_involved": ["asset-uuid-1", "asset-uuid-2"],
  "linked_ropa_id": "uuid-ropa-entry"
}
```

### Risk Scoring
```json
// Risk item structure
{
  "id": "uuid",
  "description": "Customer data accessible by unauthorized marketing staff",
  "risk_category": "unauthorized_access",
  "likelihood": 3,        // 1-5
  "impact": 4,            // 1-5
  "inherent_risk_score": 12,  // likelihood × impact
  "inherent_risk_level": "high",
  "mitigation": "Implement RBAC with quarterly access reviews",
  "mitigation_owner": "uuid-user",
  "mitigation_deadline": "2025-06-30",
  "mitigation_status": "in_progress",
  "residual_likelihood": 2,
  "residual_impact": 4,
  "residual_risk_score": 8,
  "residual_risk_level": "medium"
}
```

### UI Screens
1. **Assessment List** — Table with status, type, risk level, owner, due date
2. **Assessment Form** — Multi-step form with sections: Overview, Data Inventory, Risk Identification, Mitigation, Review
3. **Risk Heatmap** — Interactive matrix showing risk distribution
4. **Mitigation Tracker** — Kanban or table view of mitigation actions
5. **Assessment Dashboard** — Stats: total, by status, by risk level, overdue

---

## Module 5: AI Compliance Engine (Phase 2)

### User Stories
- As a CISO, I want an inventory of all AI systems used in my organization
- As a DPO, I want to review and approve AI use cases before deployment
- As a compliance manager, I want to track AI-related controls and policies

### Functional Requirements
1. **AI System Registry**: Catalog of AI/ML systems with: purpose, model type, data inputs, data outputs, vendor, deployment status
2. **Model Risk Register**: Risk assessment per AI system (bias, accuracy, privacy, security)
3. **Use Case Review Workflow**: Submit → Privacy Review → Ethics Review → Approve/Deny
4. **Training Data Declaration**: Document what data was used for training, consent basis
5. **AI Control Library**: Controls specific to AI governance
6. **AI Policy Management**: Acceptable use policies for AI tools (e.g., ChatGPT, Copilot)

### APIs
```
POST   /api/v1/ai-systems              # Register AI system
GET    /api/v1/ai-systems              # List AI systems
GET    /api/v1/ai-systems/:id          # Get detail
PUT    /api/v1/ai-systems/:id          # Update
POST   /api/v1/ai-systems/:id/review   # Submit for review
GET    /api/v1/ai-policies             # List AI policies
POST   /api/v1/ai-policies             # Create AI policy
```

---

## Module 6: Data Breach Monitoring

### User Stories
- As a SOC analyst, I want to report a potential data breach quickly with structured data collection
- As a DPO, I want to assess whether a breach requires regulatory notification within mandated timelines
- As legal counsel, I want to generate regulatory notification documents

### Functional Requirements
1. **Incident Intake**: Form or API for reporting potential breaches. Fields: what happened, when, what data, what systems, who's affected
2. **Breach Qualification**: Structured assessment: Is personal data involved? What categories? How many subjects?
3. **Impact Estimation**: Based on DSPM data, estimate: data types exposed, volume, subjects affected
4. **Regulatory Timeline Tracker**:
   - DPDP Act: Notify Data Protection Board "without delay" (ASSUMPTION: specific timeline to be defined in rules)
   - GDPR: 72 hours to DPA
   - CERT-In: 6 hours for cyber incidents
5. **Notification Generator**: Template-based notification document generation
6. **SLA Timers**: Visual countdown timers with escalation rules
7. **Post-Incident**: Root cause, remediation actions, lessons learned

### Workflow (Temporal)
```
incident.reported → triage → qualify_as_breach?
  → YES → assess_impact → determine_notifications
    → prepare_notifications → send_notifications → post_incident_review → close
  → NO → document_as_non_breach → close
```

### APIs
```
POST   /api/v1/incidents                       # Report incident
GET    /api/v1/incidents                       # List incidents
GET    /api/v1/incidents/:id                   # Get detail
PUT    /api/v1/incidents/:id                   # Update
POST   /api/v1/incidents/:id/qualify           # Qualify as breach
POST   /api/v1/incidents/:id/assess-impact     # Run impact assessment
POST   /api/v1/incidents/:id/notifications     # Create notification
GET    /api/v1/incidents/:id/timeline          # Get timeline
POST   /api/v1/incidents/:id/close             # Close incident
GET    /api/v1/incidents/dashboard             # Dashboard data
```

### Sample Payload
```json
// POST /api/v1/incidents
{
  "title": "Unauthorized access to customer database",
  "severity": "high",
  "detected_at": "2025-03-10T14:30:00Z",
  "description": "Anomalous query patterns detected on customer DB. Potential data exfiltration.",
  "affected_systems": ["data-source-uuid-1"],
  "reported_by": "user-uuid",
  "initial_assessment": {
    "personal_data_involved": true,
    "data_types": ["email", "name", "phone", "purchase_history"],
    "estimated_records": 50000
  }
}
```

### UI Screens
1. **Incident List** — Table with severity, status, timeline indicators
2. **Incident Detail** — Comprehensive view: timeline, impact assessment, notifications, actions
3. **Breach Assessment Form** — Step-by-step qualification and impact assessment
4. **Notification Tracker** — Regulatory notification status with countdown timers
5. **Incident Dashboard** — Open incidents, average response time, breach history

---

## Module 7: Data Subject Rights Management (DSAR)

### User Stories
- As a data subject, I want to submit a request to access my personal data through a simple portal
- As a DPO, I want to track all DSARs and ensure SLA compliance
- As a data steward, I want to collect and review data from my systems for a DSAR response

### Functional Requirements
1. **Intake Portal**: Public-facing, branded form. Supports: access, deletion, correction, portability, objection, restriction
2. **Identity Verification**: Multi-step: email verification → optional ID upload → knowledge-based questions
3. **Auto-routing**: Based on request type and data sources, route tasks to relevant data stewards
4. **Data Collection**: Manual (data steward uploads) or automated (via connectors in Phase 2)
5. **Review & Redaction**: Interface to review collected data, redact third-party information
6. **Response Package**: Generate PDF/ZIP response package with cover letter
7. **SLA Management**:
   - DPDP Act: Response within period specified by Data Protection Board (ASSUMPTION: 30 days)
   - GDPR: 30 days, extendable to 90 days
8. **Legal Hold**: Flag to prevent deletion if data is under legal hold
9. **Appeal Handling**: Data subject can appeal rejection

### Workflow (Temporal)
```
request.submitted → verify_identity → route_to_stewards
  → collect_data (parallel per system) → aggregate_data
  → review_and_redact → approve_response → deliver_response → close
```

### APIs
```
POST   /api/v1/dsar/requests                    # Submit request (public)
GET    /api/v1/dsar/requests                    # List requests
GET    /api/v1/dsar/requests/:id                # Get detail
POST   /api/v1/dsar/requests/:id/verify         # Submit verification
POST   /api/v1/dsar/requests/:id/assign         # Assign to steward
POST   /api/v1/dsar/requests/:id/collect        # Submit collected data
POST   /api/v1/dsar/requests/:id/review         # Submit review
POST   /api/v1/dsar/requests/:id/approve        # Approve response
POST   /api/v1/dsar/requests/:id/reject         # Reject with reason
POST   /api/v1/dsar/requests/:id/deliver        # Deliver response
GET    /api/v1/dsar/requests/:id/timeline       # Get request timeline
GET    /api/v1/dsar/dashboard                   # Dashboard
```

### Sample Payload
```json
// POST /api/v1/dsar/requests (public endpoint)
{
  "type": "access",
  "requestor": {
    "name": "Priya Sharma",
    "email": "priya.sharma@example.com",
    "phone": "+91-9876543210",
    "relationship": "self"
  },
  "details": "I would like to receive a copy of all personal data you hold about me.",
  "preferred_response_format": "pdf"
}

// Response
{
  "id": "uuid",
  "reference_number": "DSAR-2025-00042",
  "status": "submitted",
  "submitted_at": "2025-03-10T10:00:00Z",
  "due_date": "2025-04-09T10:00:00Z",
  "verification_required": true,
  "verification_method": "email"
}
```

### UI Screens
1. **Public Intake Portal** — Branded request form (separate Next.js route, no auth)
2. **Request List** — Table with ref#, type, status, SLA indicator, assignee
3. **Request Detail** — Full timeline, data collection status per system, review interface
4. **Data Review** — Side-by-side view of collected data with redaction tools
5. **DSAR Dashboard** — Open/closed counts, SLA compliance %, average completion time, by type

---

## Module 8: Data Governance & Retention

### Functional Requirements
1. **Retention Schedule Builder**: Define retention periods by record category, purpose, jurisdiction
2. **Policy Engine**: Evaluate retention policies against discovered assets. Flag: expired data not deleted, no policy applied
3. **Legal Hold**: Create holds that override retention policies. Track hold reason, authority, scope
4. **Disposition Workflow**: When data reaches retention limit: notify steward → review → approve → execute (delete/archive/anonymize) → generate certificate
5. **Proof of Deletion**: Certificate with: what was deleted, when, by whom, from which systems, verification hash

### APIs
```
POST   /api/v1/retention/policies              # Create policy
GET    /api/v1/retention/policies              # List policies
PUT    /api/v1/retention/policies/:id          # Update policy
GET    /api/v1/retention/compliance            # Compliance status
POST   /api/v1/retention/holds                 # Create legal hold
DELETE /api/v1/retention/holds/:id             # Release hold
GET    /api/v1/retention/dispositions          # List pending dispositions
POST   /api/v1/retention/dispositions/:id/approve   # Approve disposition
POST   /api/v1/retention/dispositions/:id/execute   # Execute deletion
GET    /api/v1/retention/certificates          # List deletion certificates
```

### UI Screens
1. **Retention Schedule** — Table of policies with categories, periods, actions
2. **Compliance Dashboard** — Assets with/without policies, overdue dispositions, policy violations
3. **Legal Holds** — Active holds with scope and reason
4. **Disposition Queue** — Pending approvals for data disposal
5. **Deletion Certificates** — Audit trail of completed deletions

---

## Module 9: Third-Party Risk Management

### Functional Requirements
1. **Vendor Register**: Central catalog with risk tiering, status tracking
2. **Questionnaire Engine**: Template-based questionnaires (security, privacy, AI). Send via email or portal
3. **Risk Scoring**: Auto-score based on responses + manual adjustment
4. **Remediation**: Track remediation items per vendor
5. **DPA Management**: Track DPA status, store signed agreements
6. **Review Cycles**: Automated reminders for periodic vendor reviews

### APIs
```
POST   /api/v1/vendors                          # Create vendor
GET    /api/v1/vendors                          # List vendors
GET    /api/v1/vendors/:id                      # Get detail
PUT    /api/v1/vendors/:id                      # Update
POST   /api/v1/vendors/:id/assessments          # Create assessment
GET    /api/v1/vendors/:id/assessments          # List assessments
PUT    /api/v1/vendor-assessments/:id           # Update assessment
POST   /api/v1/vendor-assessments/:id/send      # Send questionnaire
POST   /api/v1/vendor-assessments/:id/submit    # Submit responses (vendor portal)
GET    /api/v1/vendors/dashboard                # Dashboard
```

### UI Screens
1. **Vendor List** — Table with risk tier, status, DPA status, last assessment
2. **Vendor Detail** — Profile, assessment history, remediation items, contracts
3. **Assessment Form** — Questionnaire with sections, evidence upload
4. **Vendor Portal** — External portal for vendors to complete assessments (separate auth)
5. **TPRM Dashboard** — Risk distribution, assessment pipeline, overdue reviews

---

## Module 10: Compliance Automation

### Functional Requirements
1. **Regulation Library**: Pre-loaded DPDP Act, GDPR, ISO 27701 with obligations extracted
2. **Control Library**: Shared controls mapped to obligations
3. **Evidence Mapping**: Link evidence artifacts to controls
4. **Gap Analysis**: Compare implemented controls vs required controls per regulation
5. **Compliance Scorecard**: Per-regulation compliance percentage with drill-down
6. **Audit Package**: Export compliance status with evidence for auditors

### APIs
```
GET    /api/v1/regulations                      # List regulations
GET    /api/v1/regulations/:id/obligations      # List obligations
GET    /api/v1/controls                         # List controls
POST   /api/v1/controls                         # Create control
PUT    /api/v1/controls/:id                     # Update control
POST   /api/v1/controls/:id/evidence            # Link evidence
GET    /api/v1/compliance/gaps                   # Gap analysis
GET    /api/v1/compliance/scorecard              # Compliance scorecard
POST   /api/v1/compliance/audit-package          # Generate audit package
```

### UI Screens
1. **Regulation Browser** — Tree view of regulations → obligations → controls
2. **Control Library** — Searchable controls with implementation status
3. **Gap Analysis** — Matrix showing controls vs obligations with gaps highlighted
4. **Compliance Dashboard** — Scorecards per regulation, trend charts
5. **Audit Package Builder** — Select scope, generate exportable package

---

## Module 11: Privacy Intelligence Dashboard

### Dashboard Layouts by Role

**Executive Dashboard (CISO/CIO)**:
- Overall privacy health score (0-100)
- Risk findings summary (critical/high/medium/low)
- Data exposure trend (30/60/90 days)
- Compliance scorecard summary
- Active incidents count
- DSAR SLA compliance %

**DPO Dashboard**:
- DSAR pipeline (submitted/in-progress/overdue/completed)
- Consent statistics (active/revoked/expired)
- DPIA status summary
- Breach notification deadlines
- RoPA coverage
- Retention compliance

**Operational Dashboard**:
- My tasks / assigned items
- Pending approvals
- Overdue items
- Recent findings
- Scan status

---

## Module 12: RoPA (Record of Processing Activities)

### Functional Requirements
1. **Processing Inventory**: CRUD for processing activities
2. **Structured Data**: Standardized fields per GDPR Art 30 / DPDP Act
3. **Auto-populate**: Suggest data categories and systems from Data Map
4. **Approval Workflow**: Draft → Review → Approve → Active
5. **Export**: PDF and CSV export for regulators

### APIs
```
POST   /api/v1/ropa                            # Create entry
GET    /api/v1/ropa                            # List entries
GET    /api/v1/ropa/:id                        # Get detail
PUT    /api/v1/ropa/:id                        # Update
POST   /api/v1/ropa/:id/submit                 # Submit for review
POST   /api/v1/ropa/:id/approve                # Approve
GET    /api/v1/ropa/export                     # Export all entries
```

### Sample Payload
```json
// POST /api/v1/ropa
{
  "title": "Customer Order Processing",
  "processing_purpose": "Processing customer orders and delivering products/services",
  "lawful_basis": "contract",
  "data_subject_categories": ["customers"],
  "personal_data_categories": ["name", "email", "phone", "address", "payment_info", "order_history"],
  "recipients": [
    { "name": "Payment Gateway (Razorpay)", "type": "processor", "country": "India" },
    { "name": "Shipping Partner (Delhivery)", "type": "processor", "country": "India" }
  ],
  "cross_border_transfers": [],
  "retention_period": "7 years after last order (tax compliance)",
  "security_measures": "Encrypted at rest, TLS in transit, RBAC, quarterly access reviews",
  "systems_involved": ["asset-uuid-crm", "asset-uuid-payments-db"],
  "owner_id": "user-uuid-business-owner"
}
```

### UI Screens
1. **RoPA List** — Table of processing activities with status, owner, last reviewed
2. **RoPA Entry Form** — Multi-section form matching GDPR Art 30 structure
3. **RoPA Dashboard** — Coverage stats, review status, data flow summary
4. **RoPA Export** — Generate formatted PDF/CSV for regulator submission
