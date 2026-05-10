# TechD PrivacyOps + DSPM Platform -- Compliance Matrix

**Document ID:** TECHD-CM-012
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Chief Information Security Officer (CISO)
**Effective Date:** 2026-05-10
**Review Cycle:** Semi-annual (next review: 2026-11-10)

---

## 1. Purpose and Scope

This document maps regulatory and framework requirements to TechD PrivacyOps + DSPM platform controls, identifies evidence collection procedures for each control, documents gaps, and outlines the certification timeline. It covers GDPR, CCPA/CPRA, HIPAA, SOC 2 Type II, and ISO 27001:2022.

---

## 2. GDPR (General Data Protection Regulation) Mapping

### 2.1 Core Requirements

| GDPR Article | Requirement | Platform Control | Evidence Source | Status |
|-------------|-------------|-----------------|-----------------|--------|
| Art. 5(1)(a) | Lawfulness, fairness, transparency | Data Classification Policy (TECHD-DCP-002), consent tracking in catalog metadata | Audit log: `data.classification.change` events | Implemented |
| Art. 5(1)(b) | Purpose limitation | Retention policies per processing purpose, RETENTION task queue enforcement | Catalog metadata: `retention_policy_id`, `processing_purpose` | Implemented |
| Art. 5(1)(c) | Data minimization | DSPM scanning detects over-collection, remediation via `delete_data` and `mask_data` actions | Scan results, remediation action logs | Implemented |
| Art. 5(1)(d) | Accuracy | DSAR rectification workflows via DSAR task queue | DSAR audit events: `dsar.request.completed` | Implemented |
| Art. 5(1)(e) | Storage limitation | Temporal RETENTION workflows with `apply_retention` action | Retention enforcement logs, catalog `retention_status` | Implemented |
| Art. 5(1)(f) | Integrity and confidentiality | 7-layer guard pipeline, RLS on 60 tables, AES-256 encryption, HMAC event signing | Guard rejection logs, encryption config, RLS policies | Implemented |
| Art. 5(2) | Accountability | SHA256 hash chain audit logging, tamper-evident design | Audit log with hash chain verification report | Implemented |
| Art. 6 | Lawful basis for processing | Legal basis tracked per data processing activity in catalog | Catalog metadata: `legal_basis` field | Implemented |
| Art. 12 | Transparent communication for DSARs | DSAR workflow with configurable response templates | DSAR response audit trail | Implemented |
| Art. 13-14 | Information to data subjects | Privacy notice management (tenant-configurable) | Tenant configuration records | Implemented |
| Art. 15 | Right of access | DSAR task queue: subject access request workflow | `dsar.request.completed` audit events | Implemented |
| Art. 16 | Right to rectification | DSAR task queue: rectification workflow | `dsar.request.completed` + `data.update` events | Implemented |
| Art. 17 | Right to erasure | DSAR task queue + DATA_DELETION queue, `delete_data` remediation action | `dsar.request.completed` + `remediation.delete_data` events | Implemented |
| Art. 18 | Right to restriction | `mask_data` and `quarantine` remediation actions | `remediation.action.completed` events | Implemented |
| Art. 20 | Right to data portability | DSAR export workflow with structured data output (JSON/CSV) | `dsar.export.generated` audit events | Implemented |
| Art. 25 | Data protection by design | 7-layer guard pipeline, fail-closed DSAR redaction, RLS by default | Architecture documentation, code review records | Implemented |
| Art. 28 | Processor obligations | DPA management, sub-processor tracking, VENDOR task queue | Vendor assessment records, signed DPAs | Implemented |
| Art. 30 | Records of processing activities | Automated ROPA generation from data catalog and audit logs | Generated ROPA reports | Implemented |
| Art. 32 | Security of processing | Full security control suite (encryption, access control, audit logging, incident response) | All security policy documents (TECHD-ISP-001 through TECHD-DRP-011) | Implemented |
| Art. 33 | Breach notification (authority) | BREACH task queue: 72-hour notification workflow | `system.workflow.completed` for BREACH queue | Implemented |
| Art. 34 | Breach notification (subjects) | BREACH task queue: subject notification workflow | Breach notification delivery records | Implemented |
| Art. 35 | Data protection impact assessment | PIA template (TECHD-PIA-007), triggered for new connectors and processing activities | Completed PIA records | Implemented |
| Art. 44-49 | Cross-border transfers | Transfer Impact Assessment in PIA, ABAC geo-restriction policies | PIA records, ABAC policy definitions | Implemented |

