# TechD PrivacyOps + DSPM Platform -- Data Classification Policy

**Document ID:** TECHD-DCP-002
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Data Protection Officer (DPO)
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy defines the data classification framework for the TechD PrivacyOps + DSPM platform. It establishes classification tiers, handling requirements, automated classification mechanisms, and connector-specific classification behaviors. This policy applies to all data ingested, processed, stored, or transmitted by the platform across all 43 registered connectors.

---

## 2. Classification Tiers

The platform enforces six data classification tiers, ordered by sensitivity:

### 2.1 Tier 1 -- PII (Personally Identifiable Information)

**Definition:** Any data that can directly or indirectly identify a natural person.

**Examples:** Full names, email addresses, phone numbers, Social Security numbers, IP addresses, device identifiers, biometric data, geolocation data.

**Regulatory Context:** GDPR Article 4(1), CCPA Section 1798.140(o), CPRA amendments.

**Platform Detection:** DSPM scanning engine applies regex patterns, NLP entity recognition, and contextual analysis during SCAN task queue workflows.

### 2.2 Tier 2 -- PHI (Protected Health Information)

**Definition:** Individually identifiable health information as defined under HIPAA.

**Examples:** Medical record numbers, diagnosis codes (ICD-10), prescription data, insurance claim identifiers, lab results linked to individuals.

**Regulatory Context:** HIPAA Privacy Rule (45 CFR Part 160/164), HITECH Act.

**Platform Detection:** PHI classifiers detect healthcare-specific patterns including HL7 message formats, FHIR resource structures, and medical terminology co-occurrence with PII elements.

### 2.3 Tier 3 -- PCI (Payment Card Industry Data)

**Definition:** Cardholder data and sensitive authentication data as defined by PCI DSS.

**Examples:** Primary Account Numbers (PAN), cardholder names, expiration dates, CVV/CVC codes, PIN blocks, magnetic stripe data.

**Regulatory Context:** PCI DSS v4.0, PA-DSS.

**Platform Detection:** PCI classifiers use Luhn algorithm validation, BIN range matching, and pattern detection for card number formats (Visa, Mastercard, Amex, Discover).

### 2.4 Tier 4 -- Confidential

**Definition:** Business-sensitive data whose exposure would cause material harm to the organization or its customers.

**Examples:** API keys, connector credentials, encryption keys, internal financial data, unreleased product information, tenant configuration data, Stripe billing metadata.

**Platform Detection:** Entropy analysis for secrets detection, keyword matching for business-sensitive terminology, credential pattern recognition.

### 2.5 Tier 5 -- Internal

**Definition:** Data intended for internal use that does not meet higher classification thresholds.

**Examples:** Internal documentation, non-sensitive configuration files, development environment data, aggregated analytics, anonymized audit metrics.

**Platform Detection:** Default classification for data that does not trigger higher-tier classifiers.

### 2.6 Tier 6 -- Public

**Definition:** Data explicitly approved for public disclosure.

**Examples:** Published API documentation, marketing materials, public-facing help content, open-source component metadata.

**Platform Detection:** Requires explicit marking. Data is never auto-classified as Public.

---

## 3. Handling Requirements by Tier

### 3.1 Storage Requirements

| Tier | Encryption at Rest | Access Control | Backup Retention | Isolation |
|------|-------------------|----------------|-------------------|-----------|
| PII | Required (AES-256) | RBAC + ABAC | Per retention policy | Tenant RLS |
| PHI | Required (AES-256) | RBAC + ABAC + Approval Guard | Per HIPAA (6 years) | Tenant RLS + dedicated schema option |
| PCI | Required (AES-256) | RBAC + ABAC + Approval Guard | Per PCI DSS (1 year) | Tenant RLS + column-level encryption |
| Confidential | Required (AES-256) | RBAC + ABAC | Per retention policy | Tenant RLS |
| Internal | Required (AES-256) | RBAC | 90 days | Tenant RLS |
| Public | Recommended | RBAC | 30 days | Tenant RLS |

### 3.2 Transmission Requirements

| Tier | In-Transit Encryption | Event Bus Signing | API Response |
|------|----------------------|-------------------|-------------|
| PII | TLS 1.2+ mandatory | HMAC-SHA256 signed | Redaction available |
| PHI | TLS 1.2+ mandatory | HMAC-SHA256 signed | Redaction mandatory |
| PCI | TLS 1.2+ mandatory | HMAC-SHA256 signed | Masking mandatory (show last 4 only) |
| Confidential | TLS 1.2+ mandatory | HMAC-SHA256 signed | Full payload |
| Internal | TLS 1.2+ mandatory | HMAC-SHA256 signed | Full payload |
| Public | TLS 1.2+ recommended | Optional | Full payload |

### 3.3 DSAR and Redaction Requirements

| Tier | DSAR Subject Access | DSAR Portability | DSAR Deletion | Redaction on Failure |
|------|-------------------|-----------------|---------------|---------------------|
| PII | Required (GDPR Art. 15) | Required (GDPR Art. 20) | Required (GDPR Art. 17) | Fail-closed: status 'redaction_failed', block download |
| PHI | Required (HIPAA Right of Access) | Required | Conditional (retention override) | Fail-closed: block download, critical audit event |
| PCI | Limited (cardholder request) | Not applicable | Required post-retention | Fail-closed: block download |
| Confidential | Not applicable | Not applicable | Per retention policy | N/A |
| Internal | Not applicable | Not applicable | Per retention policy | N/A |
| Public | Not applicable | Not applicable | Per retention policy | N/A |

### 3.4 AI Co-pilot Interaction

