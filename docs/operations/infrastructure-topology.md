# TechD PrivacyOps + DSPM Platform -- Infrastructure Topology

**Owner:** Platform Engineering / DevOps
**Review Cycle:** Monthly (or after any infrastructure change)
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations (Restricted)

---

## 1. Overview

This document describes the complete infrastructure topology of the TechD PrivacyOps platform, including service dependencies, network layout, Kubernetes namespace organization, and external service connections.

---

## 2. Architecture Diagram (Text-Based)

```
                                    Internet
                                       |
                                  [CloudFlare CDN]
                                       |
                              [AWS ALB / Ingress]
                              /                  \
                   [Next.js Frontend]       [NestJS API Cluster]
                    apps/web (3000)          (3 replicas, :3000)
                                                   |
                    +------------------------------+-------------------------------+
                    |              |                |               |               |
              [7-Layer Auth]  [Socket.IO]    [OpenTelemetry]  [Prometheus]    [BullMQ]
              Guard Stack     WebSocket      OTLP Exporter    prom-client    Workers
                    |          (:3000)           |               |               |
                    |              |              |               |               |
        +-----------+-----------+  |    [OTel Collector]  [Grafana]          [Redis]
        |           |           |  |      (:4318 HTTP)     (:3000)         (:6379)
    [Prisma ORM] [NATS Client] |  |           |                               |
        |           |          |  |      [Jaeger]                        [IORedis]
        |           |          |  |      (:16686)
  [PgBouncer]  [NATS JetStream]|  |
    (:6432)    (:4222, :8222)  |  +--[Redis Adapter]--[Redis (:6379)]
        |           |          |
  [PostgreSQL]  [NATS Cluster] +--[Temporal SDK]
   (:5432)     (3-node)              |
        |           |          [Temporal Server]
   [PG Replicas]  [DLQ Stream]  (:7233, :7234)
                                     |
                              [Temporal Workers]
                              (8 Task Queues)
                                     |
                     +---------------+----------------+
                     |       |       |       |        |
                  [SCAN] [DSAR] [BREACH] [RETENTION] ...
                     |
              [43 Connectors]
              (IConnector Interface)
                     |
              [External SaaS APIs]
              (Salesforce, HubSpot,
               Slack, AWS S3, etc.)
```

---

## 3. Service Dependencies

### 3.1 Critical Path Dependencies

These dependencies are required for basic platform operation. Failure in any causes degraded or failed state.

```
NestJS API
  ├── PostgreSQL (via Prisma + PgBouncer)     [CRITICAL - data store]
  ├── Redis (via IORedis)                      [CRITICAL - cache, sessions, BullMQ]
  ├── NATS JetStream                           [CRITICAL - event bus]
  └── Temporal Server                          [CRITICAL - workflow engine]

Next.js Frontend
  ├── NestJS API                               [CRITICAL - backend]
  └── Socket.IO (via NestJS)                   [DEGRADED without - no real-time updates]
```

### 3.2 Non-Critical Dependencies

Failure causes feature degradation but core platform continues operating.

```
NestJS API
  ├── OpenTelemetry Collector                  [DEGRADED - no tracing]
  ├── Stripe API                               [DEGRADED - no billing updates]
  ├── AI/LLM Provider (for co-pilot)           [DEGRADED - fail-closed, no AI features]
  ├── External Connector APIs (43 providers)   [DEGRADED per connector]
  └── SMTP / Email Service                     [DEGRADED - no notifications]
```

### 3.3 Dependency Startup Order

Services must start in this order for healthy initialization:

```
1. PostgreSQL           (database must be ready first)
2. Redis                (cache and BullMQ substrate)
3. NATS JetStream       (event bus for service communication)
4. Temporal Server      (workflow engine, depends on its own PostgreSQL)
5. PgBouncer            (connection pooler, after PostgreSQL is healthy)
6. NestJS API           (application, connects to all above)
7. Temporal Workers     (register with Temporal, connect to API services)
8. Next.js Frontend     (UI, connects to NestJS API)
9. OTel Collector       (telemetry aggregation, non-blocking)
10. Monitoring Stack    (Prometheus, Grafana, Jaeger)
```

---

## 4. Port Mappings

### 4.1 Internal Service Ports

| Service                  | Container Port | Service Port | Protocol |
|--------------------------|---------------|--------------|----------|
| NestJS API               | 3000          | 3000         | HTTP     |
| NestJS API (WebSocket)   | 3000          | 3000         | WS       |
| Next.js Frontend         | 3000          | 80           | HTTP     |
| PostgreSQL Primary       | 5432          | 5432         | TCP      |
| PostgreSQL Replica(s)    | 5432          | 5433         | TCP      |
| PgBouncer                | 6432          | 6432         | TCP      |
| Redis                    | 6379          | 6379         | TCP      |
| NATS Client              | 4222          | 4222         | TCP      |
| NATS Monitoring          | 8222          | 8222         | HTTP     |
| NATS Cluster             | 6222          | 6222         | TCP      |
| Temporal Frontend        | 7233          | 7233         | gRPC     |
| Temporal Web UI          | 8088          | 8088         | HTTP     |
| OTel Collector (OTLP)   | 4318          | 4318         | HTTP     |
| OTel Collector (health) | 13133         | 13133        | HTTP     |
| Prometheus               | 9090          | 9090         | HTTP     |
| Grafana                  | 3000          | 3000         | HTTP     |
| Jaeger UI                | 16686         | 16686        | HTTP     |
| Jaeger Collector         | 14268         | 14268        | HTTP     |

