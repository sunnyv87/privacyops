# PrivacyOps — Infrastructure Requirements & Cost Comparison

## Application Overview

PrivacyOps is a multi-tenant privacy compliance platform with the following components:

| Component | Tech | Role |
|-----------|------|------|
| API Server | NestJS (Node 20) | REST API, 3 replicas |
| Web Frontend | Next.js (Node 20) | SSR frontend, 2 replicas |
| Scan Workers | Node.js | CPU-intensive data scanning, 2–20 replicas (HPA) |
| Temporal Workers | Node.js | Workflow orchestration workers, 2 replicas |
| PostgreSQL 16 | Database | Primary data store with RLS, multi-AZ |
| Redis 7 | Cache | Session cache, rate limiting |
| OpenSearch 2.12 | Search engine | Full-text search & analytics |
| NATS 2.10 | Message broker | Event-driven messaging with JetStream |
| Temporal 1.23 | Workflow engine | Long-running workflow orchestration |
| Keycloak 24 | IAM | OIDC/SAML authentication |
| Object Storage | S3/Spaces | Encrypted document & scan result storage |
| Observability | Prometheus + Grafana + Jaeger | Metrics, dashboards, distributed tracing |

---

## Option A — AWS (ap-south-1 / Mumbai)

This aligns with the existing Terraform configuration in `infra/terraform/main.tf`.

### Compute — EKS (Elastic Kubernetes Service)

| Node Group | Instance Type | vCPU | RAM | Count | Capacity | Purpose |
|------------|--------------|------|-----|-------|----------|---------|
| General | t3.xlarge | 4 | 16 GB | 3 (min 2, max 10) | On-Demand | API, Web, Temporal workers, observability |
| Scan Workers | t3.large | 2 | 8 GB | 1 (min 0, max 20) | Spot | Scan worker pods (tainted, dedicated) |

### Managed Data Services

| Service | AWS Product | Spec | HA | Notes |
|---------|-------------|------|----|----|
| PostgreSQL | RDS PostgreSQL 16 | db.r6g.large (2 vCPU, 16 GB) | Multi-AZ | 100–500 GB auto-scaling storage, 30-day backups, Performance Insights |
| Redis | ElastiCache | cache.r6g.large (2 vCPU, 13 GB) | 2 nodes (primary + replica) | Encryption at rest & in transit |
| OpenSearch | OpenSearch Service | r6g.large.search (2 vCPU, 16 GB) | 2 data nodes, 3 dedicated masters (t3.small) | Fine-grained access control |
| Object Storage | S3 | Standard tier | 11-nines durability | KMS encryption, public access blocked |
| Temporal | Self-hosted on EKS | Runs on general node group | 2 replicas | Uses RDS PostgreSQL as its backend |
| NATS | Self-hosted on EKS | Runs on general node group | 3-node JetStream cluster | Lightweight, ~256 MB per node |
| Keycloak | Self-hosted on EKS | Runs on general node group | 2 replicas | Uses RDS PostgreSQL as backend |

### Networking & Security

| Service | AWS Product | Spec |
|---------|-------------|------|
| Load Balancer | ALB (via NGINX Ingress) | 2 targets (api + web), TLS termination |
| VPC | Custom VPC | 10.0.0.0/16, 3 AZs, public + private subnets |
| NAT Gateway | NAT Gateway | 1 (staging) / 3 (production, one per AZ) |
| DNS | Route 53 | Hosted zone for privacyops.techd.com |
| TLS | ACM + cert-manager | Free certificates via Let's Encrypt |
| Encryption | KMS | Master key with annual rotation |

### Observability

| Component | Deployment | Notes |
|-----------|------------|-------|
| Prometheus | Self-hosted on EKS | 15-day retention, ~20 GB storage |
| Grafana | Self-hosted on EKS | 6 pre-built dashboards |
| Jaeger | Self-hosted on EKS | OTLP collector, 10% sampling rate |
| CloudWatch | AWS native | EKS control plane logs, RDS metrics |

### AWS Monthly Cost Estimate (Production)

| Resource | Spec | Monthly Cost (USD) |
|----------|------|--------------------|
| **EKS Control Plane** | 1 cluster | $73 |
| **EC2 — General Nodes** | 3× t3.xlarge On-Demand | $450 |
| **EC2 — Scan Workers** | 1–5× t3.large Spot (avg 3) | $75–125 |
| **RDS PostgreSQL** | db.r6g.large, Multi-AZ, 100 GB | $340 |
| **ElastiCache Redis** | cache.r6g.large, 2 nodes | $310 |
| **OpenSearch Service** | 2× r6g.large.search + 3× t3.small masters | $420 |
| **S3** | 100 GB Standard + requests | $5 |
| **ALB** | 1 ALB + traffic | $25 |
| **NAT Gateway** | 1 gateway + data processing | $45 |
| **Route 53** | 1 hosted zone + queries | $2 |
| **KMS** | 1 key + API calls | $3 |
| **Data Transfer** | ~100 GB/month outbound | $9 |
| | | |
| **Total (AWS)** | | **~$1,760–$1,810/mo** |

