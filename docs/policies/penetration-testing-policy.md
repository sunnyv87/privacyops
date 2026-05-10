# TechD PrivacyOps + DSPM Platform -- Penetration Testing Policy

**Document ID:** TECHD-PTP-008
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** CISO
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy defines the penetration testing program for the TechD PrivacyOps + DSPM platform, including scope, methodology, frequency, remediation SLAs, and the bug bounty program. Penetration testing validates the effectiveness of the platform's security controls, with particular focus on the 7-layer guard pipeline, tenant isolation, DSAR redaction, connector access, and AI co-pilot data handling.

---

## 2. Testing Program Overview

### 2.1 Testing Types

| Test Type | Frequency | Performed By | Duration |
|-----------|-----------|-------------|----------|
| Full External Penetration Test | Annually | Third-party CREST-certified firm | 3-4 weeks |
| Internal Application Security Test | Semi-annually | Internal AppSec team + external firm | 2-3 weeks |
| API Security Assessment | Quarterly | Internal AppSec team | 1-2 weeks |
| Tenant Isolation Verification | Quarterly | Internal Security Engineering | 1 week |
| Red Team Exercise | Annually | Third-party red team | 4-6 weeks |
| Continuous Automated Scanning | Ongoing | DAST/SAST tools in CI/CD | Continuous |

### 2.2 Testing Environments

| Environment | Permitted Tests | Restrictions |
|------------|----------------|-------------|
| Dedicated Security Testing | All test types | Synthetic data only, no production data |
| Staging | API and application testing | Synthetic data, rate-limited to avoid infra impact |
| Production | Limited automated scanning only | No destructive tests, no DoS, pre-approved scope only |

---

## 3. Testing Scope

### 3.1 In-Scope Components

#### 3.1.1 API Endpoints

- All NestJS REST API routes (authenticated and unauthenticated).
- GraphQL endpoints (if exposed).
- Webhook receivers (NATS event callbacks, Stripe webhooks).
- SAML and OIDC callback endpoints (passport-saml, passport-openidconnect).
- API key authentication flows.
- Rate limiting and throttling mechanisms.

#### 3.1.2 Authentication Pipeline

- JWT token generation, validation, and refresh (passport-jwt).
- SAML assertion processing (passport-saml) -- XML signature validation, replay attacks.
- OIDC authorization code flow (passport-openidconnect) -- state parameter validation, PKCE.
- MFA enrollment and verification (otplib TOTP) -- brute force, time skew, recovery codes.
- CSRF token generation and validation.
- Session management -- fixation, hijacking, concurrent session limits.
- Password reset flows -- token entropy, expiration, rate limiting.

#### 3.1.3 7-Layer Guard Pipeline

Each guard layer tested individually and in combination:

| Layer | Test Focus |
|-------|-----------|
| CSRF Guard | Token bypass, SameSite cookie interaction, CORS preflight abuse |
| JWT Guard | Signature manipulation (alg:none, key confusion), token leakage, expiration bypass |
| Tenant Guard | Tenant ID manipulation, cross-tenant access via header injection, tenant context poisoning |
| Permissions Guard | Privilege escalation (horizontal and vertical), RBAC bypass, permission inheritance flaws |
| FeatureGate Guard | Feature flag bypass, disabled feature access, gate enumeration |
| ABAC Guard | Attribute manipulation, policy evaluation bypass, negative testing |
| Approval Guard | Approval workflow bypass, self-approval, expired approval token reuse |

#### 3.1.4 Tenant Isolation

- RLS bypass attempts via SQL injection, Prisma query manipulation, raw query escape.
- Cross-tenant data access via API parameter tampering.
- Tenant context leakage in error messages, logs, and response headers.
- Shared resource (Redis, NATS) tenant isolation verification.
- RLS policy integrity after Prisma migration execution.

#### 3.1.5 DSAR Redaction Pipeline

- Redaction bypass -- ensuring PII cannot be included in DSAR exports without redaction.
- Fail-closed behavior verification -- redaction failures must set `redaction_failed` status and block download.
- Critical audit event generation on redaction failure.
- Redaction completeness -- all PII types detected and redacted across all data formats.
- Race condition testing -- concurrent DSAR requests, download during redaction.

#### 3.1.6 Connector Access

