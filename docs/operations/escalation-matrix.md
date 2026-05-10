# TechD PrivacyOps + DSPM Platform -- Escalation Matrix

**Owner:** VP Engineering
**Review Cycle:** Quarterly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Purpose

This document defines escalation paths for all incident types on the TechD PrivacyOps platform. Escalation is mandatory when time-based triggers are exceeded or when incident scope expands beyond the initial responder's authority.

---

## 2. Escalation Tiers

### Tier 0 -- Automated Response

Automated alerts and self-healing mechanisms. No human intervention unless auto-remediation fails.

| System                  | Auto-Remediation                                        | Escalates to Tier 1 After |
|-------------------------|---------------------------------------------------------|---------------------------|
| BullMQ failed jobs      | Auto-retry with exponential backoff (3 attempts)        | 3rd retry failure         |
| NATS consumer restart   | Kubernetes liveness probe restarts pod                  | 3rd restart in 15 min     |
| Temporal activity retry | Built-in retry policy per workflow definition            | Max retries exhausted     |
| AI co-pilot breaker     | Fail-closed, auto-transition to HALF_OPEN after 60s    | Stays OPEN > 5 min        |
| Redis connection reset  | IORedis auto-reconnect with backoff                     | 5 failed reconnects       |

### Tier 1 -- On-Call Engineer (Primary)

First human responder. Has authority to:
- Restart services and pods
- Scale worker replicas
- Process DLQ messages
- Rotate connector tokens
- Apply pre-approved configuration changes

### Tier 2 -- On-Call Engineer (Secondary) + Team Lead

Engaged when:
- Primary cannot resolve within response SLA
- Incident requires cross-team coordination
- Multiple subsystems are affected simultaneously

Additional authority:
- Emergency feature flag changes via FeatureGate
- Temporary ABAC policy modifications
- Cross-tenant investigation

### Tier 3 -- Engineering Manager + Domain Expert

Engaged when:
- Incident is P1 or P2 exceeding resolution SLA
- Root cause requires code changes
- Data integrity is compromised
- Regulatory deadline is at risk

Additional authority:
- Emergency code deployments
- Database schema modifications
- Temporal workflow termination (bulk)
- Connector disablement

### Tier 4 -- VP Engineering + CISO + Legal

Engaged for:
- Confirmed data breaches
- Audit log chain tampering
- Regulatory body notification required
- Multi-tenant data exposure
- NullBillingProvider in production (financial exposure)

Authority:
- Platform-wide shutdown
- External communication approval
- Regulatory notification
- Legal hold invocation

---

## 3. Escalation Paths by Incident Type

### 3.1 Security Incident

```
Time 0:      Security On-Call Engineer (Tier 1)
             -> Acknowledge, begin containment
+15 min:     If not contained -> Security Team Lead (Tier 2)
+30 min:     If data exposure confirmed -> CISO (Tier 4)
+1 hour:     If multi-tenant impact -> VP Engineering + Legal (Tier 4)
+4 hours:    If not resolved -> CTO briefing
```

**Specific triggers for immediate Tier 4 escalation (skip Tiers 2-3):**
- Audit log SHA256 hash chain broken
- PII redaction fail-closed mechanism bypassed
- LegalHold RLS policy violated
- DSAR response containing unredacted PII
- Unauthorized access to tenant data across RLS boundary

### 3.2 Data Breach (via BREACH Task Queue)

```
Time 0:      On-Call Engineer activates BREACH workflow in Temporal
             -> Security On-Call notified automatically
+5 min:      BREACH workflow triggers automated containment
             -> Affected connectors isolated
+15 min:     Security Team Lead + CISO briefed (mandatory)
+30 min:     Legal team engaged for notification assessment
+1 hour:     VP Engineering joins incident bridge
+24 hours:   Preliminary breach report to executive team
+72 hours:   Regulatory notification deadline (GDPR, varies by jurisdiction)
```

**The BREACH Temporal task queue must never be paused or drained without CISO approval.**

### 3.3 System Outage (Platform-Wide)

```
Time 0:      Primary On-Call (Tier 1) + Secondary On-Call (Tier 2)
             -> Both engaged simultaneously for P1
+15 min:     If no root cause identified -> Engineering Manager (Tier 3)
+30 min:     If API still down -> VP Engineering (Tier 4)
+1 hour:     If customer impact confirmed -> Customer Success notified
+2 hours:    If not resolved -> CTO + CEO briefing
```

**Critical subsystem priorities during outage restoration:**
1. PostgreSQL (data layer -- all services depend on this)
2. NATS JetStream (event bus -- workflow coordination)
3. Temporal (workflow engine -- compliance processing)
4. Redis (cache + BullMQ -- job processing)
5. NestJS API (application layer -- user-facing)
6. Next.js frontend (presentation layer)

### 3.4 Tenant-Specific Issue

```
Time 0:      On-Call Engineer (Tier 1)
             -> Validate RLS isolation (confirm issue is tenant-scoped)
+30 min:     If Enterprise tier tenant -> Engineering Manager (Tier 3)
+1 hour:     If affecting DSAR compliance deadline -> Legal notified
+2 hours:    If not resolved -> Customer Success Manager engaged
+4 hours:    If Enterprise SLA breached -> VP Engineering (Tier 4)
```

**Tenant tier determines urgency:**
| Tenant Tier  | Initial Response | Manager Escalation | VP Escalation |
|--------------|------------------|--------------------|---------------|
| Enterprise   | 15 min           | 30 min             | 2 hours       |
| Business     | 30 min           | 1 hour             | 4 hours       |
| Standard     | 2 hours          | 4 hours            | 8 hours       |

### 3.5 Billing / Financial

