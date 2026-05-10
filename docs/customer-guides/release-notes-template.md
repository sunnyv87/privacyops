# TechD PrivacyOps + DSPM -- Release Notes

This document provides versioned release notes for TechD PrivacyOps + DSPM. Each release includes feature highlights, improvements, bug fixes, breaking changes, migration notes, known issues, and deprecation notices.

---

## Release Notes Format

Each release follows this structure:

- **Version:** Semantic versioning (MAJOR.MINOR.PATCH)
- **Release Date:** Date the release was deployed to production
- **Release Type:** Major Release, Feature Release, Patch Release, or Hotfix
- **Highlights:** Summary of the most significant changes
- **New Features:** Detailed descriptions of new functionality
- **Improvements:** Enhancements to existing features
- **Bug Fixes:** Resolved defects
- **Breaking Changes:** Changes that require customer action
- **Migration Notes:** Steps required when upgrading
- **Known Issues:** Documented issues with workarounds
- **Deprecation Notices:** Features scheduled for removal in future releases

---

## v1.0.0 -- Initial Release

**Release Date:** 2026-05-01

**Release Type:** Major Release

### Highlights

TechD PrivacyOps + DSPM v1.0.0 is the initial general availability release of the unified privacy operations and data security posture management platform. This release delivers a comprehensive suite of privacy, security, and compliance capabilities across 43 data source connectors with support for six major privacy regulations.

---

### New Features

#### Data Security Posture Management (DSPM)

- Continuous security posture scanning across all connected data sources
- Posture scoring (0-100) with findings by severity (Critical, High, Medium, Low)
- Findings categorized by Access Control, Encryption, Exposure, and Configuration
- Trend charts for posture score tracking over time
- Attack path analysis identifying potential data exposure routes
- Shadow data detection for unmanaged data stores

#### Data Discovery and Classification

- 43 connector types supported: aws_s3, postgresql, mysql, snowflake, mongodb, salesforce, okta, azure_blob, gcp_storage, sqlserver, bigquery, and 32 additional connectors
- Automated schema, table, column, and object discovery
- Multi-layer classification engine: rule-based (regex/keyword), ML-powered contextual classification, and manual review
- Pre-configured classification labels across India PII, Global PII, Financial (PFI), Health (PHI), US-Specific, and Credentials categories
- Custom classification label creation per tenant
- Data lineage tracking at the column level
- Data graph visualization of asset relationships

#### DSAR Management

- Full DSAR lifecycle: intake, identity verification, data discovery, review, redaction, export, and response delivery
- Six request types: Access, Rectification, Erasure, Portability, Restriction, Objection
- Automated subject data discovery across all connected sources via Temporal workflows
- Fuzzy identity matching with weighted scoring across email, phone, name, and external ID
- PII redaction engine detecting 12 pattern types to protect third-party data in response packages
- Response letter generation with regulation-specific templates
- SLA tracking with configurable notifications at 50%, 75%, and 90% of deadline
- Multiple export formats: PDF, CSV, JSON, ZIP
- Self-service web portal, email intake, and API submission channels

#### Consent Management

- Purpose-based consent tracking with full audit trail
- Consent record management: record, withdraw, track status changes
- Public consent ingestion endpoint with HMAC-SHA256 authentication for cookie banners and web forms
- Consent SDK with ConsentClient (programmatic) and ConsentBanner (UI) components
- Purpose management with links to processing activities
- Withdrawal workflows triggering downstream data handling actions

#### Remediation Engine

- 12 remediation action types: revoke_access, encrypt, enable_mfa, apply_retention, restrict_public, delete_data, mask_data, quarantine, rotate_credentials, restrict_sharing, disable_public_access, enforce_encryption
- Capability matrix: 11 connector types x 12 action types
- Three execution modes: native (automated), catalog_update (metadata), unsupported (manual guidance)
- Approval workflows with configurable rules and escalation
- Rollback support for native actions
- Bulk remediation for batch processing of similar findings

#### Incident and Breach Management

- Incident lifecycle management: Reported, Investigating, Contained, Remediated, Closed
- Breach notification workflow with regulatory deadline tracking (GDPR 72-hour, DPDP without delay)
- Notification report generation with affected data types, subjects, and measures taken
- Full incident timeline and audit trail

#### Compliance Management