### 2.2 GDPR Evidence Collection

| Evidence Type | Collection Method | Frequency | Retention |
|--------------|-------------------|-----------|-----------|
| DSAR fulfillment records | Automated from DSAR task queue audit events | Per DSAR | 6 years |
| Data processing inventory | Generated from catalog metadata + connector scan results | Quarterly | Current + 2 prior versions |
| Consent records | Extracted from tenant consent management data | Real-time | Duration of processing + 6 years |
| Breach notification evidence | BREACH task queue workflow artifacts | Per incident | 6 years |
| PIA records | Completed PIA documents (TECHD-PIA-007) | Per assessment | 6 years |

---

## 3. CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act) Mapping

| CCPA/CPRA Section | Requirement | Platform Control | Status |
|-------------------|-------------|-----------------|--------|
| 1798.100 | Right to know categories of PI collected | Data catalog with classification tiers (PII, PHI, PCI, Confidential, Internal, Public) | Implemented |
| 1798.105 | Right to delete | DSAR deletion workflow + `delete_data` remediation action | Implemented |
| 1798.106 | Right to correct | DSAR rectification workflow | Implemented |
| 1798.110 | Right to know specific pieces of PI | DSAR subject access workflow with connector-level data retrieval | Implemented |
| 1798.115 | Right to know about sharing/selling | Data flow tracking in catalog, cross-connector lineage | Implemented |
| 1798.120 | Right to opt-out of sale/sharing | Opt-out flag in tenant configuration, enforced via ABAC | Implemented |
| 1798.121 | Right to limit use of sensitive PI | Classification-based access controls (ABAC policies for PII/PHI/PCI) | Implemented |
| 1798.125 | Right to non-discrimination | Tenant-level configuration, no service degradation on opt-out | Implemented |
| 1798.130 | Response timing (45 days) | DSAR workflow SLA tracking, automated deadline monitoring | Implemented |
| 1798.135 | Clear opt-out link requirement | Tenant-configurable privacy portal | Implemented |
| 1798.140 | Definition of personal information | Mapped to platform classification tiers (PII encompasses CCPA PI definition) | Implemented |
| 1798.150 | Private right of action (breach) | BREACH task queue with notification workflow, audit evidence | Implemented |
| 1798.185 | CPRA additional categories | Geolocation, biometric data classifiers in DSPM scanning engine | Implemented |

---

## 4. HIPAA (Health Insurance Portability and Accountability Act) Mapping

