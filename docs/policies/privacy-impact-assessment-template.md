# TechD PrivacyOps + DSPM Platform -- Privacy Impact Assessment Template

**Document ID:** TECHD-PIA-007
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Data Protection Officer (DPO)
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This template provides a standardized framework for conducting Privacy Impact Assessments (PIAs) for the TechD PrivacyOps + DSPM platform. PIAs are required when introducing new connectors (implementing the IConnector interface), new data processing activities, changes to the AI co-pilot integration, cross-border data transfers, or new vendor integrations. This template aligns with GDPR Article 35 (Data Protection Impact Assessment) requirements.

---

## 2. PIA Triggers

A PIA must be completed before any of the following activities proceed to production:

| Trigger | Approval Required | Estimated Effort |
|---------|-------------------|------------------|
| New connector implementation (IConnector) | DPO + Security Engineering Lead | 5-10 business days |
| New data processing purpose added | DPO | 3-5 business days |
| AI co-pilot feature expansion | DPO + CISO | 5-10 business days |
| Cross-border data transfer (new jurisdiction) | DPO + Legal | 10-15 business days |
| New third-party vendor integration | DPO + Vendor Risk Committee | 5-10 business days |
| Change to DSAR workflow logic | DPO | 3-5 business days |
| Change to data classification rules | DPO | 3-5 business days |
| New Temporal task queue or workflow type | DPO + Security Engineering Lead | 3-5 business days |
| Modification to RLS policies | DPO + CISO | 5-10 business days |
| Change to retention policies | DPO | 3-5 business days |

---

## 3. Assessment Information

### Section 3.1 -- Project Identification

| Field | Value |
|-------|-------|
| PIA Reference Number | TECHD-PIA-[YYYY]-[NNN] |
| Project/Change Name | [Enter name] |
| Project Lead | [Name, role] |
| DPO Reviewer | [Name] |
| Assessment Date | [YYYY-MM-DD] |
| Target Production Date | [YYYY-MM-DD] |
| PIA Trigger Category | [Select from Section 2] |

### Section 3.2 -- Project Description

Provide a detailed description of the proposed processing activity, including:

1. **Business Objective:** What business need does this change address?
2. **Technical Description:** How will the change be implemented within the platform architecture?
3. **Data Flows:** Describe all data flows, including ingestion, processing, storage, transmission, and deletion.
4. **Platform Components Affected:** Which modules, services, workflows, or task queues are involved?
5. **Timeline:** Key milestones from development through production deployment.

---

## 4. Data Processing Assessment

### Section 4.1 -- Personal Data Inventory

| Data Element | Classification | Source Connector(s) | Processing Purpose | Legal Basis (GDPR Art. 6) | Retention Period |
|-------------|---------------|--------------------|--------------------|--------------------------|-----------------|
| [e.g., Email address] | PII | [e.g., salesforce, postgresql] | [e.g., DSAR fulfillment] | [e.g., Legal obligation Art. 6(1)(c)] | [e.g., 6 years] |
| | | | | | |
| | | | | | |

### Section 4.2 -- Special Category Data (GDPR Art. 9)

| Data Element | Category | Additional Safeguards | Explicit Consent Required | DPIA Required (Art. 35) |
|-------------|----------|----------------------|--------------------------|------------------------|
| [e.g., Medical records] | PHI | Column-level encryption, ABAC restriction | Yes | Yes |
| | | | | |

### Section 4.3 -- Data Subjects

| Subject Category | Approximate Volume | Vulnerable Subjects | Jurisdiction(s) |
|-----------------|-------------------|--------------------| ----------------|
| [e.g., End customers] | [e.g., 100K-1M] | [Yes/No, describe] | [e.g., EU, US-CA] |
| | | | |

### Section 4.4 -- Data Processing Activities

| Activity | Temporal Task Queue | Automated/Manual | Third-Party Involved | Data Classification Tiers Affected |
|----------|--------------------|-----------------|-----------------------|-----------------------------------|
| [e.g., Scan connected source] | SCAN | Automated | [Connector vendor] | PII, PHI, PCI, Confidential |
| [e.g., Process deletion request] | DSAR, DATA_DELETION | Automated with approval | None | PII, PHI |
| [e.g., AI-assisted analysis] | N/A (synchronous) | Automated | Anthropic (Claude API) | Internal (post-redaction) |
| | | | | |

