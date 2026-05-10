# TechD PrivacyOps User Guide

A comprehensive guide to using TechD PrivacyOps for privacy operations, data security posture management, and regulatory compliance.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Data Security Posture Management (DSPM)](#data-security-posture-management-dspm)
4. [Data Discovery & Connectors](#data-discovery--connectors)
5. [Data Classification](#data-classification)
6. [Data Lineage](#data-lineage)
7. [Data Graph](#data-graph)
8. [Compliance Management](#compliance-management)
9. [Records of Processing Activities (ROPA)](#records-of-processing-activities-ropa)
10. [Consent Management](#consent-management)
11. [Data Subject Access Requests (DSAR)](#data-subject-access-requests-dsar)
12. [Breach & Incident Management](#breach--incident-management)
13. [Risk Assessments](#risk-assessments)
14. [Data Retention](#data-retention)
15. [Vendor Management](#vendor-management)
16. [AI Governance](#ai-governance)
17. [AI Co-Pilot](#ai-co-pilot)
18. [Advanced Security Features](#advanced-security-features)
19. [User & Role Management](#user--role-management)
20. [Account Security](#account-security)
21. [SCIM Provisioning](#scim-provisioning)
22. [API Usage](#api-usage)

---

## Getting Started

### Logging In

1. Navigate to the PrivacyOps web application (default: http://localhost:3000)
2. Enter your email address and password
3. If MFA is enabled, enter your TOTP code from your authenticator app
4. You will be redirected to the dashboard

### First-Time Setup

After logging in as a Tenant Admin:

1. **Configure your tenant** — Set your organization name, domain, and data residency region in Settings
2. **Connect data sources** — Add your databases and storage systems via the Connectors module
3. **Run a discovery scan** — Discover and catalog data assets in your connected sources
4. **Review classifications** — Review and approve auto-classified data labels
5. **Map regulations** — Select which regulations apply to your organization
6. **Set up notifications** — Configure email and webhook notifications for alerts

### Navigation

The web application uses a sidebar navigation with the following sections:

| Section | Description |
|---------|-------------|
| Dashboard | Overview metrics, compliance scores, recent activity |
| DSPM | Security posture findings and scores |
| Discovery | Data asset inventory and scanning |
| Classification | Data classification labels and reviews |
| Compliance | Regulation mapping and gap analysis |
| ROPA | Records of Processing Activities |
| Consent | Consent management and tracking |
| DSAR | Data Subject Access Requests |
| Breach | Incident and breach management |
| Risk | Privacy impact assessments |
| Retention | Data retention policies |
| Vendors | Third-party vendor management |
| Settings | Tenant, user, and system configuration |

---

## Dashboard

The dashboard provides an at-a-glance view of your privacy posture:

- **Compliance Score** — Overall compliance percentage across all mapped regulations
- **Open Findings** — Number of unresolved DSPM findings by severity
- **Active DSARs** — Pending data subject requests and SLA status
- **Recent Incidents** — Latest breach notifications and their status
- **Data Asset Summary** — Total discovered assets, classified vs. unclassified
- **Risk Heatmap** — Risk distribution across data categories and regulations

### Widgets

Dashboard widgets are customizable per role. The DPO view highlights compliance and DSAR metrics, while the CISO view emphasizes security posture and breach status.

---

## Data Security Posture Management (DSPM)

DSPM continuously monitors your data security posture across all connected data sources.

### DSPM Dashboard

- **Posture Score** — Aggregate security score (0-100) based on findings
- **Findings by Severity** — Critical, High, Medium, Low breakdown
- **Trend Charts** — Score trends over time

### Findings

Findings represent security issues detected in your data environment:

| Field | Description |
|-------|-------------|
| Title | Description of the finding |
| Severity | Critical, High, Medium, Low |
| Category | Access Control, Encryption, Exposure, Configuration |
| Data Source | Affected connector/asset |
| Status | Open, In Progress, Resolved, Accepted Risk |
| Remediation | Suggested fix |

#### Working with Findings

1. Navigate to **DSPM > Findings**
2. Filter by severity, category, data source, or status
3. Click a finding to view details and remediation guidance
4. Assign the finding to a team member
5. Mark as resolved or accept the risk with justification

### Automated Remediation

For supported finding types, PrivacyOps can automatically apply fixes:

- Tighten database access controls
- Enable encryption on unencrypted columns
- Revoke excessive permissions
- Apply data masking rules

Navigate to **DSPM > Remediation** to view and approve automated remediations.

---

## Data Discovery & Connectors

### Adding a Connector

1. Navigate to **Discovery > Connectors**
2. Click **Add Connector**
3. Select the data source type:
   - **PostgreSQL** — Connect to PostgreSQL databases
   - **MySQL** — Connect to MySQL/MariaDB databases
   - **Microsoft SQL Server** — Connect to MSSQL databases
   - **MongoDB** — Connect to MongoDB clusters
   - **Google BigQuery** — Connect to BigQuery datasets
   - **Snowflake** — Connect to Snowflake warehouses
   - **Amazon S3** — Scan S3 buckets for unstructured data
   - **Azure Blob Storage** — Scan Azure storage containers
   - **Google Cloud Storage** — Scan GCS buckets for unstructured data
4. Enter connection details (host, port, credentials)
5. Test the connection
6. Save and schedule scans

> **Security Note:** All connector credentials are encrypted at rest using envelope encryption. Database connectors enforce TLS verification (`rejectUnauthorized: true`).

### Running Scans

Scans discover data assets (databases, schemas, tables, columns) in your connected sources.

1. Navigate to **Discovery > Connectors**
2. Select a connector
3. Click **Run Scan** or configure a schedule (daily, weekly, monthly)
4. Monitor scan progress in the scan history

Scans are executed as Temporal workflows and can be long-running for large data sources. The scan worker auto-scales from 2 to 20 replicas based on CPU utilization.

### Data Asset Inventory

After scanning, discovered assets appear in **Discovery > Assets**:

- Browse assets by data source, schema, or table
- View column-level metadata (name, type, nullable, sample values)
- See classification labels applied to each column
- Track data owners and stewards
- View sensitivity levels and regulation tags

---

## Data Classification

### How Classification Works

PrivacyOps uses a multi-layer classification engine:

1. **Rule-Based Detection** — Regex patterns and keyword matching against known data types (Aadhaar numbers, email addresses, credit card numbers, etc.)
2. **ML-Powered Classification** — Machine learning model for contextual classification of ambiguous data
3. **Manual Review** — Human-in-the-loop confirmation for sensitive classifications

### Classification Labels

Pre-configured labels include:

| Category | Labels |
|----------|--------|
| **India PII** | Aadhaar Number, PAN Number, Indian Mobile Number, GSTIN, Indian Passport, IFSC Code, Voter ID |
| **Global PII** | Email Address, Phone Number, Full Name, Date of Birth, Physical Address, IP Address |
| **Financial (PFI)** | Credit Card Number, Bank Account Number, UPI ID |
| **Health (PHI)** | Health Record |
| **US-Specific** | SSN |
| **Credentials** | Password / Secret |

Each label has:
- **Sensitivity Level** (1-5, where 5 is most sensitive)
- **Regulation Tags** (DPDP, GDPR, PCI-DSS, CCPA)
- **Detection Patterns** (regex and keyword rules)

### Reviewing Classifications

1. Navigate to **Classification > Reviews**
2. Review auto-classified columns
3. Confirm, reject, or change the classification label
4. Add manual classifications for columns not auto-detected

### Custom Labels

Tenant administrators can create custom classification labels:

1. Navigate to **Classification > Labels**
2. Click **Create Label**
3. Define the label name, category, sensitivity level, and detection patterns
4. Custom labels are scoped to your tenant

---

## Data Lineage

Data lineage tracks how data flows through your systems at the column level.

### Viewing Lineage

1. Navigate to **Data Lineage**
2. Select a data asset (table or column)
3. View the visual lineage graph showing:
   - **Upstream sources** — Where data originates
   - **Downstream consumers** — Where data flows to
   - **Transformations** — How data is modified along the way

### Impact Analysis

Before making changes to a data source:

1. Select the asset you plan to modify
2. Click **Impact Analysis**
3. View all downstream dependencies that would be affected
4. Export the impact report for change management

---

## Data Graph

The Data Graph provides a relationship map of your data ecosystem:

- **Data assets** connected to their **owners** and **stewards**
- **Regulations** linked to affected **data categories**
- **Processing activities** connected to their **legal bases**
- **Vendors** linked to shared **data types**

Navigate to **Data Graph** to explore the interactive visualization.

---

## Compliance Management

### Regulation Mapping

1. Navigate to **Compliance > Regulations**
2. View supported regulations (DPDP 2023, GDPR, ISO 27701, PCI-DSS)
3. Each regulation lists its obligations/articles

### Compliance Controls

Map your organizational controls to regulation obligations:

1. Navigate to **Compliance > Controls**
2. For each obligation, link your existing control (policy, process, or technical control)
3. Set the control status (Implemented, Partially Implemented, Not Implemented, N/A)
4. Upload evidence documents

### Gap Analysis

The gap analysis view shows:

- **Overall compliance score** per regulation
- **Gap items** — obligations without adequate controls
- **Recommendations** — suggested actions to close gaps
- **Priority ranking** — based on risk and regulatory severity

---

## Records of Processing Activities (ROPA)

ROPA is required under GDPR Article 30 and DPDP 2023.

### Creating a Processing Activity

1. Navigate to **ROPA > Activities**
2. Click **Create Activity**
3. Fill in:
   - Processing purpose
   - Categories of data subjects
   - Categories of personal data
   - Recipients/transfers
   - Retention period
   - Legal basis
   - Technical and organizational measures
4. Link to relevant data assets discovered via scanning
5. Submit for review

### Exporting ROPA

Export your ROPA register in standard formats for regulatory submissions:

- PDF report
- CSV/Excel export
- JSON for system integration

---

## Consent Management

### Consent Records

Track consent from data subjects:

1. Navigate to **Consent > Records**
2. View all consent records with:
   - Data subject identifier
   - Purpose of processing
   - Consent status (Given, Withdrawn, Expired)
   - Timestamp of consent/withdrawal
   - Source (web form, API, manual)

### Managing Consent

- **Record new consent** — Via API, manual entry, or the public consent ingest endpoint
- **Process withdrawal** — Mark consent as withdrawn and trigger downstream data handling
- **Audit trail** — Full history of consent changes with timestamps

### Public Consent Ingest

For collecting consent from anonymous website visitors without requiring authentication:

1. Configure `CONSENT_PUBLIC_SHARED_SECRET` in your environment
2. Use the Consent SDK (`packages/consent-sdk/`) to embed a consent banner in your website
3. The SDK sends `POST /consent/public/record` with HMAC-SHA256 authentication
4. Requests include `X-Tenant-Id` and `X-Consent-Signature` headers
5. The server verifies the signature and creates a consent record

The Consent SDK provides two components:
- **ConsentClient** — Low-level API client for programmatic consent capture
- **ConsentBanner** — Pre-built UI banner for cookie/privacy consent

### Purpose Management

Define processing purposes and link them to consent:

1. Navigate to **Consent > Purposes**
2. Create purposes (e.g., "Marketing communications", "Analytics", "Service delivery")
3. Link purposes to specific data processing activities

---

## Data Subject Access Requests (DSAR)

### Request Intake

DSARs can be submitted via:

- **Web portal** — Self-service request form
- **Email** — Forwarded to the DSAR inbox
- **API** — Programmatic submission

### Processing a DSAR

1. Navigate to **DSAR > Requests**
2. View incoming requests with SLA timelines
3. Click a request to begin processing:
   - **Verify identity** — Confirm the data subject's identity. The platform supports fuzzy identity matching (`POST /dsar/identity-match`) using weighted scoring across email, phone, name, and external ID fields
   - **Locate data** — Use data discovery to find all data related to the subject
   - **Collect data** — Gather data from relevant systems (automated via Temporal workflows)
   - **Review** — Review collected data before responding. Third-party PII is automatically redacted from the response package via the Redaction Engine
   - **Download** — Download the DSAR response package (`GET /dsar/:id/download`)
   - **Respond** — Send the response to the data subject
4. Track SLA compliance (DPDP: 30 days, GDPR: 30 days)

### Request Types

| Type | Description |
|------|-------------|
| Access | Provide a copy of personal data |
| Rectification | Correct inaccurate data |
| Erasure | Delete personal data ("Right to be forgotten") |
| Portability | Export data in machine-readable format |
| Restriction | Restrict processing of data |
| Objection | Object to specific processing |

---

## Breach & Incident Management

### Reporting an Incident

1. Navigate to **Breach > Incidents**
2. Click **Report Incident**
3. Fill in:
   - Incident title and description
   - Date/time of discovery
   - Affected data types and data subjects
   - Severity assessment
   - Initial containment actions

### Incident Lifecycle

| Status | Description |
|--------|-------------|
| Reported | Initial report filed |
| Investigating | Under active investigation |
| Contained | Immediate threat contained |
| Remediated | Root cause fixed |
| Closed | Incident fully resolved |

### Breach Notification

When an incident qualifies as a reportable breach:

1. The system flags the incident for notification
2. Generate a notification report with:
   - Nature of the breach
   - Categories and number of affected data subjects
   - Likely consequences
   - Measures taken
3. Track notification deadlines:
   - **DPDP**: Notify the Board and affected individuals "without delay"
   - **GDPR**: 72 hours to DPA, "without undue delay" to individuals

### Timeline

Every incident maintains a full timeline of events, actions taken, and communications for audit purposes.

---

## Risk Assessments

### Privacy Impact Assessments (PIA/DPIA)

1. Navigate to **Risk > Assessments**
2. Click **New Assessment**
3. Select the assessment type (PIA, DPIA, or custom)
4. Complete the assessment questionnaire:
   - Processing description
   - Necessity and proportionality
   - Risks to data subjects
   - Mitigation measures
5. Calculate risk scores
6. Submit for review and approval

### Risk Scoring

Risks are scored on:
- **Likelihood** (1-5)
- **Impact** (1-5)
- **Risk Level** = Likelihood x Impact (Low, Medium, High, Critical)

### Risk Register

View all identified risks across assessments in the risk register with:
- Risk description
- Current risk level
- Mitigation status
- Responsible owner
- Review date

---

## Data Retention

### Retention Policies

1. Navigate to **Retention > Policies**
2. Create retention rules:
   - **Data category** — Which types of data the rule applies to
   - **Retention period** — How long data should be kept
   - **Legal basis** — Regulatory or business justification
   - **Action on expiry** — Delete, anonymize, or archive
3. Link policies to data assets

### Enforcement

Retention policies are enforced via automated workflows:
- Data approaching retention limits triggers alerts
- Expired data is flagged for deletion or anonymization
- All retention actions are logged in the audit trail

---

## Vendor Management

### Adding Vendors

1. Navigate to **Vendors > Registry**
2. Click **Add Vendor**
3. Enter vendor details:
   - Company name and contact
   - Services provided
   - Data shared with the vendor
   - Data processing agreement (DPA) status
   - Security certifications

### Risk Assessment

Assess vendor risk based on:
- Types of data shared
- Data processing locations
- Security posture
- Contractual safeguards
- History of incidents

### DPA Tracking

Track Data Processing Agreements:
- DPA status (Draft, Signed, Expired, Not Required)
- Expiration dates and renewal reminders
- Standard contractual clauses
- Sub-processor lists

---

## AI Governance

### Model Inventory

1. Navigate to **AI Governance > Models**
2. Register AI/ML models used in your organization
3. Document:
   - Model purpose and use case
   - Training data sources
   - Input/output data types
   - Bias assessment results
   - Risk classification

### AI Risk Assessment

Evaluate AI-specific risks:
- Bias and fairness
- Transparency and explainability
- Data quality and representativeness
- Human oversight requirements
- Automated decision-making implications

---

## AI Co-Pilot

The AI Co-Pilot provides a natural language interface for privacy operations, powered by Anthropic Claude.

### Usage

1. Navigate to **Co-Pilot** or use the chat widget
2. Ask questions in natural language, for example:
   - "What are my top risks?"
   - "Show excessive access permissions"
   - "Which assets lack classification?"
   - "Are we compliant with GDPR?"
   - "Show critical attack paths"
   - "Which vendors have high risk scores?"
   - "Show open remediation actions"

### AI-Powered Narratives

When AI is available, several modules display AI-generated explanations alongside their data:

- **Risk findings** — Natural language explanation of what the finding means and why it matters
- **Remediation plans** — Plain-language summary of recommended actions
- **Attack paths** — Human-readable description of the exposure path

These narratives are generated by the NarrativeService. If the AI provider is unavailable, deterministic template-based explanations are shown instead.

### Requirements & Licensing

- **API Key**: `ANTHROPIC_API_KEY` must be configured (the provider is inert without it)
- **Feature Flag**: The tenant must have the `ai_llm_enrichment` feature enabled for LLM-enriched responses
- **Fail-Safe**: The platform is fully functional without AI. All AI features degrade gracefully to deterministic templates
- **PII Protection**: All data sent to the LLM is pre-scrubbed by the Redaction Engine (12 PII pattern types)

---

## Advanced Security Features

### Attack Path Analysis

Identifies potential data exposure paths:
- Excessive database permissions
- Unencrypted data in transit
- Overly permissive API access
- Cross-tenant data leakage risks

Navigate to **Security > Attack Paths** to view identified paths and remediation steps.

### Shadow Data Detection

Discovers unmanaged data stores that may contain sensitive data:
- Databases not registered in the asset inventory
- File shares with personal data
- Cloud storage buckets without governance

### Threat Hunting

Proactive investigation of data security threats:
- Anomalous data access patterns
- Unusual data export volumes
- Suspicious query patterns
- Potential data exfiltration indicators

### Adaptive Policies

Context-aware policies that automatically adjust based on:
- Data sensitivity level
- User role and access patterns
- Regulatory requirements
- Risk assessment results

---

## User & Role Management

### System Roles

| Role | Description | Key Permissions |
|------|-------------|----------------|
| Super Admin | Full platform access | All permissions (`*`) |
| Tenant Admin | Full tenant administration | User management, all modules |
| DPO / Privacy Officer | Data Protection Officer | Classification, consent, DSAR, compliance, ROPA |
| CISO | Chief Information Security Officer | DSPM, discovery, breach, risk |
| Compliance Manager | Regulatory compliance | Consent, DSAR, risk, compliance, ROPA |
| Security Analyst | Security operations | DSPM findings, breach management |
| Data Steward | Data ownership | Asset management, classification review, DSAR collection |
| Auditor | Read-only audit | Read access to all modules, audit logs |

### Managing Users

1. Navigate to **Settings > Users**
2. Invite users by email
3. Assign one or more roles
4. Users are scoped to your tenant — they cannot access other tenants' data

---

## Account Security

### Enabling MFA

1. Navigate to your **Profile > Security**
2. Click **Enable MFA**
3. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to confirm
5. Save the recovery codes in a secure location

### Recovery Codes

Recovery codes are one-time-use codes for accessing your account if you lose your authenticator device. Each code can only be used once. Store them securely.

### Session Management

1. Navigate to your **Profile > Sessions**
2. View all active sessions with:
   - IP address
   - Browser/device
   - Login time
   - Last activity
3. Revoke individual sessions or all sessions

---

## SCIM Provisioning

SCIM 2.0 enables automated user provisioning from your identity provider (Okta, Azure AD, OneLogin, etc.).

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/scim/v2/Users` | List users |
| GET | `/api/v1/scim/v2/Users/:id` | Get user |
| POST | `/api/v1/scim/v2/Users` | Create user |
| PUT | `/api/v1/scim/v2/Users/:id` | Replace user |
| PATCH | `/api/v1/scim/v2/Users/:id` | Update user attributes |
| DELETE | `/api/v1/scim/v2/Users/:id` | Deactivate user |
| GET | `/api/v1/scim/v2/Groups` | List groups |
| GET | `/api/v1/scim/v2/Groups/:id` | Get group |
| PATCH | `/api/v1/scim/v2/Groups/:id` | Update group membership |

### Configuration

1. In your IdP, add PrivacyOps as a SCIM application
2. Set the SCIM base URL to `https://<your-domain>/api/v1/scim/v2`
3. Use a bearer token for authentication (configured per tenant)
4. Map user attributes (userName, email, name, active)

---

## API Usage

### Authentication

All API requests (except SCIM and public auth endpoints) require a JWT bearer token:

```
Authorization: Bearer <access-token>
```

Obtain tokens via the login endpoint:

```bash
curl -X POST https://<your-domain>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'
```

### API Prefix

All endpoints are prefixed with `/api/v1/`.

### Pagination

List endpoints support pagination via query parameters:

| Parameter | Description |
|-----------|-------------|
| `page` | Page number (1-based) |
| `limit` | Items per page (default: 20, max: 100) |
| `sortBy` | Field to sort by |
| `sortOrder` | `asc` or `desc` |

### Error Responses

Errors follow a standard format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Rate Limiting

API requests are rate-limited per tenant:
- **Default**: 100 requests per 60 seconds
- **Auth endpoints**: 5 login attempts per 60 seconds
- **Token refresh**: 10 requests per 60 seconds

Rate limit headers are included in responses:
- `X-RateLimit-Remaining` — Requests remaining in the current window

### Swagger Documentation

Interactive API documentation is available at `/api/docs` in non-production environments. It includes:
- All endpoints with request/response schemas
- Try-it-out functionality
- Authentication support (Bearer token and API key)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `g d` | Go to Dashboard |
| `g s` | Go to Settings |
| `?` | Show keyboard shortcuts |

---

## Getting Help

- **In-app**: Use the AI Co-Pilot for contextual help
- **Documentation**: Browse the [Architecture Docs](architecture/) for technical details
- **API Reference**: Access Swagger docs at `/api/docs`
- **Support**: Contact your organization's PrivacyOps administrator
