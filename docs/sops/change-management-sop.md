# SOP-005: Change Management

**Document ID:** SOP-PRIVACYOPS-CM-005
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Engineering Manager

---

## 1. Purpose

Define the process for requesting, assessing, approving, implementing, and verifying changes to the TechD PrivacyOps platform. This ensures controlled modifications across the NestJS monolith, Prisma schema, Temporal workflows, NATS JetStream configuration, connector implementations, guard pipeline, and supporting infrastructure, minimizing risk to platform stability and tenant data integrity.

## 2. Scope

Applies to all changes affecting:
- Application code in `apps/api/` and `apps/web/` packages
- Prisma database schema and migrations
- Temporal workflow definitions and activity implementations (8 task queues)
- NATS JetStream stream/consumer configuration
- Auth guard pipeline configuration (CSRF, JWT, Tenant, Permissions, FeatureGate, ABAC, Approval)
- ConnectorRegistry and CAPABILITY_MATRIX modifications
- Infrastructure (Terraform, Helm charts, Kubernetes manifests)
- Prometheus alerting rules and Grafana dashboards
- Feature gate and tenant FeatureOverride settings
- Billing configuration (Stripe and NullBillingProvider)
- Environment variables and secrets management
- Third-party dependency updates (npm packages, container base images)

**Excluded**: Emergency hotfixes follow expedited path in Section 5.6.

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Change Requester | Submits change request with justification and impact analysis |
| Change Advisory Board (CAB) | Reviews and approves/rejects non-standard changes |
| Technical Lead | Assesses technical impact, defines rollback plan |
| Security Engineer | Reviews security implications of changes |
| QA Engineer | Validates change in staging, executes test plan |
| Release Manager | Coordinates deployment window and rollout |
| On-Call Engineer | Monitors production post-deployment |

## 4. Prerequisites

