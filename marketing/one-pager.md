# TechD PrivacyOps + DSPM — One-Pager

### One platform. Every regulation. Every data source. Every workflow.

---

**TechD PrivacyOps** is a unified, multi-tenant, API-first control plane for privacy operations and data security posture management (DSPM). Replace five siloed tools with one system that discovers personal data, orchestrates DSAR and breach response, enforces retention, and produces cryptographically provable audit trails — across 34+ data sources, out of the box.

---

## What It Does — in 6 Lines

1. **Discovers** personal data across clouds, warehouses, databases, SaaS apps, and collaboration tools via 34 production connectors.
2. **Classifies** sensitive fields and maps them into a live, queryable Data Graph.
3. **Orchestrates** DSAR, breach, retention, DPIA, vendor review, and deletion as durable Temporal workflows.
4. **Enforces** consent, retention, and access policies with per-tenant cryptographic isolation.
5. **Proves** compliance via SHA-256 chained audit logs and 26 Prometheus metrics.
6. **Scales** on Kubernetes with stateless APIs, NATS JetStream events, and horizontally sharded workers.

---

## Built-In Capabilities

| Pillar | What You Get |
|---|---|
| **Discovery** | 34 connectors (AWS, Azure, GCP, Snowflake, BigQuery, Salesforce, M365, Workday, Okta, Slack, GitHub, and more) |
| **DSAR Engine** | End-to-end Access / Delete / Rectify / Port / Restrict with jurisdiction-aware SLAs |
| **Breach Ops** | Blast-radius analysis via Data Graph; GDPR Art. 33 / DPDPA regulator-ready packs |
| **Data Graph** | Bounded BFS path-finding, neighbor expansion, subgraph queries on million-node estates |
| **Consent** | Per-subject × per-purpose × per-jurisdiction with full change history |
| **Retention** | Policy-driven auto-deletion with proof-of-deletion evidence |
| **DPIA / Vendor** | Risk scoring, approval chains, immutable sign-offs |
| **Security** | AES-256-GCM envelope encryption, HKDF per-tenant keys, 6-layer RBAC |
| **Audit** | SHA-256 integrity chain, tamper-evident, per-tenant state |
| **Reliability** | 30s request timeout, retry-with-jitter, DLQ, idempotent consumers, distributed locks |
| **Observability** | OpenTelemetry + 26 Prometheus metrics, slow-query logging, trace-to-log correlation |
| **Testing** | 952 automated tests passing across unit, integration, and workflow suites |

---

## Compliance Alignment

**GDPR · CCPA / CPRA · DPDPA (India) · HIPAA · ISO 27001 · SOC 2**

---

## Architecture at a Glance

- **API**: NestJS, stateless, horizontally scalable
- **Workflow**: Temporal — durable execution with exponential backoff
- **Events**: NATS JetStream with DLQ and idempotent consumers
- **Storage**: PostgreSQL (Prisma) with composite indexes and 30s statement timeouts
- **Encryption**: AES-256-GCM envelope + HKDF per-tenant key derivation
- **Observability**: OpenTelemetry (OTLP) + Prometheus
- **Deployment**: Kubernetes-native; SaaS, private-cloud, or hybrid

---

## Why Buy TechD

- **Unified** — not a toolkit of five products bolted together
- **Cryptographically provable** audit trails, not append-only log files
- **Connector depth** — 34 out of the box, new ones built in days on a hardened SDK
- **Graph-native lineage** — not a static diagram
- **Production-primitive core** — Temporal, NATS, Prisma, OTel. Nothing homegrown.
- **DPDPA-ready** for the Indian market while preserving GDPR/CCPA fidelity
- **Built for SRE teams** — 952 tests, 26 metrics, distributed tracing, 30s timeouts everywhere

---

**Contact**: sales@techd.example · **Pilot**: 30 days, 2 connectors, 1 workflow, 0 risk

> *Where privacy stops being paperwork and starts being proof.*
