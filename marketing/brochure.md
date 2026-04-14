# TechD PrivacyOps + DSPM Platform
## The Unified Control Plane for Privacy, Data Security Posture, and Regulatory Compliance

---

### The Problem

Enterprise data sprawl has outpaced legacy privacy tooling. Sensitive data now lives across 30+ SaaS apps, 5+ cloud warehouses, unmanaged lakes, shadow databases, and employee endpoints. Regulators (GDPR, CCPA/CPRA, DPDPA, HIPAA) demand proof of control — not policies on paper. Teams are drowning in:

- **Disconnected tools** — one for discovery, one for consent, one for DSARs, one for breach response.
- **Manual DSAR workflows** that take 20+ days per request and still miss systems.
- **Opaque data lineage** — nobody can answer *"where is this customer's data right now?"*
- **No audit integrity** — logs can be tampered with, breaking chain-of-custody for regulators.
- **Zero observability** across privacy operations.

**TechD PrivacyOps unifies all of this into one enterprise-grade control plane.**

---

### What TechD PrivacyOps Delivers

A single, multi-tenant, API-first platform that discovers, classifies, governs, and defends personal data across your entire data estate — with cryptographic audit trails and end-to-end observability.

```
┌─────────────────────────────────────────────────────────────┐
│                  TechD PrivacyOps + DSPM                    │
├─────────────────────────────────────────────────────────────┤
│   Discovery  │  Classification │  Data Graph  │  Workflows  │
│   Consent    │  DSAR Engine    │  Breach Ops  │  Retention  │
│   DPIA       │  Vendor Review  │  Remediation │  Deletion   │
├─────────────────────────────────────────────────────────────┤
│              34+ Connectors │ Event Bus │ RBAC              │
├─────────────────────────────────────────────────────────────┤
│    Multi-Tenant │ Envelope Encryption │ Audit Chain         │
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Capabilities

### 1. Universal Data Discovery — 34+ Pre-Built Connectors

Connect once, discover everywhere. Our connector SDK ships with **34 production connectors across Wave 1, 2, and 3** covering:

**Cloud Object Storage**
- AWS S3, Azure Blob Storage, Google Cloud Storage

**Data Warehouses & Lakes**
- Snowflake, Google BigQuery, Amazon Redshift, Databricks

**Operational Databases**
- PostgreSQL, MySQL, MongoDB, Microsoft SQL Server, Oracle

**SaaS Applications**
- Salesforce, HubSpot, Workday, ServiceNow, Zendesk, Stripe

**Collaboration & Productivity**
- Microsoft 365, Google Workspace, Slack, Confluence, Jira, Notion, GitHub, GitLab

**Identity & HR**
- Okta, Azure AD (Entra ID), Google IDP, BambooHR

**CRM / Marketing**
- Marketo, Mailchimp, Segment

Every connector is built on a shared SDK with **retry-with-jitter**, **Retry-After honoring**, **rate-limit handling**, **pagination**, and **health-checked cron monitoring** (every 10 minutes). New connectors can be added in days, not months.

---

### 2. Temporal-Backed Workflow Engine

Eight production workflows, each with durable execution, automatic retries with exponential backoff, scheduleToCloseTimeout, and heartbeat timeouts — the same primitives Uber and Netflix use for mission-critical orchestration.

| Workflow | Purpose |
|---|---|
| **Data Scan & Discovery** | Crawl, sample, and classify data across every connected source |
| **DSAR Fulfillment** | Access / rectify / delete / restrict / port requests end-to-end |
| **Breach Response** | Incident capture → impact assessment → regulator-ready report |
| **Retention Enforcement** | Policy-driven auto-deletion and archival |
| **Remediation** | Auto-fix misconfigurations (public S3, over-permissive grants) |
| **Vendor Review** | Third-party risk assessment lifecycle |
| **DPIA Approval** | Data Protection Impact Assessment with approval chains |
| **Data Deletion** | Cryptographic proof-of-deletion across every system |

---

### 3. Live Data Graph — Your Personal-Data X-Ray

A first-class graph model of your entire data estate. Nodes represent assets (tables, buckets, files, users, documents, services); edges represent relationships (contains, accessed-by, derived-from, shared-with, replicated-to).

Capabilities:
- **Path finding** — *"How does this customer's PII flow from Salesforce to Snowflake to our BI dashboard?"* answered as a single API call.
- **Neighbor expansion** with bounded edge limits (500 per node).
- **Subgraph extraction** for DPIA scoping and breach blast-radius analysis.
- **Bounded BFS traversal** — 50,000 edge cap, 10,000 visited cap, 20 path cap — guarantees sub-second graph queries on million-node estates.
- **Batched sync** (50 nodes/edges per batch) via parallel Promise.all for linear-speed ingestion.
- **Composite PostgreSQL indexes** on `(tenantId, sourceNodeId, targetNodeId)` and `(tenantId, relationshipType)` for fast lookups.

---

### 4. Consent & Preference Intelligence

Centralized, auditable consent store — not just a cookie banner widget.

- Per-subject, per-purpose, per-jurisdiction consent records
- Version-pinned policy text with change-over-time history
- Preference center integrations (web, mobile, customer portals)
- Automatic consent-expiry enforcement
- Evidence artifacts for regulator audits

---

### 5. DSAR Engine

Full Data Subject Request lifecycle — the closest thing in the market to *"press the button, get a regulator-ready package."*

- **Intake API** + portal hooks for customer apps
- **Identity verification** pluggable (OIDC, magic link, document upload)
- **Fan-out search** across all 34 connectors with a single job
- **Data Graph resolution** to find derived and replicated copies
- **Review & redact** UI for sensitive content
- **Evidence bundle** (JSON + PDF) with cryptographic hash
- **SLA timers** with jurisdiction-aware defaults (GDPR 30 days, CCPA 45 days, DPDPA as notified)

---

### 6. Breach Response Orchestration

From first signal to 72-hour regulator notification — orchestrated.

- Incident intake with severity auto-classification
- Blast-radius computation using the Data Graph
- Data-subject enumeration by connector
- Regulator-ready report generation (GDPR Article 33, DPDPA breach notice, state-level US)
- Notification workflow with approval gates
- Chain-of-custody preservation across the entire incident

---

### 7. DPIA, Vendor Review, and Retention

- **DPIA** — risk scoring, mitigation tracking, approval chains, immutable sign-offs
- **Vendor Review** — questionnaire automation, evidence collection, residual risk scoring, expiry reminders
- **Retention** — policy engine with per-jurisdiction, per-data-category rules and workflow-driven enforcement

---

## Enterprise-Grade Architecture

### Security by Construction

- **AES-256-GCM envelope encryption** with **HKDF-derived per-tenant keys** — a compromise of one tenant's key cannot decrypt another's data.
- **SHA-256 audit integrity chain** — every audit event links to the hash of the previous event, with per-tenant state. Tampering is cryptographically detectable.
- **Six-layer RBAC pipeline**: CSRF → JWT → Tenant → Permissions → ABAC → Approval. Even a leaked token cannot bypass tenant or attribute boundaries.
- **Field-mask interceptors** strip PII from logs before they reach any observability backend.
- **Security hardening across 7 domains** with 14 committed fixes.

### Reliability Hardening

Built to enterprise SRE standards:

- **30-second global request timeout** (NestJS `TimeoutInterceptor` with RxJS `timeout()`) — no request holds a worker forever.
- **1 MB request size limit** on every endpoint.
- **120-second server socket timeout** with graceful shutdown.
- **Connector retry with jitter** and `Retry-After` header extraction.
- **Distributed locks** via Redis `SET NX EX` for safe concurrent cron execution.
- **NATS JetStream DLQ** with idempotent consumers (in-memory eventId cache, 10-minute TTL).
- **PostgreSQL `statement_timeout = 30s`** enforced at session level.
- **Slow query logging** via Prisma `$on('query')` above 500 ms threshold.
- **Health-checked connector monitoring** every 10 minutes with automatic degraded-status events.
- **Temporal workflows** with `scheduleToCloseTimeout`, `heartbeatTimeout`, and `backoffCoefficient: 2`.

### Observability Out of the Box

- **OpenTelemetry** auto-instrumentation with OTLP exporter — ships to Grafana, Datadog, Honeycomb, or any OTel backend.
- **26 Prometheus metrics** covering request volume, latency, error rate, connector health, workflow success, DLQ depth, and more.
- **Trace-to-log correlation** via request IDs.
- **952 automated tests** currently passing across unit, integration, and workflow suites.

### Scalability

- Stateless API tier — horizontal scale on Kubernetes.
- Multi-tenant from day one — single namespace, cryptographic isolation.
- Event-driven core — backpressure, retry, and replay without rewriting consumers.
- Connector workers scale independently of the control plane.

---

## Compliance Alignment

| Regulation | Coverage |
|---|---|
| **GDPR** | Articles 5, 15–22, 25, 30, 32, 33–34, 35 (DPIA) |
| **CCPA / CPRA** | Right to know, delete, correct, opt-out, limit use of SPI |
| **DPDPA (India)** | Notice, consent, data principal rights, breach reporting |
| **HIPAA** | Technical safeguards (encryption, audit, access control) |
| **ISO 27001** | Annex A — access control, cryptography, operations security, supplier relationships |
| **SOC 2** | CC6 (logical access), CC7 (system ops), CC8 (change mgmt) |

---

## Why TechD Wins

1. **Unified, not stitched** — discovery, DSAR, breach, retention, and vendor in one platform with one data model and one audit trail.
2. **Real data graph** — most competitors ship a "lineage view" that is just a static diagram. Ours is a queryable, bounded-BFS graph built on durable indexes.
3. **Connector depth** — 34 production connectors with a shared SDK that enforces reliability patterns every vendor needs but few implement.
4. **Cryptographic audit** — tamper-evident chain out of the box, not an after-thought logging bolt-on.
5. **Built on production primitives** — Temporal, NATS JetStream, Prisma, OpenTelemetry. No homegrown toy components.
6. **Observability-first** — 26 metrics, distributed tracing, slow-query logging — so your SRE team trusts it in production.
7. **DPDPA-ready** — purpose-built for Indian DPDPA adoption while preserving GDPR/CCPA fidelity.

---

## Deployment Options

- **Managed SaaS** — multi-tenant, region-pinned (US, EU, IN).
- **Private Cloud** — single-tenant deployment in your AWS/Azure/GCP account.
- **Hybrid** — control plane managed, data plane in your VPC (sensitive data never leaves your network).

---

## Get Started

- **Book a demo**: sales@techd.example
- **Pilot**: 30-day guided proof-of-value with two connectors and one workflow
- **Technical deep dive**: architecture@techd.example

> TechD PrivacyOps — *where privacy stops being paperwork and starts being proof.*