| Tier | Sent to Anthropic Claude | Pre-send Treatment | Feature Gate |
|------|--------------------------|-------------------|-------------|
| PII | Only after redaction | PII redaction pipeline (fail-closed) | ai_llm_enrichment |
| PHI | Prohibited | Blocked at classification layer | ai_llm_enrichment + PHI gate |
| PCI | Prohibited | Blocked at classification layer | ai_llm_enrichment + PCI gate |
| Confidential | Only after redaction | Credential/secret stripping | ai_llm_enrichment |
| Internal | Permitted | Metadata-only mode available | ai_llm_enrichment |
| Public | Permitted | No treatment required | ai_llm_enrichment |

---

## 4. Connector-Specific Classification

### 4.1 Structured Data Connectors

| Connector | Classification Approach | Supported Tiers | Scan Method |
|-----------|------------------------|-----------------|-------------|
| postgresql | Column-level sampling + metadata analysis | All | SCAN queue: schema introspection + row sampling |
| mysql | Column-level sampling + metadata analysis | All | SCAN queue: schema introspection + row sampling |
| sqlserver | Column-level sampling + metadata analysis | All | SCAN queue: schema introspection + row sampling |
| snowflake | Column-level sampling + Snowflake tags integration | All | SCAN queue: INFORMATION_SCHEMA + sampling |
| bigquery | Column-level sampling + BigQuery policy tags | All | SCAN queue: INFORMATION_SCHEMA + sampling |
| mongodb | Document sampling + nested field traversal | All | SCAN queue: collection sampling + schema inference |

### 4.2 Object Storage Connectors

| Connector | Classification Approach | Supported Tiers | Scan Method |
|-----------|------------------------|-----------------|-------------|
| aws_s3 | Object content analysis + metadata tags | All | SCAN queue: list objects + content sampling |
| azure_blob | Blob content analysis + metadata | All | SCAN queue: list blobs + content sampling |
| gcp_storage | Object content analysis + labels | All | SCAN queue: list objects + content sampling |

### 4.3 SaaS Application Connectors

| Connector | Classification Approach | Supported Tiers | Scan Method |
|-----------|------------------------|-----------------|-------------|
| salesforce | Object/field-level API inspection | PII, Confidential, Internal, Public | SCAN queue: describe API + record sampling |
| okta | User profile and log analysis | PII, Internal | SCAN queue: user/group API enumeration |

### 4.4 Classification Confidence Scoring

Each classified element receives a confidence score:

- **High Confidence (>= 0.9):** Deterministic match (e.g., Luhn-validated card number, SSN format with context). Auto-applied.
- **Medium Confidence (0.7 - 0.89):** Probabilistic match (e.g., name-like patterns, email-adjacent strings). Auto-applied with review flag.
- **Low Confidence (0.5 - 0.69):** Possible match. Queued for human review via APPROVAL task queue.
- **Below Threshold (< 0.5):** Not classified. Logged for training data improvement.

---

## 5. Automated Classification Workflow

### 5.1 SCAN Task Queue Pipeline

1. **Discovery:** Connector enumerates data assets (tables, collections, buckets, objects).
2. **Sampling:** Statistically significant sample extracted per asset (configurable: default 1000 rows or 100 objects).
3. **Analysis:** Classification engine applies tier-specific detectors in priority order (PCI > PHI > PII > Confidential > Internal).
4. **Labeling:** Classification results written to catalog metadata with confidence scores.
5. **Notification:** Classification changes trigger NATS events (HMAC-signed) for downstream consumers.
6. **Remediation:** High-severity misclassifications (e.g., unencrypted PCI data) trigger REMEDIATION queue workflows.

### 5.2 Continuous Classification

- **Full Scan:** Scheduled per connector (configurable: default weekly).
- **Incremental Scan:** Triggered by change detection events from connectors that support webhooks or change streams.
- **On-Demand Scan:** Triggered by tenant administrators or DSAR workflows.

### 5.3 Classification Override

Tenant administrators with the `data_classification:override` permission can manually override automated classifications. Overrides are:

- Logged in the SHA256 hash chain audit log with the original and new classification.
- Subject to ABAC policy evaluation.
- Reviewed quarterly by the DPO.

---

## 6. Legal Hold Interaction

When a LegalHold is active on data:

- Classification cannot be downgraded.
- Data cannot be deleted regardless of retention policy.
- LegalHold is enforced via RLS with tenant_id + released_at + expires_at filtering.
- Re-classification to a higher tier is permitted and logged.
- DSAR deletion requests for held data return a compliance exception with the hold reference.

---

## 7. Cross-Border Classification Considerations

Data classified as PII or PHI that is stored in or transmitted to connectors across jurisdictional boundaries requires:

- Transfer Impact Assessment (per Schrems II requirements).
- Documentation of legal basis for transfer (SCCs, BCRs, adequacy decision).
- Encryption in transit and at rest with keys managed in the originating jurisdiction.
- Logging of all cross-border transfers in the audit chain.

---

## 8. Metrics and Reporting

### 8.1 Classification Coverage

- Percentage of connected data assets with completed classification.
- Classification freshness: time since last scan per connector.
- Override rate: percentage of classifications manually overridden.

### 8.2 Compliance Reporting

- Per-regulation compliance posture based on classification coverage.
- Unclassified data inventory with risk scoring.
- Classification trend analysis (new PII/PHI/PCI discoveries over time).

---

## 9. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Encryption Standards | TECHD-ENC-003 |
| Access Control Policy | TECHD-ACP-004 |
| Data Retention Policy | TECHD-DRP-006 |
| Privacy Impact Assessment Template | TECHD-PIA-007 |
| Compliance Matrix | TECHD-CM-012 |

---

## 10. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | DPO | Initial release with 4 classification tiers |
| 2.0 | 2026-05-10 | DPO | Expanded to 6 tiers, added connector-specific classification, AI co-pilot interaction rules, confidence scoring |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