- Regulatory framework support: GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, PIPL
- Control mapping to regulatory obligations with evidence tracking
- Gap analysis with compliance scores per regulation
- Records of Processing Activities (ROPA) per GDPR Article 30
- Privacy Impact Assessments (PIA/DPIA) with risk scoring

#### Vendor Risk Management

- Vendor registry with service details and data sharing inventory
- Risk assessment based on data types, processing locations, and security posture
- Data Processing Agreement (DPA) tracking with status and renewal reminders
- Sub-processor management

#### AI Co-pilot

- Natural language interface for privacy operations queries
- Powered by Anthropic Claude with PII pre-scrubbing via the Redaction Engine
- AI-generated narratives for risk findings, remediation plans, and attack paths
- Graceful degradation to deterministic templates when AI is unavailable
- Feature-gated: requires `ai_copilot` flag and `ANTHROPIC_API_KEY` configuration

#### Platform and Administration

- Multi-tenant SaaS architecture with full tenant isolation
- RBAC with six roles: Admin, Privacy Officer, DPO, Security Analyst, Compliance Manager, Viewer
- SAML 2.0 SSO with support for Okta, Azure AD, Google Workspace, OneLogin, PingFederate
- SCIM 2.0 automated user provisioning
- RESTful API with JWT authentication, Swagger/OpenAPI documentation
- Real-time dashboards via WebSocket with customizable widget layouts
- Configurable alerts via email, Slack, Microsoft Teams, PagerDuty, and custom webhooks
- Immutable audit logging with configurable retention
- Rate limiting: 100 requests per 60 seconds (general), 5 per 60 seconds (auth)
- Branding and customization: logo, colors, custom domain support

---

### Improvements

- Not applicable (initial release).

---

### Bug Fixes

- Not applicable (initial release).

---

### Breaking Changes

- Not applicable (initial release).

---

### Migration Notes

- Not applicable (initial release). For new installations, refer to the [Getting Started Guide](getting-started-guide.md).

---

### Known Issues

| ID | Description | Workaround | Target Fix |
|----|-------------|------------|------------|
| KI-001 | Incremental scans on MongoDB connectors may miss documents added during the scan window. | Run a full scan to capture all documents. | v1.0.1 |
| KI-002 | The risk heatmap widget may take up to 60 seconds to load for tenants with more than 10,000 findings. | Use the date range filter to narrow the findings scope. | v1.1.0 |
| KI-003 | DSAR response letters for PIPL regulation use generic templates; China-specific legal language is under review. | Manually edit the response letter before sending. | v1.1.0 |
| KI-004 | Custom classification labels with regex patterns containing Unicode character classes may not match correctly on certain document types. | Use ASCII-compatible patterns or apply manual classification. | v1.0.1 |

---

### Deprecation Notices

- Not applicable (initial release).

---

## Release Notes Template (for future releases)

Use the following template for each subsequent release.

---

## vX.Y.Z -- [Release Title]

**Release Date:** YYYY-MM-DD

**Release Type:** Major Release / Feature Release / Patch Release / Hotfix

### Highlights

[1-3 sentence summary of the most important changes in this release.]

---

### New Features

#### [Feature Name]

- [Description of the feature]
- [How users benefit from this feature]
- [Any configuration or setup required]

---

### Improvements

- **[Module/Area]:** [Description of the improvement]
- **[Module/Area]:** [Description of the improvement]

---

### Bug Fixes

- **[BUG-XXX]:** [Description of the bug that was fixed]
- **[BUG-XXX]:** [Description of the bug that was fixed]

---

### Breaking Changes

> **Action Required:** The following changes may require updates to your configuration or integrations.

- **[Change description]:** [What changed, why, and what customers need to do]

---

### Migration Notes

Steps required when upgrading from vX.Y.(Z-1) to vX.Y.Z:

1. [Step 1]
2. [Step 2]
3. [Step 3]

---

### Known Issues

| ID | Description | Workaround | Target Fix |
|----|-------------|------------|------------|
| KI-XXX | [Description] | [Workaround] | vX.Y.Z |

---

### Deprecation Notices

| Feature | Deprecated In | Removal Planned | Migration Path |
|---------|---------------|-----------------|----------------|
| [Feature name] | vX.Y.Z | vX.Y.Z | [How to migrate] |

---

## Version History

| Version | Release Date | Type | Highlights |
|---------|-------------|------|------------|
| v1.0.0 | 2026-05-01 | Major Release | Initial GA release with full DSPM, DSAR, Consent, Remediation, and AI Co-pilot |

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