- Connector credential exposure via API responses, error messages, or logs.
- Connector impersonation -- accessing connected sources with manipulated credentials.
- CAPABILITY_MATRIX enforcement -- verifying unsupported actions are truly blocked.
- Connector-specific injection attacks (SQL injection for database connectors, SSRF for cloud storage).
- OAuth token scope escalation for SaaS connectors (Salesforce, Okta).

#### 3.1.7 AI Co-pilot

- PII leakage to Anthropic Claude -- bypass of pre-send redaction pipeline.
- Prompt injection via user-supplied data that reaches the AI co-pilot.
- Circuit breaker bypass -- attempting to use the AI after circuit breaker activation.
- Feature gate bypass -- accessing AI features when `ai_llm_enrichment` is disabled.
- Response manipulation -- ensuring AI responses are sanitized before display.

#### 3.1.8 Event Bus and Workflow Engine

- NATS JetStream HMAC signature forgery.
- DLQ poisoning -- injecting malicious events into the dead letter queue.
- Temporal workflow manipulation -- unauthorized workflow signal/cancel/terminate.
- Idempotency key collision attacks.
- Event replay attacks (even with valid HMAC signatures).

#### 3.1.9 Billing Integration

- Stripe webhook signature bypass.
- Subscription manipulation -- accessing premium features without valid subscription.
- NullBillingProvider production guard bypass.
- Usage metering manipulation.

### 3.2 Out-of-Scope

- Third-party vendor infrastructure (AWS, Azure, GCP, Anthropic, Stripe) -- covered by their own security programs.
- Physical security -- cloud-native platform.
- Social engineering of TechD personnel (unless explicitly included in red team scope).
- Denial of service attacks against production infrastructure.

---

## 4. Methodology

### 4.1 Testing Standards

- **OWASP Testing Guide v4.2** -- primary methodology for web application testing.
- **OWASP API Security Top 10** -- API-specific test cases.
- **PTES (Penetration Testing Execution Standard)** -- overall engagement framework.
- **NIST SP 800-115** -- technical guide for information security testing.

### 4.2 Testing Phases

1. **Reconnaissance:** Asset discovery, API documentation review, architecture analysis.
2. **Threat Modeling:** Identify attack vectors specific to the PrivacyOps platform architecture.
3. **Vulnerability Assessment:** Automated scanning with manual validation.
4. **Exploitation:** Controlled exploitation of discovered vulnerabilities.
5. **Post-Exploitation:** Lateral movement assessment, data access verification, persistence testing.
6. **Reporting:** Detailed findings with reproduction steps, impact assessment, and remediation guidance.

### 4.3 Rules of Engagement

- All testing must be authorized in writing by the CISO.
- Testing must not disrupt production services.
- Any critical vulnerability discovered during testing must be reported immediately (within 1 hour).
- Test data must be synthetic; real customer data must never be used.
- All findings, notes, and artifacts must be encrypted and securely destroyed after engagement completion.
- Testers must not access, exfiltrate, or retain any actual tenant data encountered during testing.

---

## 5. Tools and Techniques

### 5.1 Approved Testing Tools

| Category | Tools |
|----------|-------|
| DAST | Burp Suite Professional, OWASP ZAP, Nuclei |
| SAST | Semgrep, SonarQube, CodeQL |
| API Testing | Postman (security collections), ffuf, sqlmap (authorized targets only) |
| Infrastructure | nmap, Trivy, Grype |
| Custom | Platform-specific test harnesses for guard pipeline, RLS verification, hash chain validation |
| Secrets Detection | truffleHog, GitLeaks |
| Dependency Scanning | npm audit, Snyk, Dependabot |

### 5.2 Custom Test Harnesses

The security team maintains custom test harnesses for platform-specific controls:

- **Guard Pipeline Tester:** Automated tests for each of the 7 guard layers with bypass attempts.
- **RLS Verification Suite:** Tests RLS policy enforcement on all 60 tables with cross-tenant access attempts.
- **Hash Chain Validator:** Verifies audit log integrity and tests tamper detection.
- **Redaction Tester:** Validates DSAR redaction pipeline with synthetic PII payloads.
- **CAPABILITY_MATRIX Enforcer:** Verifies that unsupported remediation actions are properly blocked per connector.

---

## 6. Remediation SLAs