| HIPAA Section | Requirement | Platform Control | Status |
|--------------|-------------|-----------------|--------|
| 164.308(a)(1) | Security management process | Information Security Policy (TECHD-ISP-001), risk assessments | Implemented |
| 164.308(a)(2) | Assigned security responsibility | Defined roles: CISO, Security Engineering Lead, DPO | Implemented |
| 164.308(a)(3) | Workforce security | RBAC roles, MFA enforcement for PHI access via ABAC, access reviews | Implemented |
| 164.308(a)(4) | Information access management | 7-layer guard pipeline, RBAC, ABAC with PHI-specific policies | Implemented |
| 164.308(a)(5) | Security awareness training | Training program (tracked outside platform) | Implemented |
| 164.308(a)(6) | Security incident procedures | BREACH task queue, incident response procedures | Implemented |
| 164.308(a)(7) | Contingency plan | BCP (TECHD-BCP-010), DR Plan (TECHD-DRP-011) | Implemented |
| 164.308(a)(8) | Evaluation | Penetration testing (TECHD-PTP-008), annual security assessment | Implemented |
| 164.310(a) | Facility access controls | Cloud provider physical security (SOC 2 certified) | Inherited |
| 164.310(b) | Workstation use | Endpoint security (outside platform scope) | Policy-covered |
| 164.310(c) | Workstation security | Endpoint security (outside platform scope) | Policy-covered |
| 164.310(d) | Device and media controls | Encrypted storage, secure deletion via `delete_data` action | Implemented |
| 164.312(a)(1) | Access control | 7-layer guard pipeline, unique user IDs, MFA (otplib) | Implemented |
| 164.312(a)(2)(i) | Unique user identification | UUID-based user identifiers, no shared accounts | Implemented |
| 164.312(a)(2)(ii) | Emergency access procedure | Break-glass procedure documented in Access Control Policy | Implemented |
| 164.312(a)(2)(iii) | Automatic logoff | Configurable session timeout (default: 30 min idle, 12 hr absolute) | Implemented |
| 164.312(a)(2)(iv) | Encryption and decryption | AES-256 at rest, TLS 1.2+ in transit, HMAC-SHA256 event signing | Implemented |
| 164.312(b) | Audit controls | SHA256 hash chain audit logging, tamper-evident | Implemented |
| 164.312(c) | Integrity | Hash chain integrity, HMAC event signing, RLS enforcement | Implemented |
| 164.312(d) | Person or entity authentication | passport-jwt, passport-saml, passport-openidconnect, MFA | Implemented |
| 164.312(e) | Transmission security | TLS 1.2+ on all connections, Helmet HTTP headers | Implemented |
| 164.314 | Business associate contracts | DPA/BAA management via VENDOR task queue | Implemented |
| 164.316 | Policies and procedures | Full policy suite (TECHD-ISP-001 through TECHD-CM-012) | Implemented |
| 164.530(j) | Retention of documentation | 6-year retention for PHI-related records | Implemented |

---

## 5. SOC 2 Type II (Trust Services Criteria) Mapping

