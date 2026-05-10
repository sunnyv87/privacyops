# TechD PrivacyOps + DSPM Platform -- Service Level Agreements

**Owner:** VP Engineering + Customer Success
**Review Cycle:** Annually (with quarterly metrics review)
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations (Subset published to customers)

---

## 1. Overview

This document defines the internal and customer-facing SLAs for the TechD PrivacyOps platform. All SLAs are measured monthly. Internal targets are stricter than customer-facing commitments to provide operational buffer.

---

## 2. SLA Tiers

### 2.1 Tier Definitions

| Tier         | Target Customers            | Monthly Fee Range | Dedicated Support |
|--------------|-----------------------------|-------------------|-------------------|
| Enterprise   | Fortune 500, regulated      | $25K+             | Named CSM + TAM   |
| Business     | Mid-market, growth stage    | $5K - $25K        | Shared CSM        |
| Standard     | SMB, self-serve             | < $5K             | Community + email |

### 2.2 Platform Uptime SLAs

| Metric                            | Enterprise | Business | Standard |
|-----------------------------------|------------|----------|----------|
| Monthly uptime target             | 99.95%     | 99.9%    | 99.5%    |
| Allowed downtime/month            | 21.9 min   | 43.8 min | 3.6 hrs  |
| Maintenance window (excluded)     | Sun 02-06 UTC | Sun 02-06 UTC | Sun 00-08 UTC |
| Planned maintenance notification  | 72 hours   | 48 hours | 24 hours |

**Uptime measurement:** Synthetic monitoring of `GET /health` endpoint from 3 geographic regions at 60-second intervals. A period is counted as "down" when 2 of 3 regions fail consecutively for 3 checks (3 minutes).

**Exclusions from uptime calculation:**
- Scheduled maintenance windows
- Force majeure events
- Customer-caused issues (misconfigured connectors, API abuse)
- Third-party connector provider outages (e.g., SaaS vendor API down)

### 2.3 Uptime Credit Schedule

| Monthly Uptime        | Enterprise Credit | Business Credit | Standard Credit |
|-----------------------|-------------------|-----------------|-----------------|
| 99.9% - 99.95%       | 5%                | N/A             | N/A             |
| 99.5% - 99.9%        | 10%               | 5%              | N/A             |
| 99.0% - 99.5%        | 20%               | 10%             | 5%              |
| < 99.0%              | 30%               | 20%             | 10%             |

Credits are applied to the next invoice. Maximum credit per month: 30% of monthly fee. Credits are processed via the Stripe billing integration.

---

## 3. Incident Response SLAs

### 3.1 Response Time SLAs

| Severity | Enterprise | Business | Standard |
|----------|------------|----------|----------|
| P1       | 15 min     | 30 min   | 1 hour   |
| P2       | 30 min     | 1 hour   | 4 hours  |
| P3       | 2 hours    | 4 hours  | 1 biz day|
| P4       | 4 hours    | 1 biz day| 3 biz days|

### 3.2 Resolution Time Targets (Best Effort)

| Severity | Enterprise | Business  | Standard  |
|----------|------------|-----------|-----------|
| P1       | 4 hours    | 8 hours   | 24 hours  |
| P2       | 8 hours    | 24 hours  | 48 hours  |
| P3       | 24 hours   | 3 biz days| 5 biz days|
| P4       | 5 biz days | 10 biz days| Next release|

Resolution time targets are best-effort and do not carry SLA credits. Response time SLAs are contractually binding for Enterprise and Business tiers.

---

## 4. Feature-Specific SLAs

### 4.1 DSAR Processing SLA

DSARs (Data Subject Access Requests) have regulatory deadlines. The platform must process requests well within those deadlines.

| Metric                                     | Enterprise  | Business    | Standard    |
|--------------------------------------------|-------------|-------------|-------------|
| DSAR intake to processing start            | 1 hour      | 4 hours     | 24 hours    |
| Single-connector data retrieval            | 2 hours     | 4 hours     | 8 hours     |
| Full DSAR package assembly (all connectors)| 24 hours    | 48 hours    | 72 hours    |
| PII redaction completion                   | Included in assembly | Included | Included |
| DSAR response ready for review             | 48 hours    | 72 hours    | 96 hours    |

**Regulatory compliance buffers:**
- GDPR (30 days): Platform target is 7 days, leaving 23 days for customer review
- CCPA/CPRA (45 days): Platform target is 10 days
- LGPD (15 days): Platform target is 5 days

**DSAR fail-closed guarantee:** If PII redaction cannot be completed (AI co-pilot circuit breaker open), the DSAR response is blocked entirely. No unredacted data is released. The SLA clock pauses during system-side redaction failures (documented as force majeure).

### 4.2 Scan Completion SLA

| Metric                                      | Enterprise | Business | Standard |
|---------------------------------------------|------------|----------|----------|
| Single connector scan (< 100K records)      | 30 min     | 1 hour   | 2 hours  |
| Single connector scan (100K - 1M records)   | 2 hours    | 4 hours  | 8 hours  |
| Single connector scan (> 1M records)        | 8 hours    | 12 hours | 24 hours |
| Full tenant scan (all connected sources)    | 24 hours   | 48 hours | 72 hours |
| Incremental scan (delta only)               | 15 min     | 30 min   | 1 hour   |

**Scan SLA measurement:** Measured from SCAN Temporal workflow start to completion. Excludes time spent waiting in the SCAN task queue (queue wait time is tracked separately as an operational metric).

