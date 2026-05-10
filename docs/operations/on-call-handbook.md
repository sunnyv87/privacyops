# TechD PrivacyOps + DSPM Platform -- On-Call Handbook

**Owner:** Platform Engineering Leadership
**Review Cycle:** Quarterly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Purpose

This handbook governs on-call responsibilities for the TechD PrivacyOps platform. The platform processes sensitive personal data across 43 connectors, enforces DSAR compliance deadlines, and maintains audit log chain integrity. On-call engineers are the first line of defense for uptime, data integrity, and regulatory compliance.

---

## 2. On-Call Rotation Structure

### 2.1 Rotation Schedule

| Rotation         | Coverage         | Shift Length | Team Size |
|------------------|------------------|--------------|-----------|
| Primary On-Call   | 24/7             | 7 days       | 6 engineers |
| Secondary On-Call | 24/7 (backup)    | 7 days       | 6 engineers |
| Security On-Call  | 24/7             | 7 days       | 3 engineers |

- Rotations begin Monday at 09:00 UTC and end the following Monday at 09:00 UTC.
- Handoff meetings occur every Monday at 08:30 UTC (30 minutes before rotation start).
- Engineers must not be scheduled for back-to-back primary rotations.
- Minimum 2 weeks between primary on-call duties per engineer.

### 2.2 On-Call Tools

| Tool           | Purpose                                      | Access                          |
|----------------|----------------------------------------------|---------------------------------|
| PagerDuty      | Alert routing, escalation, scheduling        | SSO via Okta                    |
| Grafana        | Dashboards, Prometheus metrics visualization | `https://grafana.techd.io`      |
| Kibana         | Log search and analysis                      | `https://kibana.techd.io`       |
| Temporal UI    | Workflow inspection and management           | `https://temporal.techd.io`     |
| ArgoCD         | Kubernetes deployment status                 | `https://argocd.techd.io`       |
| Slack          | Communication (`#privacyops-incidents`)      | Standard workspace              |
| Runbook Wiki   | Confluence operations space                  | Confluence > PrivacyOps > Ops   |

---

## 3. Severity Classification

### P1 -- Critical (Business Impact: Catastrophic)

**Definition:** Complete platform outage, data breach, audit log chain broken, fail-closed systems failing open, NullBillingProvider detected in production.

**Examples:**
- All API endpoints returning 5xx
- NATS JetStream cluster failure (event bus down)
- SHA256 audit hash chain integrity failure (potential tampering)
- AI co-pilot PII redaction bypass (fail-closed not functioning)
- DSAR data leaking unredacted PII
- LegalHold RLS bypass detected
- NullBillingProvider active in production environment

**Response Time:** 15 minutes to acknowledge, 30 minutes to begin remediation.
**Communication:** Immediately open incident bridge. Notify VP Engineering + CISO.

### P2 -- High (Business Impact: Significant)

**Definition:** Major feature degraded, single Temporal task queue stalled, tenant-affecting issue for Enterprise tier, multiple connector failures.

**Examples:**
- SCAN or DSAR task queue processing stalled
- > 10 connectors simultaneously unhealthy
- JWT auth guard rejecting valid tokens across tenants
- RemediationExecutorService failing for multiple action types
- BullMQ queue backlog exceeding 10x normal depth
- WebSocket (Socket.IO) cluster-wide disconnect

**Response Time:** 30 minutes to acknowledge, 1 hour to begin remediation.
**Communication:** Post to `#privacyops-incidents`. Notify Engineering Manager.

### P3 -- Medium (Business Impact: Moderate)

**Definition:** Single connector failure, single tenant issue, non-critical feature degraded, performance degradation within SLA.

**Examples:**
- Single connector auth token expired
- One tenant experiencing slow scan performance
- AI co-pilot circuit breaker in HALF_OPEN state
- DLQ depth > 100 messages
- Prometheus metrics exporter intermittently failing
- Single Temporal task queue elevated latency

**Response Time:** 2 hours to acknowledge, 4 hours to begin remediation.
**Communication:** Post to `#privacyops-platform-ops`. Create Jira ticket.

### P4 -- Low (Business Impact: Minimal)

**Definition:** Cosmetic issues, non-critical alerts, informational anomalies.

**Examples:**
- Grafana dashboard rendering issue
- Non-critical log volume spike
- k6 baseline drift < 10%
- Minor UI inconsistency in Next.js frontend
- OpenTelemetry trace sampling producing gaps

**Response Time:** Next business day.
**Communication:** Create Jira ticket. Address during next sprint.

---

## 4. Response Time SLAs by Severity

| Severity | Acknowledge | Begin Work | Status Update | Resolution Target |
|----------|-------------|------------|---------------|-------------------|
| P1       | 15 min      | 30 min     | Every 30 min  | 4 hours           |
| P2       | 30 min      | 1 hour     | Every 1 hour  | 8 hours           |
| P3       | 2 hours     | 4 hours    | Every 4 hours | 24 hours          |
| P4       | Next day    | Next sprint| As needed     | Next release      |

---

## 5. Communication Procedures

### 5.1 Channels

| Channel                          | Purpose                                   |
|----------------------------------|-------------------------------------------|
| `#privacyops-incidents`          | Active incident coordination              |
| `#privacyops-platform-ops`      | General operational updates               |
| `#privacyops-security`          | Security-specific incidents (restricted)  |
| PagerDuty incident bridge        | Voice/video for P1 incidents              |
| Email: `ops@techd.io`           | External stakeholder communication        |

### 5.2 Incident Declaration Template

