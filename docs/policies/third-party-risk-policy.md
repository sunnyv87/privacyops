# TechD PrivacyOps + DSPM Platform -- Third-Party Risk Policy

**Document ID:** TECHD-TPR-009
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** CISO
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy establishes the third-party risk management framework for the TechD PrivacyOps + DSPM platform. It covers risk assessment, onboarding, ongoing monitoring, and offboarding for all third-party vendors, including the 43 registered connector vendors, cloud infrastructure providers, the AI provider (Anthropic), payment processor (Stripe), identity providers, and any other service dependencies.

---

## 2. Third-Party Classification

### 2.1 Vendor Tiers

| Tier | Definition | Assessment Depth | Review Frequency |
|------|-----------|-----------------|-----------------|
| Tier 1 -- Critical | Direct access to customer data or critical platform function | Full assessment | Quarterly |
| Tier 2 -- High | Processes or stores platform metadata or supports key functions | Standard assessment | Semi-annually |
| Tier 3 -- Medium | Limited data exposure, non-critical function | Abbreviated assessment | Annually |
| Tier 4 -- Low | No data access, commodity service | Self-assessment questionnaire | Bi-annually |

### 2.2 Current Vendor Tier Assignments

| Vendor/Category | Tier | Justification |
|----------------|------|---------------|
| Cloud Infrastructure (AWS, Azure, GCP) | Tier 1 | Hosts all platform data and compute |
| Anthropic (Claude AI) | Tier 1 | Receives platform data (post-redaction) for AI processing |
| Stripe | Tier 1 | Processes payment data, billing metadata |
| Database Connector Vendors (PostgreSQL, MySQL, SQL Server, MongoDB, Snowflake, BigQuery) | Tier 1 | Platform connects directly to customer databases |
| Object Storage Vendors (S3, Azure Blob, GCP Storage) | Tier 1 | Platform accesses customer object stores |
| SaaS Connectors (Salesforce, Okta) | Tier 2 | API-based access to customer SaaS data |
| Identity Providers (SAML/OIDC) | Tier 2 | Authentication delegation |
| Monitoring/Observability Tools | Tier 3 | Receives operational telemetry |
| CI/CD Pipeline Tools | Tier 3 | Accesses source code |
| DNS/CDN Providers | Tier 4 | No data access |

---

## 3. Connector Vendor Assessment

### 3.1 Assessment Requirements for Connector Vendors

Each vendor whose platform the PrivacyOps connectors access must be assessed for:

| Assessment Area | Requirements | Evidence |
|----------------|-------------|----------|
| Security Certifications | SOC 2 Type II, ISO 27001, or equivalent | Current certification report |
| Encryption | At-rest and in-transit encryption capabilities | Documentation of encryption methods |
| Access Controls | Authentication methods, authorization granularity | API documentation, IAM capabilities |
| Data Residency | Available regions, data sovereignty controls | Region availability documentation |
| Incident Response | Breach notification process, SLAs | Incident response plan, DPA |
| Sub-processors | List of sub-processors, notification of changes | Sub-processor list, DPA terms |
| Data Processing Agreement | GDPR-compliant DPA | Signed DPA |

### 3.2 Connector-Specific Risk Profiles

| Connector | Data Sensitivity | Access Pattern | Key Risks |
|-----------|-----------------|----------------|-----------|
| aws_s3 | Variable (PII, PHI, PCI possible) | Object read/write, lifecycle management | Misconfigured bucket policies, public access |
| postgresql | Variable (structured PII/PHI/PCI) | SQL read/write via connection pooling | SQL injection via connector, credential exposure |
| mysql | Variable (structured PII/PHI/PCI) | SQL read/write via connection pooling | SQL injection via connector, credential exposure |
| snowflake | Variable (analytics data, may contain PII) | SQL read via Snowflake driver | Query result caching, warehouse cost exposure |
| mongodb | Variable (document PII) | Document read/write | NoSQL injection, schema-less data sprawl |
| salesforce | PII (customer records) | REST/Bulk API | OAuth scope escalation, API rate limits |
| okta | PII (user profiles, auth events) | REST API | User enumeration, directory exposure |
| azure_blob | Variable | Blob read/write, lifecycle management | Shared Access Signature (SAS) token exposure |
| gcp_storage | Variable | Object read/write, lifecycle management | IAM misconfiguration, public bucket |
| sqlserver | Variable (structured PII/PHI/PCI) | SQL read/write via TDS | Windows auth bypass, linked server exposure |
| bigquery | Variable (analytics data, may contain PII) | SQL read via BigQuery API | Dataset permission escalation, cost exposure |

