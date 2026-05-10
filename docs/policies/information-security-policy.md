# TechD PrivacyOps + DSPM Platform -- Information Security Policy

**Document ID:** TECHD-ISP-001
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Chief Information Security Officer (CISO)
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy establishes the information security governance framework for the TechD PrivacyOps + DSPM platform, a multi-tenant SaaS application built on a NestJS modular monolith architecture. It applies to all platform components, infrastructure, data stores, third-party integrations, and personnel who develop, operate, or administer the platform.

### 1.1 Scope Boundaries

- **Application Layer:** NestJS API services, Temporal workflow engine, NATS JetStream event bus, AI co-pilot (Anthropic Claude integration)
- **Data Layer:** PostgreSQL (Prisma ORM), Redis cache, tenant-isolated data stores with Row-Level Security (RLS) on 60 tables
- **Integration Layer:** 43 registered connectors (aws_s3, postgresql, mysql, snowflake, mongodb, salesforce, okta, azure_blob, gcp_storage, sqlserver, bigquery, and 32 additional sources)
- **Billing Layer:** Stripe payment processing with NullBillingProvider production startup guard
- **Infrastructure Layer:** Container orchestration, CI/CD pipelines, monitoring, and alerting

---

## 2. Security Governance Structure

### 2.1 Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| CISO | Overall security strategy, policy approval, risk acceptance |
| Security Engineering Lead | Platform security architecture, guard pipeline maintenance |
| Platform Engineering Lead | Infrastructure security, deployment security, DR testing |
| Data Protection Officer (DPO) | Privacy compliance, DSAR oversight, PIA coordination |
| Tenant Administrators | Tenant-level configuration, user provisioning, feature gates |
| DevSecOps Engineers | CI/CD security, dependency scanning, SAST/DAST integration |

### 2.2 Security Governance Committees

- **Security Review Board:** Meets bi-weekly to review incidents, approve architecture changes, and assess risk posture.
- **Privacy Governance Committee:** Meets monthly to review DSAR metrics, regulatory changes, and data classification updates.
- **Vendor Risk Committee:** Meets quarterly to assess third-party connector and cloud provider risk.

---

## 3. Asset Classification Framework

### 3.1 Platform Asset Inventory

| Asset Category | Examples | Classification |
|---------------|----------|---------------|
| Customer Data Stores | Tenant databases, connected data sources | Critical |
| Authentication Infrastructure | JWT signing keys, SAML certificates, OIDC secrets, MFA seeds (otplib) | Critical |
| Workflow Engine | Temporal server, 8 task queues (SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION) | Critical |
| Event Bus | NATS JetStream, HMAC signing keys, DLQ streams | High |
| AI Integration | Anthropic Claude API keys, PII redaction pipeline, circuit breaker config | High |
| Connector Credentials | OAuth tokens, API keys, database connection strings for 43 connectors | Critical |
| Audit Logs | SHA256 hash chain records, Postgres advisory lock state | Critical |
| Billing Data | Stripe API keys, subscription metadata | High |
| Application Code | NestJS modules, Prisma schema, migration files | High |
| Monitoring Infrastructure | Metrics, alerting rules, dashboards | Medium |

### 3.2 Data Classification Tiers

The platform enforces six classification tiers through its DSPM scanning engine: PII, PHI, PCI, Confidential, Internal, and Public. Detailed handling requirements are defined in TECHD-DCP-002 (Data Classification Policy).

---

## 4. Risk Management Framework

### 4.1 Risk Assessment Methodology

TechD follows a quantitative risk assessment model:

- **Risk Score = Likelihood (1-5) x Impact (1-5) x Exposure Factor (0.0-1.0)**
- Assessments are conducted quarterly and triggered by material platform changes.
- Risk register is maintained in the platform's internal GRC module.

### 4.2 Platform-Specific Risk Categories

| Risk Category | Description | Primary Control |
|--------------|-------------|-----------------|
| Tenant Data Leakage | Cross-tenant data exposure via query bypass | RLS on 60 tables, tenant_id enforcement at DB level |
| Authentication Bypass | Unauthorized access through guard pipeline circumvention | 7-layer guard pipeline (CSRF, JWT, Tenant, Permissions, FeatureGate, ABAC, Approval) |
| DSAR Data Exposure | Unredacted PII in DSAR response payloads | Fail-closed redaction: blocks download on failure, logs critical audit event |
| Connector Credential Theft | Exfiltration of stored credentials for 43 connectors | Encrypted credential vault, scoped connector permissions |
| Audit Log Tampering | Modification of compliance evidence | SHA256 hash chain with Postgres advisory locks, tamper-evident design |
| AI Data Leakage | PII sent to Anthropic Claude in prompts | Pre-send PII redaction (fail-closed), circuit breaker (5 failures/60s), tenant-level feature gate |
| Legal Hold Violation | Premature deletion of data under legal hold | LegalHold enforcement with RLS, tenant_id + released_at + expires_at filtering |
| Billing Integrity | Payment processing in non-production environments | NullBillingProvider with production startup guard |

### 4.3 Risk Acceptance Criteria