### 4.3 Remediation Execution SLA

The RemediationExecutorService supports 12 action types across 11 connectors (per CAPABILITY_MATRIX).

| Metric                                      | Enterprise | Business | Standard |
|---------------------------------------------|------------|----------|----------|
| Remediation action initiation               | 5 min      | 15 min   | 1 hour   |
| Single action completion (non-destructive)  | 15 min     | 30 min   | 2 hours  |
| Single action completion (destructive)      | 30 min     | 1 hour   | 4 hours  |
| Bulk remediation (> 100 actions)            | 4 hours    | 8 hours  | 24 hours |

**Destructive actions** (data deletion, access revocation) require APPROVAL queue workflow completion before execution. APPROVAL queue processing time is excluded from this SLA.

### 4.4 Event Processing SLA

NATS JetStream event bus processing guarantees:

| Metric                                      | Target              |
|---------------------------------------------|---------------------|
| Event ingestion to acknowledgment           | < 500ms (P99)       |
| End-to-end event processing                 | < 5s (P95)          |
| DLQ processing (manual review cycle)        | < 24 hours          |
| Event delivery guarantee                    | At-least-once       |
| HMAC signature validation                   | Every message       |
| Idempotency window                          | 72 hours            |

### 4.5 API Response Time SLA

| Endpoint Category              | P50 Target | P95 Target | P99 Target |
|--------------------------------|------------|------------|------------|
| Health / status endpoints      | 10ms       | 50ms       | 100ms      |
| CRUD operations                | 50ms       | 200ms      | 500ms      |
| Search / list with pagination  | 100ms      | 500ms      | 1s         |
| Report generation              | 500ms      | 2s         | 5s         |
| DSAR submission                | 200ms      | 500ms      | 1s         |
| Scan trigger                   | 100ms      | 300ms      | 500ms      |

Measured via Prometheus `privacyops_http_request_duration_seconds` histogram. All endpoints pass through the 7-layer auth guard; auth overhead is included in these targets.

---

## 5. Data Integrity SLAs

| Metric                                        | Target     |
|-----------------------------------------------|------------|
| Audit log hash chain integrity                | 100%       |
| Event delivery (NATS at-least-once)           | 99.99%     |
| Data classification accuracy (AI-assisted)    | > 95%      |
| PII detection recall                          | > 98%      |
| Tenant data isolation (RLS)                   | 100%       |
| LegalHold enforcement                         | 100%       |
| Backup RPO (Recovery Point Objective)         | 1 hour     |
| Backup RTO (Recovery Time Objective)          | 4 hours    |

**100% targets are non-negotiable.** Any violation of audit log integrity, tenant isolation, or legal hold enforcement is treated as a P1 security incident regardless of customer tier.

---

## 6. SLA Monitoring and Reporting

### 6.1 Monitoring Stack

| SLA Category        | Monitoring Tool               | Dashboard                       |
|---------------------|-------------------------------|---------------------------------|
| Uptime              | Synthetic monitors + /health  | Grafana: "Platform Uptime"      |
| Response time       | Prometheus prom-client        | Grafana: "API Latency"          |
| DSAR processing     | Temporal workflow metrics     | Grafana: "DSAR Pipeline"        |
| Scan completion     | Temporal + BullMQ metrics     | Grafana: "Scan Operations"      |
| Event processing    | NATS JetStream metrics        | Grafana: "Event Bus Health"     |
| Remediation         | Temporal REMEDIATION queue    | Grafana: "Remediation Tracker"  |

### 6.2 Reporting Cadence

| Report                    | Audience                  | Frequency   | Format          |
|---------------------------|---------------------------|-------------|-----------------|
| SLA Dashboard (real-time) | Operations team           | Continuous  | Grafana         |
| Weekly SLA Summary        | Engineering leadership    | Weekly      | Automated email |
| Monthly SLA Report        | Executive team            | Monthly     | PDF via Confluence |
| Quarterly Business Review | Enterprise customers      | Quarterly   | Slide deck      |
| Annual SLA Assessment     | All stakeholders          | Annually    | Formal document |

### 6.3 SLA Breach Notification

When an SLA is breached or at risk of breach:

1. **Automated alert** fires via Prometheus alerting rules to PagerDuty
2. **On-call engineer** acknowledges and assesses impact
3. **Customer Success** is notified for Enterprise/Business tier breaches
4. **Credit calculation** is triggered automatically at month-end via the Stripe integration
5. **Root cause analysis** is completed per the post-incident process

### 6.4 k6 Load Test Baselines

The 5 k6 scenarios establish performance baselines against which SLAs are validated:

| Scenario            | SLA Validation Purpose                                |
|---------------------|-------------------------------------------------------|
| smoke               | Basic API latency against response time SLA           |
| concurrent-scans    | Scan completion SLA under load                        |
| dsar-load           | DSAR processing SLA under concurrent requests         |
| event-pipeline      | Event processing throughput and latency               |
| api-burst           | API response time under burst traffic patterns        |

Baseline comparisons are run weekly. A drift > 15% from baseline triggers investigation. A drift > 25% triggers an engineering action item.

---

## 7. SLA Exceptions and Amendments

- SLA amendments for Enterprise customers require VP Engineering + Legal approval
- Custom SLAs are documented as addenda to the master services agreement
- SLA exceptions during major platform upgrades require 30-day advance notice
- All SLA changes must be reflected in the Stripe billing configuration to ensure correct credit processing