| TSC | Criteria | Platform Control | Evidence |
|-----|----------|-----------------|----------|
| CC1.1 | COSO -- Integrity and ethical values | Code of conduct, security policies | Policy documents |
| CC1.2 | Board oversight | Security Review Board, Privacy Governance Committee | Meeting minutes |
| CC1.3 | Management structure | Defined RACI for security roles | Org chart, policy ownership |
| CC2.1 | Information quality | Data classification (6 tiers), classification confidence scoring | Scan results, classification reports |
| CC3.1 | Risk assessment objectives | Quantitative risk framework in ISP (TECHD-ISP-001) | Risk register, quarterly assessments |
| CC3.2 | Risk identification | Platform-specific risk categories, vendor risk scoring | Risk assessment reports |
| CC3.3 | Fraud risk assessment | ABAC policies, approval workflows, segregation of duties | ABAC policy definitions, approval logs |
| CC4.1 | Monitoring activities | Health checks, guard pipeline logging, hash chain verification | Monitoring dashboards, alert history |
| CC4.2 | Evaluation and communication of deficiencies | Penetration testing (TECHD-PTP-008), DR drills | Pen test reports, drill reports |
| CC5.1 | Control activities selection | 7-layer guard pipeline, RLS, encryption | Architecture documentation |
| CC5.2 | Technology general controls | CI/CD security, dependency scanning, infrastructure-as-code | Pipeline config, scan reports |
| CC5.3 | Control activities deployment | Automated enforcement via Temporal workflows and RemediationExecutorService | Workflow execution logs |
| CC6.1 | Logical access security | 7-layer guard pipeline, RBAC, ABAC, MFA | Guard logs, role assignments |
| CC6.2 | Access provisioning | Role-based provisioning, least privilege, access reviews | Provisioning logs, review records |
| CC6.3 | Access removal | Immediate revocation on termination, token invalidation | Revocation audit events |
| CC6.6 | System boundary protection | Helmet headers, CORS, TLS, network segmentation | Configuration evidence |
| CC6.7 | Information restriction | Data classification-based access, ABAC policies | Classification metadata, ABAC policies |
| CC6.8 | Prevention of unauthorized software | Container image signing, dependency scanning | Image signatures, scan results |
| CC7.1 | Vulnerability management | Penetration testing, SAST/DAST, dependency scanning | Pen test reports, scan dashboards |
| CC7.2 | Security event monitoring | Audit logging (SHA256 hash chain), SIEM integration | Audit logs, SIEM dashboards |
| CC7.3 | Detection procedures | Guard pipeline rejection logging, hash chain verification, circuit breaker monitoring | Alert configurations, monitoring setup |
| CC7.4 | Incident response | BREACH task queue workflow, communication plan | Incident reports, workflow logs |
| CC7.5 | Incident recovery | BCP (TECHD-BCP-010), DR Plan (TECHD-DRP-011) | DR drill reports |
| CC8.1 | Change management | CI/CD pipeline, PR review, Prisma migration versioning | Git history, PR reviews |
| CC9.1 | Risk mitigation | RemediationExecutorService with 12 action types, CAPABILITY_MATRIX | Remediation execution logs |
| CC9.2 | Vendor risk management | Third-Party Risk Policy (TECHD-TPR-009), vendor risk scoring | Vendor assessments |
| A1.1 | Availability commitments | SLA definitions, BCP, DR plan | SLA documents, BCP/DR plans |
| A1.2 | Availability mechanisms | Multi-AZ, failover procedures, health monitoring | Architecture docs, failover logs |
| A1.3 | Recovery testing | DR drills (annual full, monthly partial) | Drill reports |
| C1.1 | Confidentiality commitments | Data classification, encryption at rest/transit | Classification policies, encryption config |
| C1.2 | Confidentiality controls | RLS, ABAC, encryption, AI PII redaction | RLS policies, ABAC definitions, redaction logs |
| PI1.1 | Privacy notice | Tenant-configurable privacy notices | Notice configurations |
| PI1.2 | Privacy choice/consent | Consent management, opt-out mechanisms | Consent records |
| PI1.3 | Personal information collection | DSPM scanning, classification | Scan results, classification metadata |
| PI1.4 | Use and retention | Data retention policies, RETENTION task queue | Retention logs |
| PI1.5 | Disposal | `delete_data` and `apply_retention` actions, secure deletion | Deletion audit events |
| PI1.6 | Disclosure | DSAR workflows, cross-border transfer controls | DSAR logs, transfer records |
| PI1.7 | Quality | Data quality monitoring in scan results | Scan quality metrics |
| PI1.8 | Monitoring and enforcement | Compliance dashboards, automated scanning | Dashboard screenshots, scan schedules |

---

## 6. ISO 27001:2022 Mapping