- Change request template available in project management system
- CI/CD pipeline operational (GitHub Actions workflows in `.github/workflows/`)
- Staging environment mirroring production configuration
- Rollback procedures documented for target deployment
- Communication channels established (#privacyops-releases, #privacyops-incidents)

## 5. Procedure

### 5.1 Change Classification

1. **Change Types**

   | Type | Description | Approval | Lead Time |
   |------|------------|----------|-----------|
   | Standard | Pre-approved routine changes (dependency patches, config tuning) | Auto-approved | 1 day |
   | Normal | Feature additions, schema changes, workflow modifications | CAB review | 3 days |
   | Major | Guard pipeline changes, billing changes, multi-tenant logic, RLS changes | CAB + Executive | 5 days |
   | Emergency | Production outage fix, security patch for active exploit | Expedited (post-hoc CAB) | Immediate |

2. **Risk Classification**
   2.1. Assess change risk based on:
        - **Blast radius**: Number of tenants affected
        - **Data sensitivity**: Does change touch PII, audit logs, or legal hold data?
        - **Reversibility**: Can change be rolled back without data loss?
        - **Dependency depth**: How many modules are affected?
   2.2. Risk matrix:

   | Risk Level | Criteria | Additional Requirements |
   |-----------|----------|----------------------|
   | Low | Single module, no schema change, feature-gated | Standard test suite |
   | Medium | Multiple modules, non-breaking schema change | Integration tests + staging validation |
   | High | Guard pipeline, RLS, billing, Temporal workflows | Full regression + security review + load test |
   | Critical | Multi-tenant isolation, encryption, audit chain | All above + DPO review + executive sign-off |

### 5.2 Change Request Submission

3. **Request Documentation**
   3.1. Submit change request containing:
        - **Description**: What is being changed and why
        - **Affected components**: Modules, services, database tables
        - **Affected task queues**: Which of the 8 Temporal queues (SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION) are impacted
        - **Affected NATS subjects**: Which `privacyops.*` event subjects change
        - **Tenant impact**: Which tenants are affected (all, specific tier, specific tenant)
        - **Database migration**: Prisma migration required? Breaking vs. non-breaking?
        - **Feature gate**: Will change be behind FeatureGate guard?
        - **Rollback plan**: Step-by-step reversal procedure
        - **Test plan**: Unit, integration, e2e, load test coverage
        - **Deployment window**: Preferred and backup deployment windows

### 5.3 Impact Assessment

4. **Technical Impact Analysis**
   4.1. **Code impact**: Review files changed, module boundaries crossed
   4.2. **Schema impact**: Prisma migration analysis
        - Additive changes (new column with default): Low risk
        - Column type changes: High risk (requires data migration plan)
        - Index changes: Medium risk (may cause temporary performance impact)
        - RLS policy changes: Critical risk (tenant isolation affected)
   4.3. **Workflow impact**: Temporal workflow versioning check
        - Running workflows on old version must complete safely
        - Signal/query handlers must remain backward-compatible
   4.4. **Event bus impact**: NATS subject/schema changes
        - HMAC signing compatibility verified
        - DLQ consumer compatibility checked
        - Idempotency key format unchanged
   4.5. **Guard pipeline impact**: If any guard is modified:
        - Verify all 7 layers still chain correctly
        - Test bypass scenarios (missing token, wrong tenant, insufficient permissions)
        - Verify ABAC policy evaluation order
   4.6. **Connector impact**: Check CAPABILITY_MATRIX consistency
   4.7. **Billing impact**: Verify Stripe webhook compatibility, NullBillingProvider production guard active

5. **Security Impact Review**
   5.1. Security Engineer reviews changes touching:
        - Authentication/authorization code
        - Cryptographic operations (SHA256 hash chain, HMAC, encryption)
        - Tenant isolation (RLS, tenant_id filtering)
        - PII handling (redaction patterns, data export)
        - External API integrations (connector credentials)
   5.2. Document security review outcome in change request

### 5.4 Approval

6. **Approval Workflow**
   6.1. Standard changes: Auto-approved if all CI checks pass
   6.2. Normal changes: Technical Lead + one CAB member approval
   6.3. Major changes: Full CAB quorum (Technical Lead + Security Engineer + Product Manager)
   6.4. Critical changes: CAB + DPO + Executive Sponsor
   6.5. Approval tracked in PR review process and linked to change request

### 5.5 Implementation & Deployment

7. **Pre-Deployment Checklist**
   7.1. All CI pipeline checks passing (lint, build, unit tests, integration tests)
   7.2. Staging deployment completed and validated
   7.3. Database migration tested on staging (if applicable)
   7.4. Load test results reviewed (no regression from k6 baseline)
   7.5. Rollback procedure tested on staging
   7.6. On-call engineer briefed and available
   7.7. Deployment window confirmed with stakeholders

8. **Deployment Execution**
   8.1. Announce deployment start in `#privacyops-releases`
   8.2. Execute deployment per SOP-009 (Release Management):
        - Database migration first (if applicable)
        - API deployment with rolling update
        - Temporal worker restart with version pinning
        - Web frontend deployment
   8.3. Feature gate activation (if feature-gated change)
   8.4. Monitor Prometheus dashboards for 30 minutes post-deployment:
        - HTTP error rate: `privacyops_http_errors_total`
        - Request latency: `privacyops_request_duration_seconds`
        - Workflow failure rate: `privacyops_workflow_failures_total`
        - Guard rejection rate: `privacyops_guard_rejection_total`

### 5.6 Emergency Change Process

9. **Expedited Path**
   9.1. On-call engineer identifies production-critical issue
   9.2. Verbal approval from Technical Lead (or delegate)
   9.3. Implement fix with minimum viable change scope
   9.4. Deploy with accelerated pipeline (skip staging if necessary)
   9.5. Post-hoc documentation within 24 hours:
        - Change request created retroactively
        - Root cause and fix documented
        - CAB review at next scheduled meeting
   9.6. Follow-up: Proper fix through normal process if emergency patch was temporary

### 5.7 Post-Change Verification

10. **Verification Steps**
    10.1. Smoke test critical paths:
          - Tenant login and guard pipeline traversal
          - Connector scan initiation and completion
          - DSAR request creation and workflow start
          - Audit log creation and hash chain verification
    10.2. Verify Prometheus metrics within baseline tolerances
    10.3. Check NATS consumer lag for all active consumers
    10.4. Verify Temporal task queue worker health
    10.5. Confirm no new entries in NATS DLQ stream
    10.6. Check Socket.IO WebSocket connection stability

11. **Post-Implementation Review (PIR)**
    11.1. Review within 5 business days of deployment
    11.2. Document: Was the change successful? Any unexpected impacts?
    11.3. Update runbooks if new failure modes discovered
    11.4. Close change request with outcome recorded

## 6. Verification

- [ ] Change request documented with all required fields
- [ ] Risk classification assigned and appropriate approvals obtained
- [ ] Impact assessment completed (code, schema, workflow, events, guards)
- [ ] Security review completed (for medium+ risk changes)
- [ ] All CI checks passing
- [ ] Staging validation completed
- [ ] Rollback procedure tested
- [ ] Post-deployment monitoring confirms no regression
- [ ] Post-implementation review scheduled

## 7. Rollback

Rollback criteria (trigger rollback if any occur within 1 hour post-deployment):
1. HTTP 5xx error rate exceeds 1% of requests
2. Workflow failure rate increases by more than 5%
3. Guard pipeline rejection rate anomaly (unexpected spikes)
4. NATS DLQ receiving messages for new subjects
5. Database connection pool exhaustion
6. Tenant isolation violation detected

Rollback procedure:
1. Revert application deployment to previous version
2. Rollback database migration (if reversible; if not, apply compensating migration)
3. Restart Temporal workers with previous workflow version
4. Clear Redis caches to prevent stale state
5. Announce rollback in `#privacyops-releases`

## 8. Frequency

- **Change request processing**: Continuous
- **CAB meetings**: Twice weekly (Tuesday/Thursday)
- **Emergency change review**: Next scheduled CAB meeting
- **Process review**: Quarterly
- **Change success rate analysis**: Monthly

## 9. References

- SOP-001: Incident Response (for change-induced incidents)
- SOP-009: Release Management
- SOP-008: Vulnerability Management (for security patches)
- Architecture Doc: `docs/architecture/05-system-architecture.md`
- CI/CD: `.github/workflows/`
- Infrastructure: `infra/terraform/`, `infra/helm/`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Engineering Manager | Initial version |
| | | | |
| | | | |
