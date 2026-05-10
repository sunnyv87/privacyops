# TechD PrivacyOps — Production Infrastructure Decision Document

> **Version:** 2.0
> **Date:** 2026-03-15
> **Scope:** DigitalOcean vs AWS production infrastructure comparison
> **Audience:** Infrastructure team, Engineering leadership, FinOps

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Application Runtime Assumptions](#2-application-runtime-assumptions)
3. [Required Production Components](#3-required-production-components)
4. [DigitalOcean Architecture — MVP](#4-digitalocean-architecture--mvp)
5. [DigitalOcean Architecture — Growth](#5-digitalocean-architecture--growth)
6. [DigitalOcean Architecture — Enterprise Scale](#6-digitalocean-architecture--enterprise-scale)
7. [AWS Architecture — MVP](#7-aws-architecture--mvp)
8. [AWS Architecture — Growth](#8-aws-architecture--growth)
9. [AWS Architecture — Enterprise Scale](#9-aws-architecture--enterprise-scale)
10. [Cost Comparison Table](#10-cost-comparison-table)
11. [Operational Tradeoffs](#11-operational-tradeoffs)
12. [Security / HA / Backup Requirements](#12-security--ha--backup-requirements)
13. [Final Recommendation for TechD](#13-final-recommendation-for-techd)
14. [Migration / Future-Proofing Advice](#14-migration--future-proofing-advice)
15. [Risks / Assumptions](#15-risks--assumptions)

---

## 1. Executive Summary

PrivacyOps is an enterprise-grade Privacy Operations, DSPM, and Data Security Intelligence platform comprising 39 NestJS modules, 246 API routes, multiple worker processes, an event pipeline (NATS JetStream), a workflow engine (Temporal), a search layer (OpenSearch), and a full observability stack. It is designed for multi-tenant SaaS deployment with Row-Level Security in PostgreSQL.

**Bottom line:**

| | DigitalOcean | AWS (ap-south-1) |
|---|---|---|
| **MVP Cost** | ~$530/mo | ~$1,080/mo |
| **Growth Cost** | ~$1,250/mo | ~$2,450/mo |
| **Enterprise Scale Cost** | ~$3,100/mo | ~$5,800/mo |
| **Best for** | Speed to launch, cost sensitivity | Compliance, enterprise customers, long-term scale |

**Recommendation:** Launch production on **AWS** using existing Terraform/Helm IaC. The compliance posture (KMS, IAM, HIPAA eligibility) is a selling point for a privacy platform. Use DigitalOcean for staging/dev to save ~60%. If budget is the hard constraint for the first 6 months, launch MVP on DigitalOcean with a planned migration path to AWS before onboarding enterprise customers.

---

## 2. Application Runtime Assumptions

### A. Application Services

| Service | Process | Replicas (MVP) | CPU Request | Memory Request | Notes |
|---------|---------|----------------|-------------|----------------|-------|
| API Server | `node dist/main.js` (NestJS, port 4000) | 2 | 500m | 512 Mi | Stateless, JWT auth, health probes |
| Web Frontend | Next.js standalone (port 3000) | 2 | 250m | 256 Mi | SSR, internal API routing |
| Scan Worker | `node dist/workers/scan-worker.js` | 1–20 (HPA) | 500m–2000m | 1–4 Gi | CPU-intensive; subscribes to NATS `scan.queued` |
| Temporal Worker | `node dist/workers/temporal-worker.js` | 2 | 500m | 1 Gi | Runs 6 concurrent task queues (scan, dsar, breach, retention, approval, vendor) via `Promise.all`; handles workflow signals for human-in-the-loop |
| Keycloak | Quay image, port 8080 | 2 | 500m | 1 Gi | OIDC/SAML IdP; uses PostgreSQL backend |
| Temporal Server | `temporalio/auto-setup:1.23` | 2 | 500m | 1 Gi | Requires its own PostgreSQL database |
| NATS | `nats:2.10-alpine` with JetStream | 3 | 128m | 256 Mi | Lightweight; event bus for the platform |

**Total steady-state pod resource requests (MVP):** ~5 vCPU, ~7.5 Gi RAM (excluding scan worker bursts).

### B. Data Layer

| Component | Technology | Role | Data Characteristics |
|-----------|-----------|------|---------------------|
| Relational DB | PostgreSQL 16 | Primary data store | RLS per tenant, 40+ tables, Prisma migrations, audit log triggers. MVP: 5–20 GB. Growth: 50–200 GB. |
| Cache | Redis 7 / Valkey | Session, rate limiting, distributed locks | Low memory: 256 MB–2 GB active. Eviction acceptable. |
| Event Bus | NATS 2.10 JetStream | Async event pipeline | 15+ event types. Currently 93% unconsumed — pipeline will grow. |
| Workflow Engine | Temporal 1.23 | Long-running orchestration | Scan workflows, DSAR fulfillment, breach response. Backed by PostgreSQL. |
| Search / Index | OpenSearch 2.12 | Full-text search, analytics | Asset search, classification lookup, audit log search. MVP: 5–10 GB index. |
| Object Storage | S3-compatible | DSAR packages, scan reports, evidence | MVP: 10–50 GB. Growth: 100–500 GB. |
| Graph | PostgreSQL (SQL-based) | Data graph with BFS traversal | 11 node types, edges table. No separate graph DB needed at current scale. |

### C. Platform / Ops

| Component | Requirement | Mandatory? |
|-----------|------------|------------|
| Ingress / Load Balancer | L7 with TLS termination, rate limiting (100 req/min) | **Mandatory** |
| DNS | Two subdomains: `api.privacyops.techd.com`, `app.privacyops.techd.com` | **Mandatory** |
| TLS / Certs | Let's Encrypt via cert-manager on K8s | **Mandatory** |
| Secrets Management | JWT secret, DB credentials, S3 keys, KMS key, SMTP creds, Anthropic API key | **Mandatory** |
| Logging | Structured JSON logs from API + workers | **Mandatory** |
| Metrics | Prometheus scraping `/api/v1/metrics` every 15s | **Mandatory** — 15 alert rules already defined |
| Tracing | Jaeger with OTLP HTTP (port 4318), 10% sampling | **Optional at MVP** — recommended for Growth |
| Alerting | PrometheusRules: API health, dependency health, connectors, events, workflows, business flows | **Mandatory** |
| CI/CD Runners | GitHub Actions (already configured) | **Mandatory** — no self-hosted runners needed |
| Backup / DR | Database PITR, object storage versioning | **Mandatory** |
| Container Registry | Docker images for API + Web | **Mandatory** — GHCR already configured |

### D. Background / Batch Workloads

| Job Type | Trigger | Worker | Concurrency Profile |
|----------|---------|--------|-------------------|
| Discovery scans | NATS `scan.queued` or Temporal `scan-queue` | Scan Worker | Burst: 1–20 concurrent scans |
| Classification | Temporal activity (per-asset) | Temporal Worker | Sequential per asset, parallel across assets |
| Risk scoring | Temporal activity (post-classification) | Temporal Worker | Low CPU, I/O-bound |
| Lineage computation | API-triggered, PostgreSQL BFS | API Server | CPU-moderate, bounded by graph size |
| DSAR fulfillment | Temporal workflow | Temporal Worker | Infrequent, long-running (hours/days) |
| Breach response | Temporal workflow | Temporal Worker | Critical path — must not fail |
| Remediation execution | Temporal workflow | Temporal Worker | Low frequency, high importance |
| Scheduled connector syncs | Cron / NestJS scheduler | API Server | Periodic, configurable per data source |

---

## 3. Required Production Components

### Mandatory Components (All Environments)

| # | Component | Managed Preferred? | Can Self-Host? | Notes |
|---|-----------|-------------------|---------------|-------|
| 1 | **Kubernetes cluster** | Yes | — | Required for existing Helm charts, HPA, pod scheduling |
| 2 | **PostgreSQL 16** | **Yes — strongly** | Yes, but avoid | RLS, PITR backups, Multi-AZ critical for data integrity |
| 3 | **Redis 7 / Valkey** | Yes | Yes | Manageable self-hosted, but managed eliminates patching |
| 4 | **OpenSearch 2.12** | Preferred | Yes | Operationally complex self-hosted (JVM tuning, index management) |
| 5 | **NATS 2.10** | No managed option | **Must self-host** | Lightweight; 3-node cluster is simple to operate |
| 6 | **Temporal 1.23** | No managed option* | **Must self-host** | Requires dedicated PostgreSQL database |
| 7 | **Keycloak 24** | No managed option | **Must self-host** | Requires PostgreSQL backend |
| 8 | **S3-compatible storage** | **Yes** | — | S3 or Spaces — never self-host object storage in production |
| 9 | **Load Balancer** | **Yes** | — | Must be cloud-native for health checks and TLS |
| 10 | **Container Registry** | GHCR (existing) | — | Already configured in CI/CD |

*Temporal Cloud exists but starts at ~$200/mo and adds external dependency.

### Optional / Deferrable Components

| # | Component | When Needed | Notes |
|---|-----------|------------|-------|
| 11 | Managed Kafka | Growth+ if NATS is insufficient | DO offers managed Kafka ($147/mo). AWS has MSK. |
| 12 | Read replica (PostgreSQL) | 50+ tenants | Offload reporting/search queries |
| 13 | CDN | Growth+ | For static frontend assets; CloudFront or DO CDN |
| 14 | Dedicated OpenSearch cluster | Growth+ | Separate from app cluster when index > 50 GB |
| 15 | Log aggregation (Loki/ELK) | Growth+ | Centralized log search beyond `kubectl logs` |

---

## 4. DigitalOcean Architecture — MVP

**Target:** 5–10 enterprise customers, single-region, moderate data volume.

### Compute — DOKS Cluster

| Node Pool | Droplet Type | vCPU | RAM | Disk | Count | Monthly/Node | Purpose |
|-----------|-------------|------|-----|------|-------|-------------|---------|
| General | General Purpose (Dedicated) | 4 | 16 GB | 50 GB | 2 | $126 | API, Web, Temporal, NATS, Keycloak, observability |
| Workers | CPU-Optimized (Dedicated) | 4 | 8 GB | 25 GB | 1 | $84 | Scan workers (scale 0→5) |

> **Why General Purpose 4vCPU/16GB:** The general pool must run API (3×512 Mi), Web (2×256 Mi), Temporal server (1 Gi), Temporal worker (2×512 Mi), Keycloak (2×1 Gi), NATS (3×256 Mi), Prometheus, Grafana — totaling ~7 Gi memory requests. Two 16 GB nodes provide adequate headroom.

### Managed Data Services

| Service | DO Tier | Spec | HA | Monthly Cost |
|---------|---------|------|----|----|
| PostgreSQL | Managed DB — 4 vCPU / 8 GB shared | 115 GB disk, PG 16 | Primary + Standby | $80 × 2 = **$160** |
| Valkey (Redis) | Managed DB — 1 vCPU / 2 GB shared | 50 GB disk | Single node | **$30** |
| OpenSearch | Managed DB — 2 vCPU / 4 GB shared | 50 GB disk | Single node | **$60** |
| Spaces | Standard | 250 GB included | — | **$5** |

### Networking & Platform

| Component | DO Service | Monthly Cost |
|-----------|-----------|-------------|
| Load Balancer | DO LB (1×) | **$12** |
| DNS | DO DNS | Free |
| TLS | cert-manager + Let's Encrypt | Free |
| DOKS Control Plane | Standard (non-HA) | Free |
| Container Registry | GHCR (existing) | Free |

### Observability

| Component | Deployment | Cost |
|-----------|-----------|------|
| Prometheus | Self-hosted on DOKS (15-day retention) | Included in compute |
| Grafana | Self-hosted on DOKS | Included in compute |
| Jaeger | Deferred at MVP | $0 |
| DO Monitoring | Built-in droplet + DB metrics | Free |

### MVP Topology Summary

```
Internet
   │
   ▼
DO Load Balancer ($12/mo)
   │
   ├──► DOKS Cluster (Free control plane)
   │    ├── General Pool: 2× gp-4vcpu-16gb ($252)
   │    │   ├── API (×2)
   │    │   ├── Web (×2)
   │    │   ├── Temporal Server (×1)
   │    │   ├── Temporal Worker (×1)
   │    │   ├── NATS (×3, JetStream)
   │    │   ├── Keycloak (×1)
   │    │   ├── Prometheus + Grafana
   │    │   └── [headroom for burst]
   │    │
   │    └── Worker Pool: 1× c-4vcpu-8gb ($84)
   │        └── Scan Worker (×1, HPA 0→5)
   │
   ├──► Managed PostgreSQL ($160, HA)
   ├──► Managed Valkey ($30)
   ├──► Managed OpenSearch ($60)
   └──► Spaces ($5)
```

### DO MVP Monthly Total: ~$603

| Category | Cost |
|----------|------|
| Compute (DOKS nodes) | $336 |
| PostgreSQL (managed, HA) | $160 |
| Valkey / Redis (managed) | $30 |
| OpenSearch (managed) | $60 |
| Object Storage (Spaces) | $5 |
| Load Balancer | $12 |
| **Total** | **~$603** |

---

## 5. DigitalOcean Architecture — Growth

**Target:** 25–50 customers, multiple active connectors, heavier batch workloads.

### Compute — DOKS Cluster

| Node Pool | Droplet Type | vCPU | RAM | Count | Monthly/Node |
|-----------|-------------|------|-----|-------|-------------|
| General | General Purpose (Dedicated) | 4 | 16 GB | 4 | $126 |
| Workers | CPU-Optimized (Dedicated) | 4 | 8 GB | 2 (scale 1→8) | $84 |

### Managed Data Services

| Service | DO Tier | HA | Monthly Cost |
|---------|---------|----|----|
| PostgreSQL | 4 vCPU / 8 GB dedicated + read replica | Primary + Standby + Read Replica | **$320** |
| Valkey (Redis) | 2 vCPU / 4 GB shared | Primary + Standby | **$60** |
| OpenSearch | 4 vCPU / 8 GB shared, 2 nodes | Multi-node | **$160** |
| Spaces | Standard (500 GB usage) | — | **$10** |

### Networking & Platform

| Component | Monthly Cost |
|-----------|-------------|
| Load Balancer (×1) | $12 |
| DOKS HA Control Plane | $40 |
| DO DNS | Free |

### DO Growth Monthly Total: ~$1,274

| Category | Cost |
|----------|------|
| Compute (6 DOKS nodes) | $672 |
| PostgreSQL (managed, HA + replica) | $320 |
| Valkey / Redis (managed, HA) | $60 |
| OpenSearch (managed, multi-node) | $160 |
| Object Storage | $10 |
| Load Balancer | $12 |
| DOKS HA Control Plane | $40 |
| **Total** | **~$1,274** |

---

## 6. DigitalOcean Architecture — Enterprise Scale

**Target:** 100+ customers, high connector concurrency, large event volume.

### Compute — DOKS Cluster

| Node Pool | Droplet Type | vCPU | RAM | Count | Monthly/Node |
|-----------|-------------|------|-----|-------|-------------|
| General | General Purpose (Dedicated) | 8 | 32 GB | 5 | $252 |
| Workers | CPU-Optimized (Dedicated) | 8 | 16 GB | 3 (scale 2→15) | $168 |

### Managed Data Services

| Service | DO Tier | HA | Monthly Cost |
|---------|---------|----|----|
| PostgreSQL | 8 vCPU / 16 GB dedicated + 2 read replicas | Full HA | **$600** |
| Valkey (Redis) | 4 vCPU / 8 GB dedicated | HA cluster | **$160** |
| OpenSearch | 4 vCPU / 8 GB dedicated, 3 nodes | Multi-node HA | **$480** |
| Kafka | Managed Kafka (3 brokers) | HA | **$450** |
| Spaces | Standard (2 TB usage) | — | **$40** |

### DO Enterprise Monthly Total: ~$3,094

| Category | Cost |
|----------|------|
| Compute (8 DOKS nodes) | $1,764 |
| PostgreSQL (managed, HA + 2 replicas) | $600 |
| Valkey / Redis (managed, HA) | $160 |
| OpenSearch (managed, 3-node HA) | $480 |
| Kafka (managed, replaces NATS) | $450 |
| Object Storage | $40 |
| Load Balancer | $12 |
| DOKS HA Control Plane | $40 |
| Monitoring (DO Premium) | Included |
| **Total** | **~$3,094** (appx., may reach ~$3,500 with bandwidth overages and additional storage) |

### DigitalOcean Enterprise Scale — Limitations & Risks

- **No Spot instances** — scan worker bursts cost full price vs 60–70% savings on AWS.
- **No KMS** — encryption keys must be self-managed (HashiCorp Vault or app-level).
- **No fine-grained IAM** — service-to-service auth relies on network policy + secrets, not role-based cloud identity.
- **Max DOKS cluster size** — 1,000 nodes (sufficient, but less headroom than EKS).
- **Backup retention** — managed DB backups: 7-day PITR for PostgreSQL, 3-day for OpenSearch. Less than AWS (35-day RDS).
- **Compliance** — SOC 2 and ISO 27001 only. No HIPAA eligibility, no FedRAMP.
- **Single-region only** — no native multi-region replication for managed databases.

---

## 7. AWS Architecture — MVP

**Target:** 5–10 enterprise customers, single-region (ap-south-1 / Mumbai).

> Aligned with existing `infra/terraform/main.tf` and `infra/helm/privacyops/`.

### Compute — EKS Cluster

| Node Group | Instance Type | vCPU | RAM | Count | Capacity | Monthly/Node |
|------------|--------------|------|-----|-------|----------|-------------|
| General | t3.xlarge | 4 | 16 GB | 2 (min 2, max 5) | On-Demand | ~$130 |
| Workers | t3.large | 2 | 8 GB | 1 (min 0, max 10) | Spot (~$25/mo) | ~$25 |

### Managed Data Services

| Service | AWS Product | Spec | HA | Monthly Cost |
|---------|-------------|------|----|----|
| PostgreSQL | RDS PostgreSQL 16 | db.r6g.large (2 vCPU, 16 GB), 100 GB gp3 | Single-AZ (MVP) | **$195** |
| Redis | ElastiCache (Valkey) | cache.r6g.large (2 vCPU, 13 GB) | Single node | **$120** |
| OpenSearch | OpenSearch Service | r6g.large.search (2 vCPU, 16 GB) × 1 data node | No dedicated masters | **$125** |
| Object Storage | S3 Standard | 100 GB, KMS encryption | 11-nines | **$5** |

### Networking & Security

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| EKS Control Plane | 1 cluster (standard support) | **$73** |
| ALB | 1 ALB via NGINX Ingress Controller | **$22** |
| NAT Gateway | 1 gateway (single AZ) | **$35** |
| VPC | 10.0.0.0/16, 3 AZs, public + private subnets | Free |
| Route 53 | 1 hosted zone | **$1** |
| ACM | TLS certificates | Free |
| KMS | 1 customer-managed key | **$1** |

### Observability

| Component | Deployment | Cost |
|-----------|-----------|------|
| Prometheus | Self-hosted on EKS | Included in compute |
| Grafana | Self-hosted on EKS (6 dashboards) | Included in compute |
| Jaeger | Deferred at MVP | $0 |
| CloudWatch | EKS control plane logs | **$5** |

### AWS MVP Topology Summary

```
Internet
   │
   ▼
ALB ($22/mo) ──► NGINX Ingress
   │
   ├──► EKS Cluster ($73/mo control plane)
   │    ├── General Pool: 2× t3.xlarge On-Demand ($260)
   │    │   ├── API (×2)
   │    │   ├── Web (×2)
   │    │   ├── Temporal Server (×1)
   │    │   ├── Temporal Worker (×1)
   │    │   ├── NATS (×3, JetStream)
   │    │   ├── Keycloak (×1)
   │    │   └── Prometheus + Grafana
   │    │
   │    └── Worker Pool: 1× t3.large Spot ($25)
   │        └── Scan Worker (×1, HPA 0→10)
   │
   ├──► RDS PostgreSQL ($195, Single-AZ)
   ├──► ElastiCache Redis ($120, Single node)
   ├──► OpenSearch Service ($125, 1 data node)
   ├──► S3 ($5, KMS-encrypted)
   ├──► NAT Gateway ($35)
   └──► KMS + Route 53 ($2)
```

### AWS MVP Monthly Total: ~$887

| Category | Cost |
|----------|------|
| EKS Control Plane | $73 |
| Compute (EC2 nodes) | $285 |
| RDS PostgreSQL | $195 |
| ElastiCache Redis | $120 |
| OpenSearch Service | $125 |
| S3 | $5 |
| ALB | $22 |
| NAT Gateway | $35 |
| Route 53 + KMS + CloudWatch | $7 |
| Data Transfer (~50 GB) | $5 |
| **Total** | **~$872** |

> **Cost note:** MVP runs Single-AZ for RDS and single-node OpenSearch to minimize costs. This is acceptable for early production / pilot customers with documented SLA expectations. Upgrade to Multi-AZ before onboarding enterprise customers with uptime SLAs.

---

## 8. AWS Architecture — Growth

**Target:** 25–50 customers, multiple connectors, heavier workloads.

### Compute — EKS Cluster

| Node Group | Instance Type | vCPU | RAM | Count | Capacity | Monthly/Node |
|------------|--------------|------|-----|-------|----------|-------------|
| General | t3.xlarge | 4 | 16 GB | 3 (min 3, max 8) | On-Demand | ~$130 |
| Workers | t3.large | 2 | 8 GB | 2 (min 1, max 15) | Spot | ~$25 |

### Managed Data Services

| Service | Spec | HA | Monthly Cost |
|---------|------|----|----|
| RDS PostgreSQL 16 | db.r6g.large, 200 GB gp3 | **Multi-AZ** | **$340** |
| RDS Read Replica | db.r6g.large | Same AZ | **$170** |
| ElastiCache Redis | cache.r6g.large, 2 nodes | Primary + Replica | **$240** |
| OpenSearch Service | 2× r6g.large.search data + 3× t3.small.search masters | Multi-AZ aware | **$380** |
| S3 | 500 GB | — | **$12** |

### Networking & Platform

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| EKS Control Plane | 1 cluster | $73 |
| ALB | 1 ALB, higher traffic | $30 |
| NAT Gateway | 1 gateway | $45 |
| Route 53 | 1 zone + queries | $2 |
| KMS | 1 key | $1 |
| CloudWatch | Logs + metrics | $15 |
| Secrets Manager | 10 secrets | $4 |

### AWS Growth Monthly Total: ~$1,727

| Category | Cost |
|----------|------|
| EKS Control Plane | $73 |
| Compute (5 EC2 nodes) | $440 |
| RDS PostgreSQL (Multi-AZ + Read Replica) | $510 |
| ElastiCache Redis (HA) | $240 |
| OpenSearch Service (HA) | $380 |
| S3 | $12 |
| ALB + NAT | $75 |
| Platform (Route53, KMS, CW, SM) | $22 |
| Data Transfer (~150 GB) | $14 |
| **Total** | **~$1,766** |

> **With 1-year Reserved Instances** (EC2 general nodes + RDS): ~**$1,350/mo** (savings of ~$400/mo).

---

## 9. AWS Architecture — Enterprise Scale

**Target:** 100+ customers, high concurrency, large data volumes, HA requirements.

### Compute — EKS Cluster

| Node Group | Instance Type | vCPU | RAM | Count | Capacity | Monthly/Node |
|------------|--------------|------|-----|-------|----------|-------------|
| General | m6i.xlarge | 4 | 16 GB | 5 (min 4, max 12) | On-Demand | ~$155 |
| Workers | c6i.xlarge | 4 | 8 GB | 3 (min 2, max 20) | Spot | ~$40 |

> **Instance change:** Upgrade from t3 (burstable) to m6i/c6i (fixed-performance) to avoid CPU credit depletion under sustained load.

### Managed Data Services

| Service | Spec | HA | Monthly Cost |
|---------|------|----|----|
| RDS PostgreSQL 16 | db.r6g.xlarge (4 vCPU, 32 GB), 500 GB gp3 | Multi-AZ + 2 Read Replicas | **$950** |
| ElastiCache Redis | cache.r6g.xlarge, 3-node cluster | Cluster mode enabled | **$480** |
| OpenSearch Service | 3× r6g.xlarge.search data + 3× c6g.large.search masters | Multi-AZ, 3 dedicated masters | **$750** |
| S3 | 2 TB | — | **$50** |
| MSK (Kafka) | kafka.m5.large, 3 brokers | Multi-AZ | **$550** |

> **NATS → MSK migration:** At enterprise scale, replace NATS with MSK for durable event streaming with consumer groups, exactly-once semantics, and better operational tooling.

### Networking & Platform

| Service | Monthly Cost |
|---------|-------------|
| EKS Control Plane | $73 |
| ALB (2 — internal + external) | $50 |
| NAT Gateway (3 — one per AZ) | $135 |
| Route 53 | $5 |
| KMS (2 keys: data + envelope) | $2 |
| CloudWatch + X-Ray | $50 |
| Secrets Manager (30 secrets) | $12 |
| AWS Backup | $30 |
| WAF (on ALB) | $25 |
| GuardDuty | $15 |

### AWS Enterprise Monthly Total: ~$4,092

| Category | Cost |
|----------|------|
| EKS Control Plane | $73 |
| Compute (8 EC2 nodes) | $895 |
| RDS PostgreSQL (Multi-AZ + 2 replicas) | $950 |
| ElastiCache Redis (cluster mode) | $480 |
| OpenSearch Service (HA, dedicated masters) | $750 |
| MSK Kafka | $550 |
| S3 | $50 |
| Networking (ALB, NAT, Route53) | $190 |
| Security (WAF, GuardDuty, KMS) | $42 |
| Observability (CloudWatch, X-Ray) | $50 |
| Backup + Secrets Manager | $42 |
| Data Transfer (~500 GB) | $45 |
| **Total** | **~$4,117** |

> **With 1-year Savings Plans** (compute + DB): ~**$3,100/mo**.
> **With 3-year Reserved Instances**: ~**$2,500/mo**.

---

## 10. Cost Comparison Table

### Monthly Cost by Deployment Size

| | DigitalOcean | AWS (On-Demand) | AWS (1-yr RI/SP) |
|---|---|---|---|
| **MVP** (5–10 customers) | **$603** | $872 | ~$750 |
| **Growth** (25–50 customers) | **$1,274** | $1,766 | ~$1,350 |
| **Enterprise** (100+ customers) | **$3,094** | $4,117 | ~$3,100 |

### Cost Breakdown by Category (Growth Tier)

| Category | DigitalOcean | AWS |
|----------|-------------|-----|
| Compute (K8s nodes) | $672 | $440 |
| Kubernetes control plane | $40 | $73 |
| PostgreSQL (managed) | $320 | $510 |
| Redis / Valkey (managed) | $60 | $240 |
| OpenSearch (managed) | $160 | $380 |
| Object Storage | $10 | $12 |
| Load Balancer | $12 | $30 |
| Networking (NAT, DNS, etc.) | $0 | $47 |
| Security (KMS, WAF, etc.) | $0 | $5 |
| Monitoring | $0 | $15 |
| Data Transfer | $0 | $14 |
| **Total** | **$1,274** | **$1,766** |

> **Key observation:** DigitalOcean's cost advantage comes primarily from: free K8s control plane, no NAT Gateway costs, no data transfer charges (pooled bandwidth), cheaper managed databases, and cheaper OpenSearch. AWS's higher cost reflects more capable managed services (Multi-AZ RDS, ElastiCache replication, dedicated OpenSearch masters).

---

## 11. Operational Tradeoffs

| Dimension | DigitalOcean | AWS |
|-----------|-------------|-----|
| **Operational complexity** | Lower. Fewer services, simpler networking, flatter learning curve. | Higher. VPC design, IAM policies, security groups, NACLs, service mesh of managed services. |
| **Managed-service maturity** | Good for PostgreSQL, Valkey. OpenSearch is new (GA 2024). No Temporal managed service. | Excellent. RDS, ElastiCache, OpenSearch Service are battle-tested. More configuration knobs. |
| **Scaling flexibility** | DOKS auto-scale to 1,000 nodes. No Spot instances. No dedicated node taints (use labels + affinity). | EKS auto-scale with Karpenter/Cluster Autoscaler. Spot for workers. Node taints for workload isolation. |
| **Security / compliance** | SOC 2, ISO 27001. No KMS, no IAM roles, no VPC flow logs, no WAF, no GuardDuty. | SOC 2, ISO 27001, HIPAA eligible, PCI DSS, FedRAMP (GovCloud). Full security stack. |
| **Reliability** | Managed DB HA (primary + standby). 99.95% DOKS SLA. No multi-region DB replication. | Multi-AZ everything. 99.95% EKS SLA. Cross-region replication available. |
| **Observability** | Built-in basic monitoring. Must self-host Prometheus/Grafana/Jaeger. No native APM. | CloudWatch, X-Ray, Container Insights. Can still self-host Prometheus stack. Native log analytics. |
| **Incident response** | DO Status page, email support, premium support ($500/mo). | CloudWatch Alarms, SNS, PagerDuty integration. Enterprise Support plan available. |
| **Terraform support** | Good. `digitalocean/digitalocean` provider covers core resources. Less mature than AWS. | Excellent. Existing `main.tf` already written. Massive module ecosystem. |
| **Team skill requirements** | Lower. Most of the stack is straightforward K8s + managed DBs. | Higher. Requires AWS-specific knowledge: IAM, VPC, security groups, etc. |
| **Vendor lock-in risk** | Low. Spaces is S3-compatible, DOKS is standard K8s, managed DBs use standard engines. | Moderate. RDS, ElastiCache, OpenSearch Service, KMS, IAM are AWS-specific APIs. Core apps are portable. |

---

## 12. Security / HA / Backup Requirements

### Minimum Security Baseline (Production)

| Requirement | DigitalOcean | AWS |
|-------------|-------------|-----|
| **Encryption at rest (DB)** | Managed DB encrypts at rest by default | RDS + ElastiCache encryption at rest via KMS |
| **Encryption in transit** | TLS everywhere (cert-manager) | TLS + VPC internal encryption |
| **Secrets management** | K8s Secrets (sealed-secrets or external-secrets) | Secrets Manager or SSM Parameter Store + K8s external-secrets |
| **App-level encryption** | AES-256-GCM envelope encryption (self-managed master key) | AES-256-GCM with AWS KMS as master key provider |
| **Network isolation** | VPC, Cloud Firewalls, private DB connections | VPC, Security Groups, NACLs, private subnets, NAT Gateway |
| **Identity / access control** | DO API tokens (team-level) | IAM roles for service accounts (IRSA), fine-grained policies |
| **Container security** | Non-root (UID 1001), read-only rootfs, dropped caps ✓ | Same + ECR image scanning, GuardDuty for runtime |
| **Audit logging** | Application-level (PostgreSQL triggers) ✓ | Application-level + CloudTrail for infrastructure audit |
| **Vulnerability scanning** | CI/CD: pnpm audit + TruffleHog ✓ | Same + ECR native scanning, Inspector |
| **WAF** | Not available natively | AWS WAF on ALB (OWASP rules) |
| **DDoS protection** | Basic (Cloud Firewalls) | AWS Shield Standard (free), Shield Advanced ($3K/mo) |

### Minimum HA Posture

| Component | MVP (Acceptable) | Growth+ (Required) |
|-----------|-----------------|-------------------|
| PostgreSQL | Single-AZ OK | **Multi-AZ mandatory** |
| Redis | Single node OK | **Primary + replica mandatory** |
| OpenSearch | Single node OK | **2+ data nodes, dedicated masters** |
| API | 2 replicas minimum | 3+ replicas |
| NATS | 3-node cluster always | 3-node cluster always |
| Temporal | 1 server OK | 2+ servers with persistence |
| K8s control plane | Standard | **HA control plane mandatory** |

### Minimum Backup Posture

| Component | Requirement | DigitalOcean | AWS |
|-----------|------------|-------------|-----|
| PostgreSQL | Daily automated + 7-day PITR minimum | 7-day PITR ✓ | 35-day PITR (configurable) ✓ |
| Redis | Daily snapshot | Automatic ✓ | Daily snapshots ✓ |
| OpenSearch | Daily snapshots | Hourly + 3-day daily | Automated to S3, configurable retention |
| Object Storage | Versioning + cross-region optional | Spaces versioning (limited) | S3 versioning + cross-region replication |
| K8s state | Etcd backup (managed by provider) | Managed ✓ | Managed ✓ |
| Secrets | External backup of encryption keys | Manual export | Secrets Manager with automatic rotation |
| Disaster recovery RTO | MVP: 4 hours. Growth: 1 hour. Enterprise: 15 min. | Achievable to 1 hour | Achievable to 15 min with Multi-AZ + automated failover |

---

## 13. Final Recommendation for TechD

### Option A — Lower Cost, Faster Launch

**Platform:** DigitalOcean
**Best for:** Budget-constrained first 6–12 months, pilot customers, internal production.

| Aspect | Detail |
|--------|--------|
| **Launch cost** | ~$603/mo (MVP) |
| **Time to deploy** | 1–2 weeks (simpler stack) |
| **Managed services** | PostgreSQL, Valkey, OpenSearch (all managed) |
| **Tradeoffs** | No KMS, no IAM roles, weaker compliance story, no Spot instances, limited DR options |
| **When to migrate away** | When enterprise customers require HIPAA/SOC 2 Type II documentation, or scan workloads need Spot economics |

### Option B — Stronger Enterprise-Grade Production

**Platform:** AWS (ap-south-1)
**Best for:** Enterprise customer contracts, compliance-driven sales, long-term platform.

| Aspect | Detail |
|--------|--------|
| **Launch cost** | ~$872/mo (MVP), optimizable to ~$750 with Savings Plans |
| **Time to deploy** | 2–3 weeks (Terraform + Helm already written) |
| **Managed services** | RDS, ElastiCache, OpenSearch Service, S3, KMS, Secrets Manager |
| **Advantages** | KMS encryption, IAM roles, Multi-AZ, Spot instances, WAF, GuardDuty, 35-day PITR, compliance certifications |
| **Growth path** | Clear vertical + horizontal scaling path through Enterprise Scale |

### Recommended Path

```
┌─────────────────────────────────────────────────────────────┐
│                    RECOMMENDED APPROACH                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRODUCTION (AWS ap-south-1)                                │
│  ├── MVP: ~$872/mo                                          │
│  ├── Use existing Terraform + Helm configs                  │
│  ├── Single-AZ RDS to start (upgrade before enterprise SLA) │
│  ├── Spot instances for scan workers                        │
│  └── Apply Savings Plans at month 3 → ~$750/mo             │
│                                                             │
│  STAGING / DEV (DigitalOcean BLR)                           │
│  ├── Scaled-down: ~$300/mo                                  │
│  ├── 1 general node, 0 worker nodes                         │
│  ├── Single-node PostgreSQL, Valkey, OpenSearch              │
│  └── Used for CI/CD deployment targets and QA               │
│                                                             │
│  ALTERNATIVE: If budget < $900/mo is a hard constraint      │
│  ├── Launch MVP on DigitalOcean ($603/mo)                   │
│  ├── Plan AWS migration before first enterprise contract    │
│  └── Architecture is portable (K8s + standard engines)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why AWS for production:**
1. **You are building a privacy platform.** Your customers will audit your infrastructure. AWS compliance certifications (SOC 2 Type II, HIPAA eligibility, ISO 27001) are a competitive advantage.
2. **KMS is not optional for a DSPM product.** You already have envelope encryption coded with KMS ARN references. Self-managing master keys on DigitalOcean adds risk.
3. **Your IaC is already written.** The `infra/terraform/main.tf` and `infra/helm/privacyops/` are AWS-ready. Rewriting for DigitalOcean costs engineering time.
4. **Spot instances matter.** Scan workers are burst workloads. Spot saves 60–70% on the most elastic part of your infrastructure.
5. **The cost gap narrows with Savings Plans.** At growth tier: DO $1,274 vs AWS $1,350 (with 1-yr RI) — only $76/mo difference for substantially more capable infrastructure.

---

## 14. Migration / Future-Proofing Advice

### Architecture Decisions to Make Now

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Run on K8s vs simpler compute?** | **Kubernetes.** Already have Helm charts, HPA, multi-service topology. Not worth simplifying. | DOKS and EKS are both managed. The complexity is already absorbed by Helm. |
| **NATS vs managed Kafka?** | **NATS for MVP/Growth.** Migrate to MSK/managed Kafka at enterprise scale only. | NATS is lightweight (768 Mi total for 3-node cluster) and handles current event volume. Kafka adds $150–550/mo and operational overhead. |
| **Graph DB vs PostgreSQL?** | **Stay on PostgreSQL.** | SQL-based BFS in `data_graph_nodes`/`data_graph_edges` is sufficient until >1M edges per tenant. Neo4j adds a new stateful service to manage. |
| **Observability: cloud-native vs open-source?** | **Hybrid.** Self-hosted Prometheus/Grafana (already built) + cloud-native for infrastructure metrics (CloudWatch or DO Monitoring). | Your 6 Grafana dashboards and 15 PrometheusRules are already production-grade. Don't re-implement in CloudWatch. |
| **Temporal: self-hosted vs Temporal Cloud?** | **Self-hosted for MVP/Growth.** Evaluate Temporal Cloud ($200+/mo) at enterprise scale to reduce ops burden. | Self-hosting is manageable at low volume. If workflow volume > 10K/day, managed service is worth it. |

### Keeping Migration Easy

1. **Use S3-compatible APIs everywhere.** Spaces and S3 share the API. Your `S3_ENDPOINT` env var already supports both.
2. **Keep secrets in Kubernetes external-secrets.** This abstracts the backend (DO Vault, AWS Secrets Manager, etc.).
3. **Pin to standard engine versions.** PostgreSQL 16, Redis/Valkey 7, OpenSearch 2.12 — these are the same on both platforms.
4. **Avoid AWS-only features in application code.** The only AWS-specific integration is KMS. Abstract it behind the existing `CryptoService` interface — swap to self-managed keys on DO if needed.
5. **Container images are portable.** GHCR images deploy identically to DOKS and EKS.
6. **Helm values are the only diff.** Maintain separate `values-do.yaml` and `values-aws.yaml` for each platform.

---

## 15. Risks / Assumptions

### Assumptions

| # | Assumption | Impact if Wrong |
|---|-----------|----------------|
| A1 | MVP starts with 5–10 tenants, each with <10 data sources | If more, scan workers need larger pool earlier |
| A2 | Average data volume: 1–5 GB scanned per tenant per sync | If higher (e.g., data lakes), OpenSearch and storage costs increase |
| A3 | Concurrent API users: 50–100 at MVP, 500+ at enterprise | If higher, API replicas and Redis need to scale faster |
| A4 | Event pipeline is currently 93% unconsumed | As consumers are wired, NATS/Kafka resource needs will grow |
| A5 | Mumbai region provides acceptable latency for initial India-first customers | International customers may need multi-region |
| A6 | Only S3 and PostgreSQL connectors are production-ready | Other connectors (MySQL, MongoDB, Azure, GCP, Snowflake) are stubs and won't contribute to scan volume yet |
| A7 | Anthropic API (Claude) costs are billed separately via API key | Not included in infrastructure estimates |
| A8 | SMTP (email) is handled by external service (SendGrid, SES) | Not included in infrastructure estimates; SES adds ~$1/mo at MVP volume |

### Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | **DigitalOcean managed OpenSearch is new (GA 2024)** — may have stability gaps for production search workloads | Medium | Monitor closely; have fallback plan to self-host on DOKS if managed service has issues |
| R2 | **Single-AZ RDS at MVP** — database outage during AZ failure | Medium | Accept for pilot phase; upgrade to Multi-AZ before enterprise SLAs |
| R3 | **Self-hosted Temporal adds ops burden** — version upgrades, schema migrations, monitoring | Medium | Pin version, automate upgrades via Helm, monitor with existing PrometheusRules |
| R4 | **Self-hosted NATS JetStream** — data loss risk if nodes fail before replication | Low | 3-node cluster with R=3 replication. NATS is battle-tested at this scale. |
| R5 | **Scan worker Spot interruptions** (AWS) | Low | Spot handles interruptions gracefully with 2-minute warning. Scan jobs are idempotent and restartable. |
| R6 | **Cost overrun from OpenSearch growth** | Medium | Set index lifecycle policies. Archive old indices to S3/cold storage. Monitor index size. |
| R7 | **Keycloak operational complexity** | Medium | Consider Auth0/Clerk at enterprise scale if Keycloak becomes a maintenance burden |
| R8 | **No multi-region from day 1** | Low (MVP) / High (Enterprise) | Design stateless API layer from the start (done ✓). Multi-region DB requires Aurora Global or manual replication. |

### Pricing Disclaimer

> All costs are estimates based on publicly available pricing as of March 2026. Actual costs may vary based on:
> - Usage patterns (data transfer, API calls, storage growth)
> - Negotiated contracts or startup credits
> - Tax and compliance surcharges by region
> - Reserved Instance / Savings Plan commitment levels
>
> **Sources:**
> - [DigitalOcean Pricing](https://www.digitalocean.com/pricing)
> - [DigitalOcean Managed Databases](https://www.digitalocean.com/pricing/managed-databases)
> - [DigitalOcean Kubernetes](https://www.digitalocean.com/pricing/kubernetes)
> - [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
> - [AWS RDS Pricing](https://aws.amazon.com/rds/pricing/)
> - [AWS ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
> - [AWS OpenSearch Pricing](https://aws.amazon.com/opensearch-service/pricing/)
> - [AWS EKS Pricing](https://aws.amazon.com/eks/pricing/)
