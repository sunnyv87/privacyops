# SOP-009: Release Management

**Document ID:** SOP-PRIVACYOPS-RM-009
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Release Manager

---

## 1. Purpose

Define the end-to-end process for releasing changes to the TechD PrivacyOps platform, from code merge through production deployment. This covers Git branching strategy, PR review requirements, CI pipeline stages, staging validation, canary rollout, production release, and hotfix procedures specific to the NestJS modular monolith architecture with Temporal workflows, NATS event bus, and multi-tenant data isolation.

## 2. Scope

Applies to all release activities across:
- **API service** (`apps/api/`): NestJS application, Prisma migrations, Temporal activities
- **Web frontend** (`apps/web/`): React/Next.js application
- **Shared packages** (`packages/shared-types/`, `packages/consent-sdk/`)
- **Temporal workers** (`apps/api/src/workers/`): scan-worker, temporal-worker
- **Infrastructure** (`infra/terraform/`, `infra/helm/privacyops/`)
- **Database migrations** (`apps/api/prisma/migrations/`)

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Release Manager | Coordinates release schedule, approves production deployment |
| Feature Developer | Implements changes, writes tests, creates PR |
| Code Reviewer | Reviews PRs for correctness, security, performance |
| QA Engineer | Executes staging validation, regression testing |
| Security Engineer | Security review for sensitive changes |
| DevOps Engineer | Manages CI/CD pipeline, deployment infrastructure |
| On-Call Engineer | Monitors post-deployment, handles rollback |

## 4. Prerequisites

- GitHub repository with branch protection rules on `main`
- CI pipeline (GitHub Actions) with all stages operational
- Staging environment mirroring production (PostgreSQL, Redis, NATS, Temporal)
- Container registry (ECR/GCR) accessible from staging and production
- Helm chart versioned and tested
- On-call rotation scheduled and staffed
- Release communication channel (`#privacyops-releases`)

## 5. Procedure

### 5.1 Git Branching Strategy

1. **Branch Model**
   1.1. `main`: Production-ready code, protected branch
   1.2. `develop`: Integration branch for next release
   1.3. `feature/<ticket-id>-<description>`: Feature branches from `develop`
   1.4. `release/<version>`: Release preparation branches from `develop`
   1.5. `hotfix/<ticket-id>-<description>`: Emergency fixes from `main`

2. **Branch Rules**
   2.1. `main` branch protection:
        - Minimum 2 approving reviews required
        - All CI checks must pass
        - Linear history enforced (squash merge)
        - Dismiss stale reviews on new pushes
   2.2. `develop` branch protection:
        - Minimum 1 approving review required
        - All CI checks must pass
   2.3. Feature branches: Free-form, developer-managed

### 5.2 Pull Request Process

3. **PR Creation**
   3.1. Create PR from feature branch to `develop`
   3.2. PR description must include:
        - Summary of changes
        - Affected modules (from NestJS module structure)
        - Database migration included? (Y/N)
        - Temporal workflow changes? (Y/N with version compatibility note)
        - NATS event schema changes? (Y/N)
        - Guard pipeline changes? (Y/N)
        - Feature gate required? (Y/N with gate name)
        - Testing evidence (unit, integration, manual)
   3.3. Link PR to issue/ticket in project management system

4. **Code Review Requirements**
   4.1. All PRs require minimum 1 review
   4.2. Changes to these areas require Security Engineer review:
        - `apps/api/src/core/auth/` (guard pipeline, auth strategies)
        - `apps/api/src/core/audit/` (hash chain, security events)
        - `apps/api/src/core/crypto/` (encryption, hashing)
        - `apps/api/src/core/events/` (HMAC signing, DLQ)
        - `apps/api/src/modules/redaction-engine/` (PII redaction)
        - `apps/api/prisma/schema.prisma` (RLS policies)
        - `apps/api/src/core/billing/` (Stripe, payment)
   4.3. Changes to connectors require Connector Developer + Platform Architect review
   4.4. Reviewer checklist:
        - Code correctness and readability
        - Test coverage adequate (>80% for new code)
        - No PII in logs or error messages
        - Tenant isolation maintained (`tenant_id` filtering)
        - Error handling follows fail-closed pattern where applicable
        - Prisma queries include `tenantId` in WHERE clause

### 5.3 CI Pipeline

5. **Pipeline Stages**
   5.1. **Lint & Format**: ESLint + Prettier enforcement
        ```bash
        npm run lint --workspace=apps/api
        npm run lint --workspace=apps/web
        ```
   5.2. **Build**: TypeScript compilation and bundle generation
        ```bash
        npm run build --workspace=apps/api
        npm run build --workspace=apps/web
        npm run build --workspace=packages/shared-types
        ```
   5.3. **Unit Tests**: Jest test suite
        ```bash
        npm test --workspace=apps/api -- --coverage
        npm test --workspace=apps/web -- --coverage
        ```
   5.4. **Integration Tests**: Database-dependent tests with test PostgreSQL
        ```bash
        npm run test:e2e --workspace=apps/api
        ```
   5.5. **Security Scan**: npm audit + container image scan (per SOP-008)
   5.6. **Prisma Validation**: Schema validation and migration check
        ```bash
        npx prisma validate
        npx prisma migrate diff --from-migrations-directory --to-schema-datamodel
        ```
   5.7. **Container Build**: Docker image build and push to registry
   5.8. Pipeline must complete within 15 minutes (build budget)

### 5.4 Staging Deployment