```
**INCIDENT DECLARED**
Severity: P[1/2/3/4]
Title: [Brief description]
Impact: [What is affected -- tenants, features, data]
Detected: [Timestamp UTC]
Current Status: [Investigating/Identified/Mitigating/Resolved]
Incident Commander: [Name]
Bridge: [Link if P1/P2]
```

### 5.3 Status Update Template

```
**INCIDENT UPDATE -- [HH:MM UTC]**
Incident: [Title]
Status: [Investigating/Identified/Mitigating/Resolved]
What changed: [Latest findings or actions taken]
Next steps: [Planned actions]
ETA: [If known]
```

---

## 6. Handoff Procedures

### 6.1 End-of-Shift Handoff Checklist

The outgoing on-call engineer must complete the following before handoff:

- [ ] Run the daily operations checklist (see `runbook-daily-operations.md`)
- [ ] Document all open incidents with current status
- [ ] List any pending DLQ items requiring manual review
- [ ] Note any Temporal workflows in abnormal states
- [ ] Flag connectors with known auth issues
- [ ] Record any temporary configuration overrides in place
- [ ] Update PagerDuty schedule if any swap is needed
- [ ] Brief incoming engineer synchronously (meeting or call)

### 6.2 Handoff Document Template

```
## On-Call Handoff: [Date] [Outgoing] -> [Incoming]

### Active Incidents
- [Incident ID]: [Status], [Summary], [Next action required]

### Watch Items
- [Item]: [Why it needs monitoring], [Threshold for action]

### Temporary Overrides
- [Override]: [Reason], [Revert date/condition]

### DLQ Status
- Current depth: [N] messages
- Pending review: [N] messages from [source]

### Connector Health
- [Any unhealthy connectors and remediation status]

### Notes for Incoming Engineer
- [Anything else relevant]
```

---

## 7. Common Scenarios Quick Reference

### 7.1 Temporal Task Queue Stalled

1. Check Temporal worker pods: `kubectl get pods -n privacyops -l component=temporal-worker`
2. Verify worker registration: `tctl taskqueue describe -tq <QUEUE_NAME>`
3. Check for poison-pill workflows: `tctl workflow list --status RUNNING --query "TaskQueue='<QUEUE>'" -o json | jq '.[] | select(.historyLength > 1000)'`
4. If workers are healthy but not polling, restart the worker deployment for that queue
5. If a single workflow is consuming all capacity, terminate it and investigate

### 7.2 NATS Consumer Lag Spike

1. Check consumer info: `nats consumer info PRIVACYOPS_EVENTS <consumer-name>`
2. Verify HMAC validation is not causing rejections (check application logs for `HMAC_VALIDATION_FAILED`)
3. Check if idempotency dedup is causing slowdown (Redis lookup latency)
4. Scale consumer replicas if the issue is throughput
5. If > 5000 messages pending, consider pausing producers if safe

### 7.3 AI Co-Pilot Circuit Breaker Open

1. Check breaker status: `GET /admin/ai-copilot/status`
2. Verify upstream LLM provider status page
3. Check PII redaction pipeline logs for errors
4. The system is fail-closed: no data exposure risk, but features are offline
5. Once upstream recovers, breaker transitions to HALF_OPEN automatically
6. Monitor HALF_OPEN probe success before confirming recovery

### 7.4 Auth Guard Cascade Failure

The 7-layer auth stack (CSRF, JWT, Tenant, Permissions, FeatureGate, ABAC, Approval) can fail at any layer. Check in order:
1. CSRF: Are tokens being generated and validated? Check middleware logs.
2. JWT: Is the signing key accessible? Check `JWT_SECRET` in secrets.
3. Tenant: Is tenant resolution working? Check `x-tenant-id` header propagation.
4. Permissions: Has RBAC config been recently changed?
5. FeatureGate: Are feature flags evaluating correctly?
6. ABAC: Are attribute policies loaded?
7. Approval: Is the APPROVAL Temporal queue processing?

### 7.5 Audit Hash Chain Break

This is always a P1. Immediately:
1. Preserve evidence: snapshot the audit log table
2. Identify the break point: `POST /admin/audit/verify-chain` returns the first broken link
3. Check Postgres advisory lock history for concurrent writes that bypassed locking
4. Engage the Security On-Call engineer
5. Do NOT attempt to repair the chain without security team approval

### 7.6 DSAR Processing Timeout

1. Check DSAR workflow status in Temporal: `tctl workflow describe -w <workflow-id>`
2. Verify the subject's data across connectors (may need manual scan)
3. Check if PII redaction is causing bottleneck (AI co-pilot circuit breaker)
4. Fail-closed redaction means incomplete redaction blocks the response entirely
5. If approaching regulatory deadline, escalate to Legal + Compliance

---

## 8. On-Call Engineer Requirements

- Must have production environment access (kubectl, database read-only, Temporal UI)
- Must have completed the PrivacyOps incident response training
- Must have PagerDuty mobile app installed and configured
- Must be reachable within 15 minutes during on-call period
- Must have VPN configured and tested before rotation begins
- Must be familiar with all 8 Temporal task queues and their workflows
- Must understand the 7-layer auth guard architecture
- Must know how to verify audit log hash chain integrity

---

## 9. Post-Incident Requirements

| Severity | Blameless Postmortem | Timeline |
|----------|---------------------|----------|
| P1       | Required            | Within 48 hours |
| P2       | Required            | Within 5 business days |
| P3       | Recommended         | Within 10 business days |
| P4       | Optional            | N/A |

All postmortems must include:
- Timeline of events with UTC timestamps
- Root cause analysis (5 Whys)
- Impact assessment (tenants affected, data impact, SLA impact)
- Action items with owners and due dates
- Detection improvement recommendations