```
Time 0:      On-Call Engineer (Tier 1)
             -> Verify Stripe webhook processing
+15 min:     If NullBillingProvider detected in production -> IMMEDIATE Tier 4
+30 min:     If Stripe integration failure -> Engineering Manager (Tier 3)
+1 hour:     If revenue impact > $10K -> VP Engineering + Finance (Tier 4)
+4 hours:    If billing data inconsistency -> Full reconciliation initiated
```

**NullBillingProvider in production is always an immediate P1 Tier 4 escalation.** This bypasses all intermediate tiers because it means the production guard has failed.

### 3.6 Compliance / DSAR

```
Time 0:      On-Call Engineer (Tier 1)
             -> Check DSAR Temporal workflow status
+1 hour:     If DSAR stuck in processing -> Engineering Manager (Tier 3)
+4 hours:    If approaching regulatory deadline -> Legal + DPO (Tier 4)
+24 hours:   If deadline within 48 hours -> VP Engineering + Legal (Tier 4)
             -> Manual processing procedure activated
```

**DSAR regulatory deadlines are non-negotiable. Track remaining time:**
- GDPR: 30 calendar days
- CCPA/CPRA: 45 calendar days
- LGPD: 15 calendar days

### 3.7 Connector Failure (IConnector Interface)

```
Time 0:      On-Call Engineer (Tier 1)
             -> Identify affected connector(s) from the 43 registered
+30 min:     If > 5 connectors affected -> Secondary On-Call (Tier 2)
+1 hour:     If connector failure blocks active DSAR -> Tier 3
+2 hours:    If connector vendor issue -> Vendor management team engaged
+4 hours:    If no vendor response -> VP Engineering (Tier 4)
```

### 3.8 Remediation Failure

```
Time 0:      On-Call Engineer (Tier 1)
             -> Identify failed action type from 12 RemediationExecutorService types
             -> Check CAPABILITY_MATRIX for the affected connector (11 supported)
+30 min:     If action type unsupported for connector -> Engineering Manager (Tier 3)
+1 hour:     If remediation blocks compliance requirement -> Legal notified
+2 hours:    If manual remediation required -> Domain expert engaged (Tier 3)
```

---

## 4. Contact Roles and Responsibilities

| Role                    | Escalation Authority              | Contact Method          |
|-------------------------|-----------------------------------|-------------------------|
| Primary On-Call         | Service restarts, DLQ processing  | PagerDuty, Slack        |
| Secondary On-Call       | Cross-service coordination        | PagerDuty, Slack        |
| Security On-Call        | Security containment              | PagerDuty, Slack, Phone |
| Team Lead               | Feature flags, policy changes     | Slack, Phone            |
| Engineering Manager     | Emergency deploys, DB changes     | Phone, Slack            |
| VP Engineering          | Platform shutdown, external comms | Phone (direct)          |
| CISO                    | Breach notification, legal hold   | Phone (direct)          |
| DPO                     | Regulatory notification           | Phone, Email            |
| Legal Counsel           | Breach reporting, compliance      | Phone (direct)          |
| Customer Success Lead   | Customer communication            | Slack, Phone            |

---

## 5. Time-Based Escalation Triggers

These triggers are automatic. If the time threshold is exceeded without resolution, PagerDuty will escalate to the next tier regardless of manual action.

| Condition                                         | Timer   | Auto-Escalate To |
|---------------------------------------------------|---------|-------------------|
| P1 unacknowledged                                 | 15 min  | Tier 2 + Manager  |
| P1 acknowledged but no status update              | 30 min  | Tier 3            |
| P2 unacknowledged                                 | 30 min  | Tier 2            |
| P2 no resolution progress                         | 2 hours | Tier 3            |
| DSAR workflow stuck > 4 hours                     | 4 hours | Tier 3 + Legal    |
| BREACH workflow not progressing                   | 15 min  | Tier 4 (CISO)     |
| Audit hash chain failure unresolved               | 30 min  | Tier 4 (CISO)     |
| > 20 connectors unhealthy simultaneously          | 1 hour  | Tier 3            |
| DLQ depth > 5000 messages                         | 2 hours | Tier 3            |
| All 8 Temporal task queues stalled                 | 15 min  | Tier 3 + Tier 4   |

---

## 6. Management Notification Thresholds

These notifications are informational (not necessarily requiring action) but ensure leadership awareness.

| Event                                                | Notify                    | Method     |
|------------------------------------------------------|---------------------------|------------|
| Any P1 incident declared                             | VP Eng, CISO, CTO        | Slack, SMS |
| P1 exceeds 2-hour resolution time                    | CTO, CEO                  | Phone      |
| Data breach confirmed                                | CISO, Legal, CEO          | Phone      |
| Enterprise tenant SLA breach                         | VP Eng, CS Lead           | Slack      |
| Monthly uptime drops below 99.9%                     | VP Eng, CTO               | Email      |
| > 3 P1 incidents in 30 days                          | CTO, VP Eng               | Meeting    |
| Regulatory deadline at risk                          | DPO, Legal, VP Eng        | Phone      |
| NullBillingProvider production guard failure          | VP Eng, CTO, Finance      | Phone      |

---

## 7. Escalation Anti-Patterns

**Do NOT:**
- Skip tiers unless explicitly allowed (security incidents have documented skip paths above)
- Escalate without first gathering basic diagnostic information
- Escalate a P3/P4 to Tier 3+ without attempting Tier 1 resolution
- Delay escalation to "try one more thing" when time-based triggers have fired
- Escalate to the wrong path (e.g., billing issue to security on-call)
- Close an incident before confirming the root cause is addressed, not just symptoms

**DO:**
- Escalate early when you recognize the issue is beyond your authority
- Include all gathered diagnostic data when escalating
- Maintain the incident timeline document during escalation
- Explicitly hand off incident command when escalating
