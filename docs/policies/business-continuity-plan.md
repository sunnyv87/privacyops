# TechD PrivacyOps + DSPM Platform -- Business Continuity Plan

**Document ID:** TECHD-BCP-010
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Platform Engineering Lead
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This plan defines the business continuity strategy for the TechD PrivacyOps + DSPM platform, ensuring critical services remain available during disruptions. It covers service criticality tiers, RTO/RPO targets, failover procedures for all platform components, communication protocols, business impact analysis, and testing schedules. This plan applies to all platform infrastructure, application services, and dependent third-party services.

---

## 2. Service Criticality Tiers

### 2.1 Tier Definitions

| Tier | Definition | Maximum Downtime | Examples |
|------|-----------|-----------------|---------|
| P0 -- Critical | Services whose unavailability causes immediate regulatory non-compliance, data loss, or security exposure | 15 minutes | Authentication, RLS enforcement, audit logging, legal hold enforcement |
| P1 -- Essential | Core business functions required for tenant operations | 1 hour | DSAR processing, connector scanning, remediation execution, API endpoints |
| P2 -- Important | Supporting functions that enhance operations but have workarounds | 4 hours | AI co-pilot, reporting dashboards, billing processing, notification delivery |
| P3 -- Standard | Functions whose brief unavailability has minimal business impact | 24 hours | Non-critical batch jobs, analytics, documentation portals |

### 2.2 Service Criticality Assignments

| Service Component | Tier | Justification |
|------------------|------|---------------|
| PostgreSQL (primary) | P0 | All platform data, RLS enforcement, audit hash chain |
| 7-Layer Auth Guard Pipeline | P0 | Authentication and authorization for all API requests |
| SHA256 Hash Chain Audit Logging | P0 | Tamper-evident compliance evidence |
| Legal Hold Enforcement (RLS) | P0 | Regulatory obligation to preserve held data |
| NestJS API (core endpoints) | P1 | Tenant-facing API for all platform operations |
| Temporal Workflow Engine | P1 | Orchestrates DSAR, SCAN, BREACH, RETENTION, REMEDIATION, DATA_DELETION workflows |
| NATS JetStream Event Bus | P1 | Event-driven processing, HMAC-signed message delivery |
| Redis Cache | P1 | Session management, rate limiting, feature gate caching |
| DSAR Task Queue | P1 | Regulatory-mandated response deadlines (30/45 days) |
| BREACH Task Queue | P1 | 72-hour breach notification obligation |
| SCAN Task Queue | P1 | Data discovery and classification |
| REMEDIATION Task Queue | P1 | Security issue remediation execution |
| RETENTION Task Queue | P2 | Automated retention enforcement (daily schedule) |
| APPROVAL Task Queue | P1 | Approval workflows for sensitive operations |
| VENDOR Task Queue | P2 | Vendor risk assessment workflows |
| Anthropic Claude AI Co-pilot | P2 | AI-assisted analysis (circuit breaker handles failures) |
| Stripe Billing Integration | P2 | Payment processing (NullBillingProvider guard prevents startup without config) |
| Connector Outbound Access | P1 | Access to customer data sources for scanning and remediation |
| Monitoring and Alerting | P1 | Operational visibility and incident detection |
| CI/CD Pipeline | P3 | Development workflow |

---

## 3. RTO and RPO Targets

### 3.1 Recovery Objectives

| Tier | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|------|------------------------------|-------------------------------|
| P0 -- Critical | 15 minutes | 0 (zero data loss -- synchronous replication) |
| P1 -- Essential | 1 hour | 5 minutes |
| P2 -- Important | 4 hours | 1 hour |
| P3 -- Standard | 24 hours | 24 hours |

### 3.2 Component-Specific Recovery Targets

| Component | RTO | RPO | Replication Method |
|-----------|-----|-----|-------------------|
| PostgreSQL | 15 min | 0 | Synchronous streaming replication (primary-standby) |
| Redis | 30 min | 5 min | Redis Sentinel with AOF persistence |
| NATS JetStream | 30 min | 0 | JetStream clustering with R3 replication |
| Temporal Server | 1 hour | 5 min | Temporal cluster with persistence to replicated PostgreSQL |
| NestJS API | 5 min | N/A (stateless) | Container orchestration auto-restart |
| Audit Hash Chain | 15 min | 0 | Part of PostgreSQL synchronous replication |

---

## 4. Failover Procedures

### 4.1 PostgreSQL Database Failover

**Architecture:** Primary-standby with synchronous streaming replication.

**Automatic Failover:**
1. Health check detects primary unresponsive (3 consecutive failures, 10-second intervals).
2. Standby promoted to primary via automated failover manager (Patroni or equivalent).
3. Application connection pool (PgBouncer) redirected to new primary.
4. Prisma connections automatically re-established.
5. RLS policies are enforced on the standby (promoted to primary) without reconfiguration.
6. Hash chain integrity verified post-failover (latest sequence_id and hash confirmed).