| Control | Description | Platform Control | Status |
|---------|-------------|-----------------|--------|
| A.5.1 | Policies for information security | Full policy suite (12 documents) | Implemented |
| A.5.2 | Information security roles | CISO, Security Engineering Lead, DPO, defined RACI | Implemented |
| A.5.3 | Segregation of duties | Approval Guard for sensitive ops, ABAC, separate roles | Implemented |
| A.5.7 | Threat intelligence | CVE monitoring, vendor security advisory tracking | Implemented |
| A.5.23 | Cloud service security | Cloud provider assessments (TECHD-TPR-009), shared responsibility model | Implemented |
| A.5.29 | Information security during disruption | BCP (TECHD-BCP-010), DR Plan (TECHD-DRP-011) | Implemented |
| A.5.30 | ICT readiness for business continuity | DR drills, failover testing, backup verification | Implemented |
| A.6.1 | Screening | Background checks for platform personnel | Implemented |
| A.6.3 | Information security awareness | Security training program | Implemented |
| A.7.1 | Physical security perimeters | Cloud provider responsibility (verified via SOC 2) | Inherited |
| A.8.1 | User endpoint devices | Endpoint security policy | Policy-covered |
| A.8.2 | Privileged access | Privileged access management per TECHD-ACP-004 | Implemented |
| A.8.3 | Information access restriction | 7-layer guard pipeline, classification-based ABAC | Implemented |
| A.8.4 | Access to source code | Repository access controls, PR reviews | Implemented |
| A.8.5 | Secure authentication | passport-jwt, passport-saml, passport-openidconnect, MFA (otplib) | Implemented |
| A.8.7 | Protection against malware | Container scanning, dependency scanning, runtime protection | Implemented |
| A.8.8 | Technical vulnerability management | Pen testing (TECHD-PTP-008), SAST/DAST, dependency scanning | Implemented |
| A.8.9 | Configuration management | Infrastructure-as-code, Prisma migration versioning | Implemented |
| A.8.10 | Information deletion | `delete_data` action, `apply_retention`, secure wipe | Implemented |
| A.8.11 | Data masking | `mask_data` remediation action, DSAR redaction pipeline | Implemented |
| A.8.12 | Data leakage prevention | AI PII redaction (fail-closed), classification-based access, RLS | Implemented |
| A.8.15 | Logging | SHA256 hash chain audit logging, tamper-evident | Implemented |
| A.8.16 | Monitoring | Guard pipeline monitoring, workflow metrics, circuit breaker alerts | Implemented |
| A.8.20 | Networks security | TLS 1.2+, VPC isolation, security groups, CORS | Implemented |
| A.8.24 | Use of cryptography | Encryption Standards (TECHD-ENC-003), AES-256, HMAC-SHA256 | Implemented |
| A.8.25 | Secure development lifecycle | SAST, code review, security testing in CI/CD | Implemented |
| A.8.28 | Secure coding | Input validation, parameterized queries (Prisma), output encoding | Implemented |

---

## 7. Gap Analysis

### 7.1 Identified Gaps

| Gap ID | Regulation | Requirement | Current State | Remediation Plan | Target Date | Priority |
|--------|-----------|-------------|---------------|-----------------|-------------|----------|
| GAP-001 | ISO 27001 A.5.24 | Incident management planning and preparation | BREACH task queue exists but formal incident classification matrix needs documentation | Document formal incident classification aligned with ISO 27001 | 2026-Q3 | Medium |
| GAP-002 | SOC 2 CC1.4 | Accountability for internal control | Control ownership documented but RACI matrix for all 12 remediation actions needs formalization | Create RACI matrix for RemediationExecutorService actions | 2026-Q3 | Medium |
| GAP-003 | HIPAA 164.308(a)(5) | Security awareness training | Training program exists but lacks platform-specific PHI handling module | Develop PHI-specific training module | 2026-Q3 | High |
| GAP-004 | GDPR Art. 27 | Representative in the EU | No EU representative appointed | Engage EU representative service | 2026-Q4 | High |
| GAP-005 | ISO 27001 A.5.6 | Contact with special interest groups | No formal participation in ISACs | Evaluate and join relevant ISACs | 2026-Q4 | Low |

### 7.2 Gap Remediation Tracking

All gaps are tracked in the platform's internal GRC module with:

- Owner assignment and accountability.
- Target remediation date.
- Progress updates (monthly minimum).
- Evidence of closure reviewed by the CISO.

---

## 8. Evidence Collection Procedures

### 8.1 Automated Evidence Collection

| Evidence Type | Collection Tool | Frequency | Storage |
|--------------|----------------|-----------|---------|
| Audit log exports (with hash chain) | Platform audit export API | Daily | Encrypted compliance archive |
| Guard pipeline rejection reports | Audit log query + aggregation | Weekly | Compliance dashboard |
| RLS enforcement verification | Custom RLS test suite | Monthly | Test execution reports |
| Encryption configuration status | SCAN queue + infrastructure scan | Monthly | Compliance dashboard |
| DSAR fulfillment metrics | DSAR workflow query | Monthly | Compliance dashboard |
| Remediation action history | Audit log query | Monthly | Compliance archive |
| Connector health and compliance | Connector health monitoring | Real-time | Monitoring system |

### 8.2 Manual Evidence Collection