---

## 4. Cloud Provider Risk Assessment

### 4.1 AWS Risk Profile

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data sovereignty | Regions selected per tenant requirements | Region-specific deployment, data residency controls |
| Government access (CLOUD Act) | US law may compel disclosure | Encryption with customer-managed keys, contractual protections |
| Service outage | Regional and zonal failures possible | Multi-AZ deployment, cross-region DR plan |
| Shared responsibility | AWS manages infrastructure security | Platform manages application security, IAM, encryption keys |
| Compliance | SOC 2, ISO 27001, HIPAA BAA, PCI DSS | Compliance artifacts reviewed annually |

### 4.2 Azure Risk Profile

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data sovereignty | Azure regions in 60+ countries | Tenant-selected region deployment |
| Government access | Subject to US and local jurisdiction laws | Customer-managed encryption keys, Azure Confidential Computing option |
| Service outage | Regional failures, global DNS incidents | Multi-region deployment, failover procedures |
| Compliance | SOC 2, ISO 27001, HIPAA BAA, PCI DSS | Compliance artifacts reviewed annually |

### 4.3 GCP Risk Profile

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data sovereignty | Regions in 35+ countries | Tenant-selected region, VPC Service Controls |
| Government access | Subject to US jurisdiction | CMEK, Access Transparency logs |
| Service outage | Regional and multi-regional failures | Cross-region replication, failover |
| Compliance | SOC 2, ISO 27001, HIPAA BAA, PCI DSS | Compliance artifacts reviewed annually |

---

## 5. AI Provider Risk Assessment (Anthropic)

### 5.1 Risk Profile

| Risk Area | Assessment | Platform Mitigation |
|-----------|-----------|-------------------|
| Data exposure | Prompts sent to Claude may contain sensitive context | Pre-send PII redaction pipeline (fail-closed) |
| Model training on customer data | Risk of data retention for training | Contractual prohibition on training use, API terms review |
| Service availability | API outages affect AI co-pilot features | Circuit breaker (5 failures/60s), graceful degradation |
| Response accuracy | AI may generate incorrect security recommendations | Human-in-the-loop for all remediation actions |
| Prompt injection | Adversarial input may manipulate AI responses | Input sanitization, output validation |
| Data residency | Anthropic's processing location may not align with tenant requirements | Tenant-level ai_llm_enrichment feature gate allows opt-out |
| Sub-processor changes | Anthropic may engage new sub-processors | Contractual notification requirements |

### 5.2 Platform Controls for AI Risk

| Control | Implementation |
|---------|---------------|
| PII Redaction | Pre-send pipeline strips PII before API call; fail-closed on error |
| Feature Gate | Tenant-level `ai_llm_enrichment` gate; disabled by default for PHI/PCI tenants |
| Circuit Breaker | Opens after 5 failures in 60 seconds; prevents cascading failures |
| Audit Logging | All AI requests and responses logged (redacted versions) in hash chain |
| Data Minimization | Only necessary context sent; full documents never transmitted |
| Response Sanitization | AI responses validated before display or action |

---

## 6. Payment Processor Risk Assessment (Stripe)

### 6.1 Risk Profile

| Risk Area | Assessment | Platform Mitigation |
|-----------|-----------|-------------------|
| Payment data exposure | Stripe handles PCI-scoped data | Platform never stores card data; Stripe.js for client-side tokenization |
| Billing metadata | Subscription, usage, and invoice data | Encrypted at rest, access restricted to billing_service role |
| Service availability | Stripe outages affect billing operations | NullBillingProvider with production startup guard prevents accidental non-billing operation |
| Webhook integrity | Webhook events could be spoofed | Stripe webhook signature verification |
| Compliance | PCI DSS Level 1 certified | Stripe's PCI compliance covers payment processing |

### 6.2 NullBillingProvider Production Guard

The platform includes a NullBillingProvider for development/testing environments. A production startup guard ensures:

- The application will not start in production if NullBillingProvider is configured.
- This prevents accidental deployment without a valid Stripe configuration.
- The guard validates Stripe API key format and connectivity at startup.

---

## 7. Risk Scoring Framework

### 7.1 Vendor Risk Score Calculation