**Manual Failover:**
1. DBA initiates controlled switchover.
2. Primary set to read-only mode, replication caught up to LSN match.
3. Standby promoted, connections redirected.
4. Verification: RLS enforcement, hash chain continuity, advisory lock availability.

**Post-Failover Validation:**
- [ ] All 60 RLS-protected tables enforcing tenant isolation.
- [ ] Audit hash chain continuous (no sequence gaps).
- [ ] Advisory locks available for hash chain writes.
- [ ] Prisma migrations at expected version.
- [ ] Legal hold RLS filters operational.

### 4.2 Redis Failover

**Architecture:** Redis Sentinel with 3-node cluster (1 primary, 2 replicas).

**Automatic Failover:**
1. Sentinel detects primary failure (quorum of 2 sentinels agree).
2. Replica promoted to primary.
3. Application Redis client (ioredis) follows Sentinel topology update.
4. Session data reconstructed from JWT tokens (stateless sessions minimize Redis RPO impact).

**Impact of Redis Failure:**
- Rate limiting temporarily relaxed (fails open with logging).
- Feature gate cache invalidated; re-fetched from PostgreSQL.
- Temporary DSAR payloads in cache lost; re-generated from source on next request.

### 4.3 NATS JetStream Failover

**Architecture:** NATS cluster with 3 nodes, JetStream R3 replication.

**Automatic Failover:**
1. NATS cluster elects new leader via Raft consensus.
2. JetStream streams available on surviving nodes with full message history.
3. HMAC-signed messages remain valid across failover (signing keys are in KMS, not NATS).
4. DLQ streams also replicated; no dead-letter messages lost.
5. Consumers reconnect automatically with last acknowledged sequence.

**Impact of NATS Failure:**
- Event delivery paused during leader election (typically < 5 seconds).
- Idempotency keys prevent duplicate processing on consumer reconnection.
- Exponential backoff retry ensures eventual delivery of in-flight messages.

### 4.4 Temporal Workflow Engine Failover

**Architecture:** Temporal server cluster with PostgreSQL persistence store.

**Automatic Failover:**
1. Temporal frontend service load-balanced across multiple instances.
2. History service uses sharded, replicated persistence.
3. Workflow state durably stored in PostgreSQL (benefits from DB failover).
4. Workers (SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION) are stateless and auto-reconnect.

**Impact of Temporal Failure:**
- In-flight workflows pause but do not lose state.
- New workflow starts queued until Temporal recovers.
- DSAR and BREACH workflows resume from last checkpoint (not restarted from beginning).
- Task queue workers automatically re-register on reconnection.

### 4.5 NestJS API Failover

**Architecture:** Multiple stateless API instances behind load balancer.

**Automatic Failover:**
1. Health check endpoint (`/health`) monitored by load balancer.
2. Unhealthy instance removed from rotation.
3. Container orchestrator restarts failed instance.
4. New instance passes health check and added back to rotation.
5. 7-layer guard pipeline operational immediately (stateless design).

**Scaling:**
- Horizontal auto-scaling based on CPU/memory/request rate.
- Minimum 3 instances in production for redundancy.

---

## 5. Communication Plan

### 5.1 Internal Communication

| Severity | Notification Method | Audience | Timeline |
|----------|-------------------|----------|----------|
| P0 Incident | PagerDuty + phone call | On-call engineer + CISO + Engineering Lead | Immediate |
| P1 Incident | PagerDuty + Slack alert | On-call engineer + Engineering Lead | Within 5 minutes |
| P2 Incident | Slack alert + email | Engineering team | Within 30 minutes |
| P3 Incident | Email | Engineering team | Within 4 hours |

### 5.2 External Communication (Tenant Notification)

| Severity | Notification Method | Content | Timeline |
|----------|-------------------|---------|----------|
| P0/P1 (data impact) | Email + status page + in-app banner | Impact description, ETA, affected services | Within 30 minutes |
| P0/P1 (no data impact) | Status page + in-app banner | Service status, ETA | Within 1 hour |
| P2 | Status page | Affected feature, workaround | Within 2 hours |
| P3 | Status page (if extended) | Feature availability update | If downtime > 4 hours |

### 5.3 Regulatory Communication

| Scenario | Regulation | Notification Deadline | Recipient |
|----------|-----------|----------------------|-----------|
| Personal data breach | GDPR Art. 33 | 72 hours | Supervisory authority |
| Personal data breach affecting individuals | GDPR Art. 34 | Without undue delay | Affected data subjects |
| PHI breach (>500 individuals) | HIPAA Breach Notification Rule | 60 days | HHS, affected individuals, media |
| CCPA data breach | CCPA 1798.150 | Expeditiously | Affected California residents |

---

## 6. Business Impact Analysis

### 6.1 Revenue Impact