> **Notes:**
> - Spot instances for scan workers can save 60–70% vs On-Demand.
> - Mumbai pricing is ~10–15% cheaper than us-east-1 for most services.
> - Reserved Instances (1-year) for general nodes and RDS can reduce costs by ~30% (~$1,250/mo).
> - OpenSearch is the single most expensive managed service; self-hosting on EKS saves ~$200/mo but adds operational burden.

---

## Option B — DigitalOcean

### Compute — DOKS (DigitalOcean Kubernetes Service)

| Node Pool | Droplet Type | vCPU | RAM | Count | Purpose |
|-----------|-------------|------|-----|-------|---------|
| General | Professional, 4 vCPU / 8 GB | 4 | 8 GB | 3 (min 2, max 8) | API, Web, Temporal workers, NATS, observability |
| Scan Workers | CPU-Optimized, 4 vCPU / 8 GB | 4 | 8 GB | 1 (min 0, max 10) | Scan worker pods (auto-scaled) |

> **Note:** DigitalOcean droplets cap at 8 GB for the 4-vCPU general tier. For workloads needing 16 GB+, use the 8 vCPU / 16 GB tier ($96/mo each), which increases general pool cost.

### Managed Data Services

| Service | DO Product | Spec | HA | Notes |
|---------|-----------|------|----|----|
| PostgreSQL | Managed Databases | 4 vCPU / 8 GB (db-s-4vcpu-8gb) | Primary + standby | Auto backups, connection pooling included |
| Redis | Managed Databases | 2 vCPU / 4 GB (db-s-2vcpu-4gb) | Primary + standby | Eviction policies configurable |
| OpenSearch | **Not available as managed service** | Must self-host on DOKS | 3-node cluster on general pool | Significant operational overhead |
| Object Storage | Spaces | 250 GB included | CDN available | S3-compatible API, $5/mo base |
| Temporal | Self-hosted on DOKS | Runs on general pool | 2 replicas | Uses managed PostgreSQL as backend |
| NATS | Self-hosted on DOKS | Runs on general pool | 3-node cluster | Lightweight |
| Keycloak | Self-hosted on DOKS | Runs on general pool | 2 replicas | Uses managed PostgreSQL |

### Networking & Security

| Service | DO Product | Spec |
|---------|-----------|------|
| Load Balancer | DO Load Balancer | 1 LB, TLS termination, proxy protocol |
| VPC | VPC | Auto-created per region, private networking |
| DNS | DO DNS | Free with domain |
| TLS | Let's Encrypt via cert-manager | Free certificates |
| Firewall | Cloud Firewalls | Stateful firewall rules |

> **Limitations vs AWS:**
> - No NAT Gateway equivalent (nodes get public IPs or use VPC-only droplets with limited egress options).
> - No KMS — encryption at rest is handled by managed DB; app-level encryption requires self-managed keys.
> - No managed OpenSearch — must self-host, adding 3 droplets' worth of resources to the general pool.
> - No IAM roles — API keys only, less granular access control.
> - DOKS does not support node taints for dedicated scan worker pools (workaround: use node affinity with labels).

### Observability

| Component | Deployment | Notes |
|-----------|------------|-------|
| Prometheus | Self-hosted on DOKS | Same as AWS |
| Grafana | Self-hosted on DOKS | Same as AWS |
| Jaeger | Self-hosted on DOKS | Same as AWS |
| DO Monitoring | Built-in | Basic droplet/DB metrics, free |

### DigitalOcean Monthly Cost Estimate (Production)

| Resource | Spec | Monthly Cost (USD) |
|----------|------|--------------------|
| **DOKS Control Plane** | 1 cluster | Free |
| **Droplets — General Pool** | 3× Professional 4vCPU/8GB | $144 |
| **Droplets — Scan Workers** | 1–3× CPU-Optimized 4vCPU/8GB (avg 2) | $126 |
| **Managed PostgreSQL** | 4 vCPU / 8 GB, Primary + Standby | $150 |
| **Managed Redis** | 2 vCPU / 4 GB, Primary + Standby | $80 |
| **OpenSearch (self-hosted)** | 3× nodes on general pool (need larger pool or dedicated nodes) | $0 (included in pool)* |
| **Spaces (Object Storage)** | 250 GB | $5 |
| **Load Balancer** | 1 LB | $12 |
| **DNS** | 1 domain | Free |
| **Bandwidth** | 3 TB pooled (included with droplets) | $0 |
| | | |
| **Subtotal** | | **~$517/mo** |
| **Adjustment: Larger General Pool for OpenSearch** | Upgrade to 4× 8vCPU/16GB nodes | +$240 |
| | | |
| **Total (DigitalOcean)** | | **~$750–$800/mo** |