### 4.2 External Ingress Ports

| Endpoint                   | External Port | Internal Target          |
|----------------------------|---------------|--------------------------|
| `app.privacyops.techd.io`  | 443 (HTTPS)  | Next.js Frontend :80     |
| `api.privacyops.techd.io`  | 443 (HTTPS)  | NestJS API :3000         |
| `ws.privacyops.techd.io`   | 443 (WSS)    | NestJS API :3000         |
| `grafana.techd.io`         | 443 (HTTPS)  | Grafana :3000            |
| `temporal.techd.io`        | 443 (HTTPS)  | Temporal Web UI :8088    |

---

## 5. Network Topology

### 5.1 Network Segmentation

```
VPC: 10.0.0.0/16
├── Public Subnet (10.0.1.0/24)
│   ├── ALB (Ingress Controller)
│   └── NAT Gateway (for egress to external APIs)
│
├── Application Subnet (10.0.10.0/24)
│   ├── NestJS API pods
│   ├── Next.js Frontend pods
│   ├── Temporal Worker pods
│   └── BullMQ Worker pods
│
├── Data Subnet (10.0.20.0/24)
│   ├── PostgreSQL (primary + replicas)
│   ├── PgBouncer
│   ├── Redis
│   ├── NATS JetStream cluster
│   └── Temporal Server
│
└── Monitoring Subnet (10.0.30.0/24)
    ├── Prometheus
    ├── Grafana
    ├── Jaeger
    └── OpenTelemetry Collector
```

### 5.2 Network Policies

```yaml
# Application pods can reach data subnet
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-data
  namespace: privacyops
spec:
  podSelector:
    matchLabels:
      tier: application
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              tier: data
      ports:
        - port: 5432    # PostgreSQL
        - port: 6432    # PgBouncer
        - port: 6379    # Redis
        - port: 4222    # NATS
        - port: 7233    # Temporal

# Data pods cannot initiate connections to application pods
# (reverse direction blocked by default deny)
```

### 5.3 Egress Rules for External Connectors

The 43 IConnector implementations require egress to various external SaaS APIs:

```yaml
# Egress network policy for connector communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: connector-egress
  namespace: privacyops
spec:
  podSelector:
    matchLabels:
      component: temporal-worker
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/16       # Block internal VPC lateral movement
              - 169.254.169.254/32 # Block metadata service
      ports:
        - port: 443
          protocol: TCP
```

---

## 6. Kubernetes Namespace Layout

```
Cluster: privacyops-production
├── Namespace: privacyops                     (Application workloads)
│   ├── Deployment: api (3 replicas)
│   ├── Deployment: frontend (2 replicas)
│   ├── Deployment: temporal-worker-scan (2 replicas)
│   ├── Deployment: temporal-worker-dsar (2 replicas)
│   ├── Deployment: temporal-worker-breach (1 replica)
│   ├── Deployment: temporal-worker-retention (2 replicas)
│   ├── Deployment: temporal-worker-approval (1 replica)
│   ├── Deployment: temporal-worker-vendor (1 replica)
│   ├── Deployment: temporal-worker-remediation (2 replicas)
│   ├── Deployment: temporal-worker-deletion (1 replica)
│   ├── Deployment: bullmq-workers (2 replicas)
│   ├── Service: api-service (ClusterIP)
│   ├── Service: frontend-service (ClusterIP)
│   ├── Ingress: privacyops-ingress
│   ├── ConfigMap: app-config
│   ├── Secret: privacyops-secrets
│   ├── HPA: api-hpa (min:3, max:10)
│   └── PDB: api-pdb (minAvailable: 2)
│
├── Namespace: privacyops-data                (Stateful data services)
│   ├── StatefulSet: postgresql (1 primary + 2 replicas)
│   ├── Deployment: pgbouncer (2 replicas)
│   ├── StatefulSet: redis (1 primary + 2 replicas, Sentinel)
│   ├── StatefulSet: nats (3 nodes, JetStream)
│   ├── StatefulSet: temporal-server (2 replicas)
│   ├── Service: postgres-primary (ClusterIP)
│   ├── Service: postgres-read (ClusterIP, replica load balancing)
│   ├── Service: redis (ClusterIP)
│   ├── Service: nats (ClusterIP)
│   └── Service: temporal (ClusterIP)
│
├── Namespace: privacyops-monitoring          (Observability stack)
│   ├── Deployment: prometheus (1 replica)
│   ├── Deployment: grafana (1 replica)
│   ├── Deployment: jaeger (1 replica)
│   ├── Deployment: otel-collector (2 replicas)
│   └── DaemonSet: node-exporter
│
├── Namespace: ingress-nginx                  (Ingress controller)
│   └── Deployment: ingress-nginx-controller
│
└── Namespace: cert-manager                   (TLS certificate management)
    └── Deployment: cert-manager
```