```
Vendor Risk Score = (Data Sensitivity x 0.30) + (Access Level x 0.25) + (Security Posture x 0.20) + (Compliance x 0.15) + (Business Dependency x 0.10)
```

| Factor | Score Range | Criteria |
|--------|-----------|----------|
| Data Sensitivity | 1-5 | 1=Public data only, 5=PII/PHI/PCI direct access |
| Access Level | 1-5 | 1=No data access, 5=Read/write to customer data |
| Security Posture | 1-5 | 1=SOC2+ISO27001+pentest, 5=No certifications |
| Compliance | 1-5 | 1=Full regulatory compliance, 5=No compliance program |
| Business Dependency | 1-5 | 1=Easily replaceable, 5=Single point of failure |

### 7.2 Risk Score Thresholds

| Score Range | Risk Level | Action Required |
|-------------|-----------|-----------------|
| 1.0 - 2.0 | Low | Standard monitoring |
| 2.1 - 3.0 | Medium | Enhanced monitoring, annual review |
| 3.1 - 4.0 | High | Quarterly review, risk mitigation plan required |
| 4.1 - 5.0 | Critical | CISO approval required, active risk mitigation, monthly review |

---

## 8. Ongoing Monitoring

### 8.1 Continuous Monitoring Activities

| Activity | Frequency | Responsible |
|----------|-----------|------------|
| Security news and CVE monitoring for vendor products | Daily | Security Engineering |
| Vendor SOC 2/ISO 27001 certificate expiry tracking | Monthly | Vendor Risk Committee |
| Vendor sub-processor change notification review | As received | DPO |
| Vendor incident notification review | As received | CISO |
| Connector health and availability monitoring | Real-time | Platform Engineering |
| Stripe API version and security update tracking | Monthly | Platform Engineering |
| Anthropic API terms and privacy policy change tracking | Monthly | DPO |

### 8.2 Vendor Incident Response

When a vendor reports a security incident:

1. **Assessment (within 4 hours):** Determine if platform or tenant data was affected.
2. **Containment (within 8 hours):** Disable affected connector or integration if necessary.
3. **Communication (within 24 hours):** Notify affected tenants per the BREACH workflow.
4. **Remediation:** Credential rotation via `rotate_credentials` action, access revocation via `revoke_access`.
5. **Review:** Post-incident review within 5 business days, update vendor risk score.

---

## 9. Vendor Onboarding and Offboarding

### 9.1 Onboarding Requirements

- Completed vendor risk assessment per tier requirements.
- Signed Data Processing Agreement (DPA) where personal data is processed.
- Security questionnaire response reviewed and accepted.
- Compliance certifications verified.
- PIA completed per TECHD-PIA-007 if new data processing is introduced.
- Approved by Vendor Risk Committee (Tier 1 and 2) or DPO (Tier 3 and 4).

### 9.2 Offboarding Procedures

- Revocation of all platform access credentials.
- Confirmation of data deletion from vendor systems.
- Removal of vendor-specific connector configurations.
- Archival of vendor risk assessment documentation.
- Notification to affected tenants (for connector removals).
- Update of CAPABILITY_MATRIX to remove vendor entries.

---

## 10. Contractual Requirements

All Tier 1 and Tier 2 vendor contracts must include:

| Requirement | Description |
|-------------|-------------|
| Data Processing Agreement | GDPR-compliant DPA with Standard Contractual Clauses where applicable |
| Breach Notification | 72-hour notification of security incidents |
| Audit Rights | Right to audit vendor security controls (or accept SOC 2/ISO 27001 in lieu) |
| Sub-processor Notification | Advance notice of sub-processor changes |
| Data Deletion | Commitment to delete data upon contract termination |
| Insurance | Cyber liability insurance with minimum coverage requirements |
| Compliance | Maintenance of applicable regulatory compliance certifications |
| Confidentiality | NDA covering platform architecture and tenant data |

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Data Classification Policy | TECHD-DCP-002 |
| Encryption Standards | TECHD-ENC-003 |
| Privacy Impact Assessment Template | TECHD-PIA-007 |
| Business Continuity Plan | TECHD-BCP-010 |
| Compliance Matrix | TECHD-CM-012 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | CISO | Initial release |
| 2.0 | 2026-05-10 | CISO | Added Anthropic AI risk assessment, Stripe risk profile, NullBillingProvider guard, connector-specific risk profiles, vendor risk scoring formula, expanded cloud provider assessments |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
