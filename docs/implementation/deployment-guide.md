# TechD PrivacyOps -- Deployment Guide

## Overview

This guide covers deploying the PrivacyOps platform to Kubernetes using the Helm chart at `infra/helm/privacyops/`. The platform consists of three deployable components:

| Component | Image | Default Port | Helm Key |
|-----------|-------|-------------|----------|
| API Server | `ghcr.io/techd/privacyops-api` | 4000 | `api` |
| Temporal Worker | `ghcr.io/techd/privacyops-api` | 4001 (health) | `temporalWorker` |
| Web Frontend | `ghcr.io/techd/privacyops-web` | 3000 | `web` |

All three share the monorepo build; the API and worker images are identical, differentiated only by the entrypoint command.

---

## Prerequisites

- Kubernetes 1.27+ cluster
- Helm 3.14+
- Container registry access to `ghcr.io/techd/`
- External services provisioned: PostgreSQL 16, Redis 7, NATS 2.10, Temporal 1.23, OpenSearch 2.12, MinIO/S3

---

## 1. Building Container Images

```bash
# From repository root
# API + Worker (same image, different entrypoint)
docker build -f apps/api/Dockerfile -t ghcr.io/techd/privacyops-api:$(git rev-parse --short HEAD) .

# Web Frontend
docker build -f apps/web/Dockerfile -t ghcr.io/techd/privacyops-web:$(git rev-parse --short HEAD) .

# Push
docker push ghcr.io/techd/privacyops-api:$(git rev-parse --short HEAD)
docker push ghcr.io/techd/privacyops-web:$(git rev-parse --short HEAD)
```

### Multi-stage Dockerfile (API)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/api/ apps/api/
COPY tsconfig.base.json .
RUN pnpm --filter @privacyops/api run build

FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S privacyops && adduser -S privacyops -u 1001
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
USER privacyops
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

---

## 2. Kubernetes Secrets

Create secrets before deploying. Never commit these to version control.

```bash
# Database credentials
kubectl create secret generic privacyops-db-credentials \
  --from-literal=database-url="postgresql://privacyops:<password>@pg-primary.db.svc:5432/privacyops?sslmode=require"

# Redis credentials
kubectl create secret generic privacyops-redis-credentials \
  --from-literal=redis-url="redis://:<password>@redis-master.cache.svc:6379"

# S3/MinIO credentials
kubectl create secret generic privacyops-s3-credentials \
  --from-literal=access-key="<access-key>" \
  --from-literal=secret-key="<secret-key>"

# Application secrets
kubectl create secret generic privacyops-secrets \
  --from-literal=jwt-secret="$(openssl rand -base64 48)" \
  --from-literal=event-hmac-secret="$(openssl rand -hex 32)" \
  --from-literal=encryption-master-key="$(openssl rand -hex 32)" \
  --from-literal=webhook-signing-secret="$(openssl rand -hex 32)"
```

---

## 3. Helm Deployment

### Install

```bash
helm install privacyops infra/helm/privacyops/ \
  --namespace privacyops \
  --create-namespace \
  --values infra/helm/privacyops/values.yaml \
  --set api.image.tag=$(git rev-parse --short HEAD) \
  --set web.image.tag=$(git rev-parse --short HEAD) \
  --set postgresql.host=pg-primary.db.svc \
  --set redis.host=redis-master.cache.svc \
  --set nats.url=nats://nats.messaging.svc:4222 \
  --set temporal.address=temporal-frontend.workflow.svc:7233 \
  --set opensearch.host=opensearch.search.svc \
  --set s3.endpoint=https://s3.ap-south-1.amazonaws.com
```

### Upgrade (Rolling)

```bash
helm upgrade privacyops infra/helm/privacyops/ \
  --namespace privacyops \
  --set api.image.tag=<new-tag> \
  --set web.image.tag=<new-tag> \
  --reuse-values
```

---

## 4. Resource Limits and Scaling

From `infra/helm/privacyops/values.yaml`:

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|-----------|------------|-----------|---------------|-------------|----------|
| API | 500m | 1000m | 512Mi | 1Gi | 3 |
| Web | 250m | 500m | 256Mi | 512Mi | 2 |
| Temporal Worker | 250m | -- | 512Mi | -- | 2 |
| Scan Worker | 500m | 2000m | 1Gi | 4Gi | 1-20 (HPA) |