---

## 5. New Connector Assessment (IConnector Implementation)

Complete this section when the PIA is triggered by a new connector.

### Section 5.1 -- Connector Profile

| Field | Value |
|-------|-------|
| Connector Identifier | [e.g., aws_dynamodb] |
| Connector Type | [Database / Object Storage / SaaS / Identity Provider] |
| Vendor/Provider | [e.g., Amazon Web Services] |
| Data Location(s) | [e.g., us-east-1, eu-west-1] |
| Authentication Method | [e.g., IAM role, API key, OAuth 2.0] |
| Encryption at Rest | [e.g., DynamoDB encryption with AWS-managed keys] |
| Encryption in Transit | [e.g., TLS 1.2+] |

### Section 5.2 -- CAPABILITY_MATRIX Assessment

For each of the 12 remediation action types, assess the new connector's capability:

| Action Type | Mode (native/catalog_update/unsupported) | Implementation Notes |
|------------|------------------------------------------|---------------------|
| revoke_access | [mode] | [notes] |
| encrypt | [mode] | [notes] |
| enable_mfa | [mode] | [notes] |
| apply_retention | [mode] | [notes] |
| restrict_public | [mode] | [notes] |
| delete_data | [mode] | [notes] |
| mask_data | [mode] | [notes] |
| quarantine | [mode] | [notes] |
| rotate_credentials | [mode] | [notes] |
| restrict_sharing | [mode] | [notes] |
| disable_public_access | [mode] | [notes] |
| enforce_encryption | [mode] | [notes] |

### Section 5.3 -- DSAR Capability Assessment

| DSAR Right | Supported | Implementation Method | Limitations |
|-----------|-----------|----------------------|-------------|
| Right of Access (Art. 15) | [Yes/No/Partial] | [e.g., API query with pagination] | [any limitations] |
| Right to Rectification (Art. 16) | [Yes/No/Partial] | [e.g., API update call] | |
| Right to Erasure (Art. 17) | [Yes/No/Partial] | [e.g., API delete with cascade] | |
| Right to Portability (Art. 20) | [Yes/No/Partial] | [e.g., Bulk export API] | |
| Right to Restriction (Art. 18) | [Yes/No/Partial] | [e.g., Field masking] | |

### Section 5.4 -- Connector Data Flow Diagram

Describe the data flow for the new connector:

1. **Authentication:** How the platform authenticates to the connector.
2. **Discovery:** How the connector enumerates data assets (tables, objects, records).
3. **Scanning:** How the connector samples data for classification.
4. **Remediation:** How the connector executes remediation actions.
5. **Event Propagation:** How scan results and status changes flow through NATS JetStream.

---

## 6. Cross-Border Transfer Evaluation

Complete this section when data crosses jurisdictional boundaries.

### Section 6.1 -- Transfer Details

| Field | Value |
|-------|-------|
| Source Jurisdiction | [e.g., European Union] |
| Destination Jurisdiction | [e.g., United States] |
| Adequacy Decision Exists | [Yes/No] |
| Transfer Mechanism | [SCCs / BCRs / Derogation / Adequacy] |
| Connector(s) Involved | [e.g., aws_s3 (eu-west-1 to us-east-1)] |
| Data Classification(s) | [e.g., PII, PHI] |

### Section 6.2 -- Transfer Impact Assessment (Schrems II)

| Assessment Area | Finding |
|----------------|---------|
| Legal framework of destination country | [Assessment of surveillance laws, government access] |
| Supplementary measures required | [e.g., Additional encryption, pseudonymization] |
| Effective remedies available to data subjects | [Assessment] |
| Risk level | [Low / Medium / High / Unacceptable] |

### Section 6.3 -- Safeguards

| Safeguard | Implemented | Platform Control |
|-----------|-------------|-----------------|
| End-to-end encryption | [Yes/No] | [TECHD-ENC-003 reference] |
| Pseudonymization | [Yes/No] | [mask_data remediation action] |
| Access restrictions | [Yes/No] | [ABAC policy with geographic attribute] |
| Audit logging | [Yes/No] | [SHA256 hash chain on all cross-border access] |