---

## 7. Persistent Volumes

| Volume                   | Size   | Storage Class | Namespace         | Mount Path           |
|--------------------------|--------|---------------|-------------------|----------------------|
| postgres-data-0          | 500Gi  | gp3-encrypted | privacyops-data   | /var/lib/postgresql   |
| postgres-data-1 (replica)| 500Gi  | gp3-encrypted | privacyops-data   | /var/lib/postgresql   |
| postgres-data-2 (replica)| 500Gi  | gp3-encrypted | privacyops-data   | /var/lib/postgresql   |
| redis-data-0             | 50Gi   | gp3-encrypted | privacyops-data   | /data                |
| nats-js-data-0           | 100Gi  | gp3-encrypted | privacyops-data   | /data/jetstream      |
| nats-js-data-1           | 100Gi  | gp3-encrypted | privacyops-data   | /data/jetstream      |
| nats-js-data-2           | 100Gi  | gp3-encrypted | privacyops-data   | /data/jetstream      |
| temporal-data            | 50Gi   | gp3-encrypted | privacyops-data   | /var/lib/temporal    |
| prometheus-data          | 200Gi  | gp3           | privacyops-mon    | /prometheus          |
| grafana-data             | 10Gi   | gp3           | privacyops-mon    | /var/lib/grafana     |

**All data volumes use encrypted storage class (gp3-encrypted) with AWS EBS encryption at rest.**

### 7.1 Volume Monitoring

```bash
# Check PVC utilization
kubectl get pvc -A | grep privacyops
for pvc in $(kubectl get pvc -n privacyops-data -o name); do
  echo "=== $pvc ==="
  kubectl exec -n privacyops-data $(kubectl get pods -n privacyops-data -o name | head -1) -- df -h | grep data
done
```

**Thresholds:**
- Warn at 70% utilization
- Critical at 85% -- expand PVC or archive old data
- PostgreSQL WAL accumulation can fill disk rapidly during replication issues

---

## 8. External Service Connections

### 8.1 Third-Party Service Dependencies

| Service            | Purpose                      | Connection Type      | Region       |
|--------------------|------------------------------|----------------------|--------------|
| Stripe             | Billing, subscriptions       | HTTPS API            | Global       |
| AWS S3             | Report storage, backups      | AWS SDK (HTTPS)      | us-east-1    |
| AWS KMS            | Encryption key management    | AWS SDK (HTTPS)      | us-east-1    |
| AWS SES            | Transactional email          | AWS SDK (HTTPS)      | us-east-1    |
| HashiCorp Vault    | Secrets management           | HTTPS API            | Internal     |
| Okta               | SSO / identity provider      | OIDC/SAML            | Global       |
| LLM Provider       | AI co-pilot, PII redaction   | HTTPS API            | Global       |
| CloudFlare         | CDN, DDoS protection         | Proxy                | Global       |

### 8.2 Connector External Endpoints (Sample)

The 43 registered connectors communicate with external SaaS APIs. A sample:

| Connector Type   | API Endpoint                        | Auth Method  |
|------------------|-------------------------------------|--------------|
| Salesforce       | `https://login.salesforce.com`      | OAuth 2.0    |
| HubSpot          | `https://api.hubapi.com`            | OAuth 2.0    |
| Google Workspace | `https://www.googleapis.com`        | OAuth 2.0    |
| Slack            | `https://slack.com/api`             | OAuth 2.0    |
| AWS S3           | `https://s3.amazonaws.com`          | AWS IAM      |
| Azure Blob       | `https://*.blob.core.windows.net`   | Azure AD     |
| Snowflake        | `https://*.snowflakecomputing.com`  | Key-pair     |
| MongoDB Atlas    | `mongodb+srv://*.mongodb.net`       | SCRAM        |
| PostgreSQL       | Direct TCP :5432                    | Certificate  |
| MySQL            | Direct TCP :3306                    | Password     |
| Jira             | `https://*.atlassian.net`           | OAuth 2.0    |

---

## 9. Disaster Recovery Topology

```
Primary Region (us-east-1)              DR Region (us-west-2)
├── Active Cluster                       ├── Standby Cluster
│   ├── All services running             │   ├── Minimal replicas
│   └── All data stores primary          │   └── Data stores in replica mode
│                                        │
├── PostgreSQL Primary ──(streaming)──>  ├── PostgreSQL Standby
├── NATS JetStream ──(mirror)──────────> ├── NATS JetStream Mirror
├── Redis ──(not replicated)             ├── Redis (cold start)
└── S3 Backups ──(cross-region)────────> └── S3 Replica Bucket
```

**RTO:** 4 hours (manual failover)
**RPO:** 1 hour (streaming replication + hourly WAL archiving)