> **Notes:**
> - DOKS control plane is free (vs $73/mo for EKS).
> - No NAT Gateway costs.
> - Self-hosting OpenSearch requires dedicating 3 nodes (~3 GB heap each) on the general pool, requiring larger or additional nodes.
> - No Spot/preemptible instance equivalent — all nodes are standard pricing.
> - DigitalOcean has data centers in BLR (Bangalore) — closest to India users.

---

## Side-by-Side Comparison

| Criteria | AWS (Mumbai) | DigitalOcean |
|----------|-------------|--------------|
| **Monthly Cost** | ~$1,760–$1,810 | ~$750–$800 |
| **With Reserved/Savings** | ~$1,250 (1-yr RI) | N/A |
| **Kubernetes** | EKS (managed, $73/mo) | DOKS (managed, free) |
| **PostgreSQL** | RDS (Multi-AZ, Performance Insights) | Managed DB (Primary + Standby) |
| **Redis** | ElastiCache (encryption, replication) | Managed DB (basic HA) |
| **OpenSearch** | Managed (fully managed, HA) | Self-hosted (operational overhead) |
| **Object Storage** | S3 (KMS encryption) | Spaces (S3-compatible) |
| **Spot Instances** | Yes (60–70% savings for scan workers) | No |
| **KMS / Encryption** | AWS KMS (managed) | Self-managed |
| **IAM / Security** | Fine-grained IAM roles, SGs, NACLs | API keys, Cloud Firewalls |
| **Compliance** | SOC 2, ISO 27001, HIPAA eligible | SOC 2, ISO 27001 |
| **Node Auto-scaling** | Cluster Autoscaler + Spot | DOKS auto-scale (no Spot) |
| **Global Regions** | 30+ regions | 15 regions (BLR for India) |
| **Terraform Support** | Full (existing config) | Good (provider available) |
| **Monitoring** | CloudWatch + self-hosted stack | Basic DO Monitoring + self-hosted |
| **Support** | Business/Enterprise plans available | Premium support ($500/mo) |
| **Learning Curve** | Steeper (more services to manage) | Simpler (fewer moving parts) |

---

## Scalability Considerations

### Horizontal Scaling

| Component | Scale Strategy | AWS | DigitalOcean |
|-----------|---------------|-----|--------------|
| API | Add replicas (HPA) | 3→10 pods on general nodes | 3→8 pods |
| Web | Add replicas (HPA) | 2→6 pods | 2→6 pods |
| Scan Workers | HPA on CPU (70%) | 1→20 pods on dedicated Spot nodes | 1→10 pods (no dedicated pool) |
| General Nodes | Cluster Autoscaler | 2→10 t3.xlarge | 2→8 droplets |
| Worker Nodes | Cluster Autoscaler | 0→20 t3.large Spot | 0→10 droplets |

### Vertical Scaling (Database)

| Component | AWS | DigitalOcean |
|-----------|-----|--------------|
| PostgreSQL | db.r6g.large → r6g.2xlarge → r6g.4xlarge | Resize droplet (brief downtime) |
| Redis | cache.r6g.large → r6g.xlarge | Resize (brief downtime) |
| OpenSearch | Add data nodes, resize instances | Add self-hosted nodes |
| Storage | Auto-scaling (RDS), unlimited (S3) | Auto-scaling (managed DB), 250 GB–unlimited (Spaces) |

### Growth Milestones

| Users / Tenants | Recommended Action |
|----------------|--------------------|
| **1–50 tenants** | Base configuration as described above |
| **50–200 tenants** | Add RDS read replica, increase general nodes to 5, Redis to cache.r6g.xlarge |
| **200–500 tenants** | Move to r6g.xlarge RDS, add OpenSearch data nodes, increase scan workers max to 30 |
| **500+ tenants** | Consider multi-region deployment, Aurora PostgreSQL, dedicated OpenSearch cluster |

---

## Recommendation

| If you prioritize... | Choose |
|---------------------|--------|
| **Lower cost & simplicity** | DigitalOcean (~55% cheaper) |
| **Compliance & enterprise features** | AWS (KMS, IAM, HIPAA eligibility) |
| **Existing Terraform/Helm alignment** | AWS (infrastructure already coded) |
| **Burst scan workloads (cost efficiency)** | AWS (Spot instances for workers) |
| **Fast time-to-deploy** | DigitalOcean (simpler, fewer services) |
| **Long-term enterprise scale** | AWS (broader service catalog, Reserved Instance savings) |

### Suggested Approach

For a **privacy compliance platform** handling sensitive data:

1. **Start with AWS** — your Terraform and Helm configurations are already written for it. The compliance certifications (HIPAA eligibility, KMS, fine-grained IAM) are important for a privacy-focused product, and your customers will likely ask about them.

2. **Optimize costs early** — use Reserved Instances for general nodes and RDS (brings AWS cost to ~$1,250/mo), and rely on Spot for scan workers.

3. **Consider DigitalOcean** for staging/dev environments where cost matters more than compliance features (~$400/mo for a scaled-down setup).