| Evidence Type | Responsibility | Frequency | Storage |
|--------------|---------------|-----------|---------|
| Penetration test reports | CISO | Per engagement | Encrypted document store |
| DR drill reports | Platform Engineering Lead | Per drill | Encrypted document store |
| Vendor assessment reports | Vendor Risk Committee | Per assessment | Vendor management system |
| PIA completion records | DPO | Per assessment | GRC module |
| Policy review records | Policy owners | Per review cycle | GRC module |
| Training completion records | HR/Security | Quarterly | HR system |

### 8.3 Evidence Integrity

- All automated evidence exports include the SHA256 hash chain for tamper verification.
- Evidence packages are signed with the platform's evidence signing key.
- Evidence retention: minimum 6 years for regulatory evidence, 3 years for operational evidence.
- Evidence access is logged in the audit chain.

---

## 9. Certification Timeline

| Certification | Current Status | Target Date | Dependencies |
|--------------|---------------|-------------|-------------|
| SOC 2 Type I | Preparation | 2026-Q3 | Gap remediation (GAP-001, GAP-002) |
| SOC 2 Type II | Planned | 2027-Q1 (observation period start) | SOC 2 Type I completion |
| ISO 27001:2022 | Preparation | 2026-Q4 (Stage 1 audit) | Gap remediation (GAP-001, GAP-005) |
| ISO 27001:2022 | Certification | 2027-Q1 (Stage 2 audit) | Stage 1 completion |
| HIPAA Attestation | Preparation | 2026-Q3 | GAP-003 (training module) |
| PCI DSS (SAQ-A) | Assessment | 2026-Q4 | Stripe PCI compliance inheritance verified |
| GDPR Compliance | Ongoing | Continuous | GAP-004 (EU representative) |
| CCPA/CPRA Compliance | Ongoing | Continuous | No outstanding gaps |

### 9.1 Certification Maintenance

| Certification | Renewal Cycle | Effort | Key Activities |
|--------------|--------------|--------|---------------|
| SOC 2 Type II | Annual | 3-4 months | Auditor engagement, evidence collection, control testing |
| ISO 27001 | Annual surveillance, 3-year recertification | 2-3 months (surveillance), 4-5 months (recertification) | Internal audit, management review, external audit |
| HIPAA | Annual risk assessment | 1-2 months | Risk assessment, policy review, training |
| PCI DSS | Annual SAQ | 1 month | Self-assessment questionnaire, Stripe compliance verification |

---

## 10. Regulatory Change Monitoring

| Activity | Responsibility | Frequency |
|----------|---------------|-----------|
| GDPR regulatory guidance monitoring | DPO | Monthly |
| US state privacy law tracking (CCPA/CPRA, Virginia, Colorado, Connecticut, etc.) | DPO | Monthly |
| HIPAA rulemaking and OCR guidance | Compliance Officer | Monthly |
| SOC 2 TSC updates (AICPA) | CISO | Quarterly |
| ISO 27001 standard updates (ISO/IEC) | CISO | Annually |
| PCI DSS version updates (PCI SSC) | Security Engineering Lead | Quarterly |
| New jurisdiction data protection laws | DPO + Legal | Monthly |

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Data Classification Policy | TECHD-DCP-002 |
| Encryption Standards | TECHD-ENC-003 |
| Access Control Policy | TECHD-ACP-004 |
| Audit Logging Policy | TECHD-ALP-005 |
| Data Retention Policy | TECHD-DRP-006 |
| Privacy Impact Assessment Template | TECHD-PIA-007 |
| Penetration Testing Policy | TECHD-PTP-008 |
| Third-Party Risk Policy | TECHD-TPR-009 |
| Business Continuity Plan | TECHD-BCP-010 |
| Disaster Recovery Plan | TECHD-DRP-011 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | CISO | Initial release covering GDPR and SOC 2 |
| 2.0 | 2026-05-10 | CISO | Added CCPA/CPRA, HIPAA, ISO 27001 mappings, gap analysis, certification timeline, evidence collection procedures, regulatory change monitoring |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