- **Critical risks (score >= 20):** Must be remediated within 72 hours. CISO approval required for any risk acceptance.
- **High risks (score 12-19):** Must be remediated within 30 days. Security Engineering Lead approval required.
- **Medium risks (score 6-11):** Must be remediated within 90 days.
- **Low risks (score 1-5):** Tracked and addressed in next sprint cycle.

---

## 5. Security Controls Mapping

### 5.1 Authentication and Authorization Controls

The platform implements a defense-in-depth authentication architecture via a 7-layer guard pipeline executed sequentially on every API request:

1. **CSRF Guard:** Validates CSRF tokens on state-changing requests. Blocks cross-site request forgery attacks.
2. **JWT Guard (passport-jwt):** Validates Bearer tokens, checks expiration, verifies signing key. Token lifecycle managed per Access Control Policy (TECHD-ACP-004).
3. **Tenant Guard:** Extracts and validates tenant context. Ensures every request is scoped to a valid tenant.
4. **Permissions Guard:** Evaluates RBAC role assignments against the requested resource and action.
5. **FeatureGate Guard:** Checks tenant-level feature flags (e.g., ai_llm_enrichment) before granting access.
6. **ABAC Guard:** Applies attribute-based access control policies using request context, resource attributes, and environmental conditions.
7. **Approval Guard:** Enforces multi-party approval workflows for sensitive operations (e.g., data deletion, credential rotation).

### 5.2 Data Protection Controls

| Control | Implementation | Coverage |
|---------|---------------|----------|
| Row-Level Security | PostgreSQL RLS policies via scripts/rls-extension.sql | 60 tables |
| Encryption at Rest | PostgreSQL TDE, S3 SSE-S256, Snowflake AES-256-GCM | All data stores |
| Encryption in Transit | TLS 1.2+ enforced on all connections | Platform-wide |
| Event Signing | HMAC-SHA256 on NATS JetStream messages | All event bus messages |
| HTTP Security Headers | Helmet middleware for CSP, HSTS, X-Frame-Options | All HTTP responses |
| CORS | Whitelist-based origin validation | All API endpoints |

### 5.3 Operational Security Controls

| Control | Implementation |
|---------|---------------|
| Audit Logging | SHA256 hash chain with Postgres advisory locks, tamper-evident |
| Workflow Orchestration | Temporal engine with 8 dedicated task queues, retry policies |
| Event Reliability | NATS JetStream with DLQ, idempotency keys, exponential backoff |
| Remediation Automation | RemediationExecutorService with 12 action types across CAPABILITY_MATRIX |
| MFA | otplib TOTP generation + QR code provisioning |

---

## 6. Security Monitoring and Incident Response

### 6.1 Monitoring Requirements

- All 7-layer guard pipeline rejections must be logged with full request context.
- NATS DLQ depth must be monitored with alerts at threshold > 100 messages.
- Temporal workflow failure rates must be tracked per task queue with alerts at > 5% failure rate.
- Circuit breaker state changes for the AI co-pilot must generate alerts.
- SHA256 hash chain integrity must be verified on a configurable schedule (default: hourly).

### 6.2 Incident Severity Classification

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| SEV-1 | Active data breach, tenant isolation failure | 15 minutes | RLS bypass, cross-tenant data exposure |
| SEV-2 | Authentication bypass, DSAR redaction failure | 1 hour | Guard pipeline circumvention, redaction_failed status |
| SEV-3 | Single connector credential exposure | 4 hours | Connector OAuth token leak |
| SEV-4 | Security misconfiguration, non-critical vulnerability | 24 hours | Missing Helmet header, CORS misconfiguration |

---

## 7. Secure Development Lifecycle

### 7.1 Requirements

- All code changes must pass SAST scanning before merge.
- Prisma schema migrations must be reviewed for RLS impact.
- New connectors implementing IConnector interface must undergo security review.
- Temporal workflow definitions must include failure handling and timeout configuration.
- NATS event handlers must validate HMAC signatures before processing.

### 7.2 Dependency Management

- Automated dependency scanning for all npm packages.
- Critical CVEs must be patched within 72 hours.
- High CVEs must be patched within 30 days.
- All Prisma ORM updates must be tested against RLS policy integrity.

---

## 8. Physical and Environmental Security

As a cloud-native SaaS platform, physical security is delegated to infrastructure providers (AWS, Azure, GCP). Provider compliance certifications (SOC 2 Type II, ISO 27001) must be verified annually. See Third-Party Risk Policy (TECHD-TPR-009) for provider assessment procedures.

---

## 9. Policy Compliance and Enforcement

### 9.1 Compliance Monitoring

- Automated compliance checks run via the SCAN task queue against all connected data sources.
- Platform compliance posture is tracked in the compliance dashboard with per-regulation scoring.
- Policy violations trigger remediation workflows via the REMEDIATION task queue.

### 9.2 Non-Compliance Consequences

Violations of this policy may result in disciplinary action up to and including termination. For third-party violations, contractual remedies including service suspension will be enforced.

---

## 10. Related Documents

| Document | ID |
|----------|----|
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
| Compliance Matrix | TECHD-CM-012 |

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | CISO | Initial release |
| 2.0 | 2026-05-10 | CISO | Updated for 43-connector architecture, AI co-pilot controls, 7-layer guard pipeline, RemediationExecutorService |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