6. **Staging Release**
   6.1. Create release branch: `release/<version>` from `develop`
   6.2. Update version in `package.json` files
   6.3. Deploy to staging via Helm:
        ```bash
        helm upgrade privacyops infra/helm/privacyops/ \
          --namespace staging \
          --set image.tag=<version> \
          --set env=staging
        ```
   6.4. Run database migration on staging:
        ```bash
        npx prisma migrate deploy
        ```
   6.5. Verify Temporal workers connect to all 8 task queues
   6.6. Verify NATS JetStream streams and consumers operational

7. **Staging Validation**
   7.1. Smoke tests (automated):
        - Health endpoint: `GET /api/v1/health`
        - Auth flow: Login -> JWT issuance -> API call -> guard pipeline traversal
        - Connector scan: Initiate scan on test data source
        - DSAR flow: Create request -> workflow starts -> processes
        - Audit log: Verify new entries with valid hash chain
   7.2. Regression tests: Full e2e suite against staging
   7.3. Load tests (for performance-sensitive changes):
        ```bash
        k6 run test/load/baseline.k6.js --env TARGET=staging
        ```
   7.4. Manual exploratory testing for UI changes
   7.5. QA sign-off recorded in release ticket

### 5.5 Production Release

8. **Pre-Release Checklist**
   8.1. - [ ] All staging validation passed
   8.2. - [ ] Change request approved per SOP-005
   8.3. - [ ] Database migration tested on staging (if applicable)
   8.4. - [ ] Rollback procedure documented and tested
   8.5. - [ ] On-call engineer briefed
   8.6. - [ ] Deployment window confirmed (avoid peak hours)
   8.7. - [ ] Release notes prepared
   8.8. - [ ] Feature gates configured for gradual rollout (if applicable)

9. **Canary Deployment**
   9.1. Deploy new version to canary pod (5% of traffic):
        ```bash
        helm upgrade privacyops infra/helm/privacyops/ \
          --namespace production \
          --set image.tag=<version> \
          --set canary.enabled=true \
          --set canary.weight=5
        ```
   9.2. Monitor canary for 15 minutes:
        - Error rate comparison: canary vs. stable
        - Latency comparison: p50, p95, p99
        - Workflow success rate on canary workers
        - NATS event processing rate
   9.3. If canary metrics are healthy: Proceed to full rollout
   9.4. If canary shows degradation: Rollback canary immediately

10. **Full Production Rollout**
    10.1. Promote canary to full deployment (rolling update):
          ```bash
          helm upgrade privacyops infra/helm/privacyops/ \
            --namespace production \
            --set image.tag=<version> \
            --set canary.enabled=false
          ```
    10.2. Database migration (if applicable):
          ```bash
          npx prisma migrate deploy
          ```
    10.3. Restart Temporal workers with version pinning
    10.4. Announce release in `#privacyops-releases`
    10.5. Monitor for 30 minutes post-deployment (extended to 2 hours for major releases)

### 5.6 Hotfix Process

11. **Emergency Hotfix**
    11.1. Create hotfix branch from `main`: `hotfix/<ticket-id>-<description>`
    11.2. Implement minimum viable fix
    11.3. Expedited review: 1 reviewer (Security Engineer if security-related)
    11.4. CI pipeline must pass (no skip)
    11.5. Deploy directly to production (skip staging if approved by Release Manager)
    11.6. Merge hotfix to both `main` and `develop`
    11.7. Post-hoc change request per SOP-005

### 5.7 Post-Release

12. **Post-Release Activities**
    12.1. Merge release branch to `main` (via PR)
    12.2. Tag release: `git tag v<version>`
    12.3. Merge `main` back to `develop` to sync hotfixes
    12.4. Publish release notes to tenant admin dashboard
    12.5. Archive release artifacts in backup storage
    12.6. Update API documentation if endpoints changed
    12.7. Close release ticket with deployment confirmation

## 6. Verification

- [ ] All CI pipeline stages passed (lint, build, test, security)
- [ ] Staging validation complete with QA sign-off
- [ ] Canary deployment healthy (15-minute observation)
- [ ] Production deployment successful (rolling update complete)
- [ ] Database migration applied successfully (if applicable)
- [ ] All Temporal workers connected to task queues
- [ ] NATS event processing nominal
- [ ] Prometheus metrics within baseline
- [ ] Release tagged and notes published

## 7. Rollback

Trigger rollback if within 2 hours post-deployment:
1. **Application rollback**: `helm rollback privacyops <previous-revision> --namespace production`
2. **Database rollback** (if migration is reversible):
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
   If migration is not reversible: Apply compensating migration
3. **Temporal worker rollback**: Restart workers with previous version
4. **Cache clear**: Flush Redis to prevent stale state
5. Announce rollback in `#privacyops-releases`
6. Create incident report per SOP-001 if rollback triggered by service degradation

## 8. Frequency

- **Standard releases**: Bi-weekly (sprint cadence)
- **Patch releases**: As needed (vulnerability patches, bug fixes)
- **Hotfixes**: As needed (production-critical issues)
- **Release process review**: Quarterly
- **CI pipeline optimization**: Monthly

## 9. References

- SOP-005: Change Management
- SOP-008: Vulnerability Management
- SOP-010: Capacity Planning (for release performance validation)
- Architecture Doc: `docs/architecture/05-system-architecture.md`
- CI/CD: `.github/workflows/`
- Infrastructure: `infra/helm/privacyops/`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Release Manager | Initial version |
| | | | |
| | | | |