---

## 7. Vendor Risk Assessment

Complete this section when integrating a new third-party vendor.

### Section 7.1 -- Vendor Profile

| Field | Value |
|-------|-------|
| Vendor Name | [e.g., Anthropic] |
| Service Description | [e.g., AI language model API for data analysis co-pilot] |
| Data Shared with Vendor | [e.g., Redacted metadata only -- PII stripped by pre-send pipeline] |
| Vendor DPA in Place | [Yes/No] |
| Vendor SOC 2 / ISO 27001 | [Certification status] |
| Sub-processor List Available | [Yes/No] |

### Section 7.2 -- Vendor Data Processing

| Question | Response |
|----------|----------|
| Does the vendor store platform data? | [Yes/No, duration] |
| Does the vendor use data for model training? | [Yes/No, contractual prohibition] |
| Can the vendor access unredacted PII? | [No -- fail-closed PII redaction pipeline] |
| What happens on vendor service failure? | [Circuit breaker: 5 failures/60s triggers open state] |
| Vendor data deletion on contract termination | [Process description] |

---

## 8. Risk Assessment

### Section 8.1 -- Privacy Risk Matrix

| Risk | Likelihood (1-5) | Impact (1-5) | Risk Score | Mitigation |
|------|-------------------|-------------|------------|------------|
| Unauthorized access to personal data | | | | [7-layer guard pipeline, RLS] |
| Cross-tenant data leakage | | | | [RLS on 60 tables, Tenant Guard] |
| DSAR response contains unredacted PII | | | | [Fail-closed redaction, download block] |
| Data retained beyond retention period | | | | [Temporal RETENTION workflows] |
| PII sent to AI provider | | | | [Pre-send redaction, circuit breaker, feature gate] |
| Legal hold violation | | | | [LegalHold RLS enforcement] |
| Audit log tampering | | | | [SHA256 hash chain, advisory locks] |
| Cross-border transfer without legal basis | | | | [Transfer assessment, ABAC geo-restrictions] |

### Section 8.2 -- Residual Risk Assessment

After applying all mitigations, document the residual risk for each identified risk:

| Risk | Residual Risk Level | Accepted By | Conditions |
|------|---------------------|-------------|------------|
| | [Low/Medium/High] | [Role] | [Any conditions for acceptance] |

---

## 9. Recommendations and Decision

### Section 9.1 -- DPO Recommendations

| # | Recommendation | Priority | Implementation Timeline |
|---|---------------|----------|------------------------|
| 1 | | [Critical/High/Medium/Low] | |
| 2 | | | |
| 3 | | | |

### Section 9.2 -- Decision

| Decision | [Approved / Approved with Conditions / Rejected / Deferred] |
|----------|-------------------------------------------------------------|
| Decision Date | [YYYY-MM-DD] |
| DPO Signature | [Name] |
| CISO Signature (if required) | [Name] |
| Conditions (if applicable) | [List conditions] |
| Review Date | [YYYY-MM-DD] |

---

## 10. Post-Implementation Review

A post-implementation review must be conducted within 90 days of production deployment:

| Review Item | Status | Notes |
|-------------|--------|-------|
| All PIA conditions met | [Yes/No] | |
| Controls functioning as designed | [Yes/No] | |
| No unexpected data processing | [Yes/No] | |
| Audit logging covers new activity | [Yes/No] | |
| DSAR workflows tested for new data | [Yes/No] | |
| Classification rules updated | [Yes/No] | |
| Retention policies configured | [Yes/No] | |

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Data Classification Policy | TECHD-DCP-002 |
| Access Control Policy | TECHD-ACP-004 |
| Data Retention Policy | TECHD-DRP-006 |
| Third-Party Risk Policy | TECHD-TPR-009 |
| Compliance Matrix | TECHD-CM-012 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | DPO | Initial template release |
| 2.0 | 2026-05-10 | DPO | Added IConnector assessment, CAPABILITY_MATRIX evaluation, AI vendor risk, cross-border TIA, post-implementation review |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