### 6.1 Vulnerability Severity Classification

| Severity | CVSS Range | Description |
|----------|-----------|-------------|
| Critical | 9.0 - 10.0 | RCE, authentication bypass, RLS bypass, mass data exposure |
| High | 7.0 - 8.9 | Privilege escalation, single-tenant data exposure, DSAR redaction bypass |
| Medium | 4.0 - 6.9 | Information disclosure, XSS, CSRF bypass |
| Low | 0.1 - 3.9 | Minor information leakage, weak configuration |
| Informational | N/A | Best practice recommendations |

### 6.2 Remediation Timelines

| Severity | Remediation Deadline | Verification Deadline | Escalation |
|----------|---------------------|----------------------|------------|
| Critical | 72 hours | 1 week | Immediate CISO notification, war room |
| High | 14 days | 21 days | Security Engineering Lead |
| Medium | 60 days | 75 days | Sprint planning integration |
| Low | 90 days | 120 days | Backlog prioritization |
| Informational | Best effort | N/A | N/A |

### 6.3 Remediation Verification

- All Critical and High findings require retesting by the original tester or internal AppSec team.
- Medium findings are verified through automated regression tests added to the CI/CD pipeline.
- Remediation must include root cause analysis and systemic fix (not just point fix).

---

## 7. Bug Bounty Program

### 7.1 Program Structure

| Aspect | Detail |
|--------|--------|
| Platform | Private bug bounty via HackerOne (or equivalent) |
| Scope | Same as Section 3.1, excluding out-of-scope items |
| Eligibility | Registered researchers, background-checked |
| Safe Harbor | Good-faith researchers protected from legal action |

### 7.2 Reward Structure

| Severity | Bounty Range | Example |
|----------|-------------|---------|
| Critical | $5,000 - $25,000 | RLS bypass leading to cross-tenant data access |
| High | $2,000 - $10,000 | Guard pipeline bypass, DSAR redaction circumvention |
| Medium | $500 - $3,000 | IDOR, XSS with session context |
| Low | $100 - $500 | Information disclosure, misconfiguration |

### 7.3 Priority Bounty Areas

Enhanced rewards (2x multiplier) for findings in:

- Tenant isolation (RLS bypass, cross-tenant access).
- DSAR redaction pipeline (PII exposure in exports).
- 7-layer guard pipeline (authentication or authorization bypass).
- AI co-pilot PII leakage (bypass of pre-send redaction).
- Audit log tampering (hash chain integrity bypass).

---

## 8. Reporting and Documentation

### 8.1 Penetration Test Report Requirements

Every engagement must produce a report containing:

1. Executive summary with overall risk assessment.
2. Methodology and tools used.
3. Detailed findings with CVSS scores, reproduction steps, and evidence (screenshots, HTTP requests).
4. Impact analysis specific to the PrivacyOps platform (e.g., tenant data exposure scope, regulatory impact).
5. Remediation recommendations prioritized by risk.
6. Positive findings (controls that effectively prevented attacks).
7. Appendix with raw tool output (encrypted).

### 8.2 Report Distribution

- Reports classified as Confidential.
- Distribution: CISO, Security Engineering Lead, Platform Engineering Lead.
- Redacted executive summary available to tenant-facing compliance team.
- Full reports retained for 3 years in encrypted storage.

---

## 9. Compliance Requirements

| Regulation / Standard | Penetration Testing Requirement | Platform Compliance |
|----------------------|--------------------------------|-------------------|
| SOC 2 CC7.1 | Annual penetration testing | Annual external + semi-annual internal |
| PCI DSS 11.3 | Annual external + internal pen test | Included in testing program |
| ISO 27001 A.18.2 | Regular technical compliance review | Annual external pen test satisfies |
| HIPAA 164.308(a)(8) | Periodic technical evaluation | Semi-annual application security test |

---

## 10. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Access Control Policy | TECHD-ACP-004 |
| Audit Logging Policy | TECHD-ALP-005 |
| Third-Party Risk Policy | TECHD-TPR-009 |
| Compliance Matrix | TECHD-CM-012 |

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | CISO | Initial release |
| 2.0 | 2026-05-10 | CISO | Added AI co-pilot testing scope, CAPABILITY_MATRIX verification, bug bounty priority areas, custom test harnesses, event bus/workflow testing |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