| Component Failure | Revenue Impact per Hour | Justification |
|------------------|------------------------|---------------|
| Full platform outage | High (all tenant operations blocked) | No scanning, DSAR processing, or remediation |
| PostgreSQL failure | High (all reads/writes fail) | Core data store for all operations |
| Temporal failure | Medium (workflows paused) | Background processing stops; API reads still work |
| NATS failure | Medium (events delayed) | Async processing delayed; synchronous API unaffected |
| AI co-pilot failure | Low (graceful degradation) | Circuit breaker active; core features unaffected |
| Stripe failure | Low (billing delayed) | Service continues; billing reconciled on recovery |

### 6.2 Compliance Impact

| Component Failure Duration | Compliance Risk |
|---------------------------|----------------|
| Audit logging > 15 min | SOC 2 / ISO 27001 gap in audit trail |
| DSAR processing > 48 hours | GDPR Art. 12 response deadline at risk |
| Breach workflow > 24 hours | GDPR Art. 33 notification deadline at risk |
| Legal hold enforcement > 1 hour | Potential spoliation of evidence |
| Retention enforcement > 7 days | Data stored beyond retention period |

### 6.3 Reputational Impact

- P0 incident with data exposure: Severe reputational damage, potential customer loss.
- P1 incident with extended outage (>4 hours): Moderate reputational impact, customer confidence affected.
- P2/P3 incidents: Minimal reputational impact if communicated transparently.

---

## 7. Dependencies and Single Points of Failure

### 7.1 Identified Dependencies

| Dependency | SPOF Risk | Mitigation |
|-----------|-----------|------------|
| Cloud provider region | Medium | Multi-AZ deployment; cross-region DR per TECHD-DRP-011 |
| PostgreSQL primary | Eliminated | Synchronous replication with automatic failover |
| NATS cluster | Low | 3-node cluster with Raft consensus |
| Temporal server | Low | Multi-node cluster with persistent storage |
| DNS provider | Low | Multi-provider DNS with failover |
| KMS for encryption keys | Medium | Key caching with configurable TTL; graceful degradation |
| Anthropic API | Low | Circuit breaker; non-critical for core operations |
| Stripe API | Low | NullBillingProvider guard; service continues without billing |

### 7.2 Dependency Health Monitoring

All dependencies are monitored via health checks with the following intervals:

| Dependency | Check Interval | Failure Threshold | Alert Channel |
|-----------|---------------|-------------------|--------------|
| PostgreSQL | 10 seconds | 3 consecutive failures | PagerDuty (P0) |
| Redis | 10 seconds | 3 consecutive failures | PagerDuty (P1) |
| NATS | 10 seconds | 3 consecutive failures | PagerDuty (P1) |
| Temporal | 30 seconds | 3 consecutive failures | PagerDuty (P1) |
| External connectors | 60 seconds | 5 consecutive failures | Slack (P2) |
| Anthropic API | 60 seconds | Tracked by circuit breaker | Slack (P2) |
| Stripe API | 60 seconds | 3 consecutive failures | Slack (P2) |

---

## 8. BCP Testing Schedule

| Test Type | Frequency | Scope | Duration |
|-----------|-----------|-------|----------|
| PostgreSQL failover drill | Monthly | Controlled primary failover, RLS and hash chain verification | 2 hours |
| Redis failover drill | Quarterly | Sentinel-triggered failover, session impact assessment | 1 hour |
| NATS cluster failover | Quarterly | Node shutdown, message delivery verification | 1 hour |
| Temporal failover drill | Quarterly | Worker reconnection, workflow resumption | 2 hours |
| Full platform failover | Semi-annually | All components, end-to-end workflow validation | 4 hours |
| Tabletop exercise | Annually | Scenario-based discussion with all stakeholders | Half day |
| Cross-region DR drill | Annually | Full DR activation per TECHD-DRP-011 | Full day |

### 8.1 Test Success Criteria

| Criterion | Target |
|-----------|--------|
| RTO achieved for all P0 services | 100% |
| RTO achieved for all P1 services | 100% |
| Zero data loss for P0 services | RPO = 0 |
| Audit hash chain continuous post-failover | 100% |
| RLS enforcement confirmed post-failover | 100% |
| All 8 Temporal task queues operational post-failover | 100% |
| NATS message delivery verified (no gaps) | 100% |

---

## 9. Plan Maintenance

- Plan reviewed annually or after any significant platform architecture change.
- Post-incident reviews update the plan with lessons learned.
- New service components trigger a plan amendment with criticality assignment.
- Contact lists and escalation paths verified quarterly.
- All BCP drills produce a report with findings and remediation items.

---

## 10. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Disaster Recovery Plan | TECHD-DRP-011 |
| Third-Party Risk Policy | TECHD-TPR-009 |
| Audit Logging Policy | TECHD-ALP-005 |
| Compliance Matrix | TECHD-CM-012 |

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Platform Engineering Lead | Initial release |
| 2.0 | 2026-05-10 | Platform Engineering Lead | Added per-component failover procedures, Temporal/NATS specifics, regulatory communication plan, dependency health monitoring, BCP test success criteria |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