The scan worker deployment includes a `HorizontalPodAutoscaler` defined in `infra/helm/privacyops/templates/worker-deployment.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Release.Name }}-scan-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ .Release.Name }}-temporal-worker
  minReplicas: 1
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 5. Health Probes

### API Server (`apps/api/src/core/health/health.controller.ts`)

| Probe | Path | Port | Initial Delay | Period |
|-------|------|------|--------------|--------|
| Liveness | `/api/v1/health` | 4000 | 15s | 20s |
| Readiness | `/api/v1/health/ready` | 4000 | 10s | 10s |

The readiness endpoint checks all five dependencies: PostgreSQL, Redis, NATS, Temporal, and OpenSearch. It returns HTTP 503 if any check fails.

### Temporal Worker (`apps/api/src/workers/temporal-worker.ts`)

| Probe | Path | Port | Initial Delay | Period |
|-------|------|------|--------------|--------|
| Liveness | `/health` | 4001 | 20s | 20s |
| Readiness | `/health/ready` | 4001 | 15s | 10s |

The worker health server is a plain Node.js HTTP server started before worker registration. The readiness probe returns 503 until all Temporal task queue workers have initialized.

---

## 6. Init Containers for Migrations

Add an init container to the API deployment for Prisma migrations:

```yaml
initContainers:
  - name: prisma-migrate
    image: "{{ .Values.api.image.repository }}:{{ .Values.api.image.tag }}"
    command: ["npx", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: {{ .Values.postgresql.existingSecret }}
            key: database-url
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
  - name: rls-extension
    image: postgres:16-alpine
    command: ["psql", "$(DATABASE_URL)", "-f", "/scripts/rls-extension.sql"]
    volumeMounts:
      - name: sql-scripts
        mountPath: /scripts
```

---

## 7. Security Context

All containers run with a hardened security context (`infra/helm/privacyops/templates/api-deployment.yaml`):

```yaml
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

---

## 8. Zero-Downtime Deployment Strategy

### Rolling Update Configuration

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  minReadySeconds: 30
```

### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: privacyops-api-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: privacyops-api
```

### Graceful Shutdown

The API server (`apps/api/src/main.ts`) registers `SIGTERM` and `SIGINT` handlers that:
1. Stop accepting new connections
2. Close the NestJS application (drains in-flight requests)
3. Flush OpenTelemetry spans via `shutdownTracing()`
4. Exit cleanly

Set `terminationGracePeriodSeconds: 60` to allow sufficient drain time.

---

## 9. Ingress and TLS

From `values.yaml`, the Helm chart creates an NGINX ingress with cert-manager TLS:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: 1m
  hosts:
    - host: api.privacyops.techd.com
      paths:
        - path: /
          service: api
    - host: app.privacyops.techd.com
      paths:
        - path: /
          service: web
  tls:
    - secretName: privacyops-tls
      hosts:
        - api.privacyops.techd.com
        - app.privacyops.techd.com
```

---

## 10. Deployment Verification Checklist

```bash
# Verify pods are running
kubectl get pods -n privacyops -l app=privacyops-api
kubectl get pods -n privacyops -l app=privacyops-temporal-worker

# Check readiness
kubectl exec -n privacyops deploy/privacyops-api -- \
  wget -qO- http://localhost:4000/api/v1/health/ready

# Verify Temporal workers registered all 8 queues
kubectl logs -n privacyops deploy/privacyops-temporal-worker --tail=20 | \
  grep "Worker registered for"

# Expected output:
# Worker registered for dsar-queue
# Worker registered for breach-queue
# Worker registered for retention-queue
# Worker registered for approval-queue
# Worker registered for vendor-queue
# Worker registered for remediation-queue
# Worker registered for data-deletion-queue

# Verify Prometheus scraping
kubectl port-forward -n privacyops svc/privacyops-api 4000:4000
curl -s http://localhost:4000/api/v1/metrics | head -20

# Smoke test API
curl -s https://api.privacyops.techd.com/api/v1/health | jq .
```
