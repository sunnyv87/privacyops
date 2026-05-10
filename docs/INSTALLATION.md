# Installation & Configuration Guide

This guide covers setting up TechD PrivacyOps for local development and deploying to production on Kubernetes.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Database Setup](#database-setup)
5. [Authentication Configuration](#authentication-configuration)
6. [Encryption & Key Management](#encryption--key-management)
7. [Observability Setup](#observability-setup)
8. [Production Deployment](#production-deployment)
9. [Helm Configuration Reference](#helm-configuration-reference)
10. [Terraform Infrastructure](#terraform-infrastructure)
11. [CI/CD Pipeline](#cicd-pipeline)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Development

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20.0.0 | Runtime |
| pnpm | 9.x | Package manager |
| Docker | >= 24.0 | Infrastructure services |
| Docker Compose | >= 2.0 | Service orchestration |
| Git | >= 2.0 | Version control |

### Production

| Tool | Version | Purpose |
|------|---------|---------|
| Kubernetes | >= 1.29 | Container orchestration |
| Helm | >= 3.0 | Kubernetes package manager |
| Terraform | >= 1.0 | Infrastructure provisioning (optional) |
| AWS CLI | >= 2.0 | AWS resource management (if using AWS) |

---

## Local Development Setup

### Automated Setup

Run the dev setup script:

```bash
./scripts/dev-setup.sh
```

This script will:
1. Verify prerequisites (Node.js, pnpm, Docker)
2. Create `.env.local` from `.env.example`
3. Install dependencies
4. Start Docker services
5. Generate Prisma client
6. Run database migrations and seed data

### Manual Setup

#### 1. Install Dependencies

```bash
pnpm install
```

#### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local values. At minimum, the defaults work for local development with Docker Compose.

#### 3. Start Infrastructure Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5432
- **Redis 7** on port 6379
- **OpenSearch 2.12** on port 9200
- **NATS 2.10** on port 4222
- **Temporal 1.23** on port 7233
- **Temporal UI** on port 8233
- **Keycloak 24** on port 8080
- **MinIO** on ports 9000 (API) / 9001 (Console)
- **Jaeger** on ports 16686 (UI) / 4318 (OTLP)
- **Prometheus** on port 9090
- **Grafana** on port 3001

Verify services are healthy:

```bash
docker compose ps
```

#### 4. Set Up the Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed demo data (development only)
pnpm db:seed
```

The seed script creates:
- System roles (Super Admin, Tenant Admin, DPO, CISO, etc.)
- Classification labels (Aadhaar, PAN, Email, SSN, etc.)
- Regulations (DPDP 2023, GDPR, ISO 27701)
- A demo tenant ("TechD Demo") with an admin user

> **Note:** The seed script generates a random password for the demo admin and prints it to the console. Save it immediately.

#### 5. Start Development Servers

```bash
pnpm dev
```

This starts:
- **API** at http://localhost:4000
- **Web** at http://localhost:3000

API documentation (Swagger) is available at http://localhost:4000/api/docs.

### Consent SDK (Browser Package)

A browser-side consent capture SDK is available at `packages/consent-sdk/`. It provides `ConsentClient` and `ConsentBanner` for embedding consent collection in web applications:

```bash
cd packages/consent-sdk
pnpm build
```

The SDK communicates with the public consent ingest endpoint (`POST /consent/public/record`) using HMAC-SHA256 authentication. See the Consent Public Ingest environment variables below.

---

## Environment Variables Reference

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://privacyops:privacyops_dev@localhost:5432/privacyops` | PostgreSQL connection string |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://:privacyops_dev@localhost:6379` | Redis connection string with password |

### Search

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_URL` | `http://localhost:9200` | OpenSearch endpoint |

### Messaging

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |

### Workflows

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server gRPC address |
| `TEMPORAL_NAMESPACE` | `privacyops` | Temporal namespace |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | Minimum 32-character secret for JWT signing. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_ACCESS_TTL` | `900` | Access token TTL in seconds (15 minutes) |
| `JWT_REFRESH_TTL` | `604800` | Refresh token TTL in seconds (7 days) |

### Keycloak (OIDC)

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` | Keycloak server URL |
| `KEYCLOAK_REALM` | `privacyops` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `privacyops-api` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | *(required for OIDC)* | OIDC client secret |

### Object Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_ENDPOINT` | `http://localhost:9000` | S3-compatible endpoint (MinIO in dev) |
| `S3_REGION` | `ap-south-1` | Storage region |
| `S3_BUCKET` | `privacyops-data` | Bucket name |
| `S3_ACCESS_KEY` | `privacyops` | Access key |
| `S3_SECRET_KEY` | `privacyops_dev` | Secret key |

### Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `KMS_KEY_ARN` | *(optional)* | AWS KMS key ARN for envelope encryption |
| `ENCRYPTION_MASTER_KEY` | *(optional)* | Local master key (dev only, use KMS in production) |

### AI / Co-Pilot

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(optional)* | Anthropic API key for AI Co-Pilot features. Provider is inert without it. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Model ID used for all AI calls |
| `ANTHROPIC_MAX_TOKENS` | `512` | Maximum output tokens per AI call |
| `CLAUDE_TIMEOUT_MS` | `10000` | Per-call timeout in milliseconds (AbortSignal) |

The AI layer operates with fail-closed semantics: missing API key, missing SDK (`@anthropic-ai/sdk`), or circuit breaker open all cause the provider to return `null`, falling back to deterministic templates. Per-tenant access requires the `ai_llm_enrichment` feature flag.

### Consent Public Ingest

| Variable | Default | Description |
|----------|---------|-------------|
| `CONSENT_PUBLIC_SHARED_SECRET` | *(required for public consent)* | Shared secret (min 32 chars) for HMAC-SHA256 consent ingest. Per-tenant keys are derived from this. |
| `CONSENT_PUBLIC_SECRET_<TENANTID>` | *(optional)* | Per-tenant override secret (min 32 chars). Takes precedence over the derived key. |

### Email Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | *(optional)* | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(optional)* | SMTP username |
| `SMTP_PASS` | *(optional)* | SMTP password |
| `SMTP_FROM` | `noreply@privacyops.techd.com` | Sender email address |

### Webhooks

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_SIGNING_SECRET` | *(required for webhooks)* | HMAC secret for signing webhook payloads |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `PORT` | `4000` | API server port |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `LOG_LEVEL` | `debug` | Log level (`debug`, `info`, `warn`, `error`) |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per window per tenant |

### Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `true` | Enable OpenTelemetry tracing |
| `OTEL_SERVICE_NAME` | `privacyops-api` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector endpoint |
| `WORKER_HEALTH_PORT` | `4001` | Worker health check port |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | API URL for the frontend |

### Docker Compose Overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_DISABLE_SECURITY` | `true` | Disable OpenSearch security plugin (dev only) |
| `KEYCLOAK_ADMIN` | `admin` | Keycloak admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | *(required)* | Keycloak admin password |

---

## Database Setup

### Row-Level Security (RLS)

The database uses PostgreSQL RLS for tenant isolation. The security hardening script (`scripts/security-hardening.sql`) configures:

- RLS policies on 25+ tenant-scoped tables
- Audit log immutability triggers
- A restricted `privacyops_app` database role
- Security indexes for performance

> **Important:** The `privacyops_app` role must be created manually with a strong password before running the hardening script. See the script comments for instructions.

### Migrations

```bash
# Run pending migrations
pnpm db:migrate

# Reset database (destroys all data)
pnpm db:migrate -- --reset

# Create a new migration
cd apps/api && npx prisma migrate dev --name <migration-name>
```

---

## Authentication Configuration

### Local Authentication (JWT)

Default authentication uses email/password with JWT tokens. Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `JWT_SECRET` in your environment. In production, the API will refuse to start with weak or default secrets.

### Multi-Factor Authentication (MFA)

MFA uses TOTP (Time-based One-Time Passwords) compatible with authenticator apps (Google Authenticator, Authy, etc.). MFA secrets and recovery codes are encrypted at rest using envelope encryption.

### OIDC (Keycloak)

1. Start Keycloak: `docker compose up -d keycloak`
2. Access admin console at http://localhost:8080
3. Create a realm named `privacyops`
4. Create a client `privacyops-api` with:
   - Client authentication: On
   - Valid redirect URIs: `http://localhost:4000/api/v1/auth/oidc/callback`
5. Set `KEYCLOAK_CLIENT_SECRET` to the generated client secret

Users are matched to tenants by email domain. Ensure your tenant has the correct `domain` field set.

### SAML 2.0

Configure your SAML IdP with:
- **Entity ID**: `privacyops-sp`
- **ACS URL**: `https://<your-domain>/api/v1/auth/saml/callback`
- **NameID Format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`

Set the following environment variables:
- `SAML_ENTRY_POINT`: IdP SSO URL
- `SAML_ISSUER`: SP Entity ID
- `SAML_CERT`: IdP signing certificate (base64)

### SCIM 2.0 Provisioning

SCIM endpoints are available at `/api/v1/scim/v2/` for automated user provisioning from identity providers. SCIM uses its own authentication guard (bearer token), separate from the main JWT auth.

---

## Encryption & Key Management

### Envelope Encryption

Field-level encryption uses a two-tier key hierarchy:

1. **Master Key (KEK)** — managed by AWS KMS or a local key
2. **Data Encryption Key (DEK)** — randomly generated per encryption operation, wrapped by the KEK

Encrypted values are stored as colon-separated base64 parts: `{iv}:{authTag}:{wrappedKey}:{ciphertext}`

### Production Setup

1. Create an AWS KMS key in your target region
2. Set `KMS_KEY_ARN` to the key ARN
3. Ensure the application's IAM role has `kms:GenerateDataKey` and `kms:Decrypt` permissions
4. Create a tenant-specific encryption key ID and store it in the tenant record

### Deterministic Encryption

For searchable encrypted fields (e.g., email lookup), deterministic encryption is used. This supports key rotation via a `keyId` prefix in the ciphertext format.

---

## Observability Setup

### Grafana Dashboards

Pre-configured dashboards are available at http://localhost:3001 (admin / privacyops):

| Dashboard | Description |
|-----------|-------------|
| System Overview | Overall system health, request rates, error rates |
| API Performance | Endpoint latency, throughput, error breakdown |
| Connector Health | Data source connection status, scan metrics |
| Event Pipeline | NATS message throughput, consumer lag |
| Workflow Health | Temporal workflow execution, failure rates |
| SLO Overview | Service Level Objective tracking |

### Prometheus Metrics

The API exposes Prometheus metrics at `/api/v1/metrics`. Default scrape interval is 15 seconds.

### Distributed Tracing

OpenTelemetry traces are exported to Jaeger. View traces at http://localhost:16686.

To disable tracing in development:

```bash
OTEL_ENABLED=false
```

---

## Production Deployment

### Building Docker Images

```bash
# Build API image
docker build -t privacyops-api:latest -f apps/api/Dockerfile .

# Build Web image
docker build -t privacyops-web:latest -f apps/web/Dockerfile .
```

Both images:
- Use multi-stage builds for minimal image size
- Run as non-root users (UID 1001)
- Use Node.js 20 Alpine base

### Kubernetes Deployment with Helm

#### 1. Configure Values

Create a `values-production.yaml`:

```yaml
api:
  replicaCount: 3
  image:
    repository: your-registry/privacyops-api
    tag: "1.0.0"
  env:
    NODE_ENV: production
    PORT: "4000"
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

web:
  replicaCount: 2
  image:
    repository: your-registry/privacyops-web
    tag: "1.0.0"

scanWorker:
  replicaCount: 2
  maxReplicas: 20
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi

secrets:
  jwtSecret: "<your-256-bit-secret>"  # Required — generate with: openssl rand -hex 32

ingress:
  enabled: true
  className: nginx
  host: privacyops.yourdomain.com
  tls:
    enabled: true
    secretName: privacyops-tls

postgresql:
  existingSecret: privacyops-db-secret

redis:
  existingSecret: privacyops-redis-secret

opensearch:
  host: opensearch-cluster
  port: 9200
```

#### 2. Deploy

```bash
helm install privacyops infra/helm/privacyops \
  -f values-production.yaml \
  -n privacyops \
  --create-namespace
```

#### 3. Verify

```bash
kubectl get pods -n privacyops
kubectl logs -f deployment/privacyops-api -n privacyops
```

### Security Contexts

The Helm chart configures containers with:
- `runAsNonRoot: true`
- `readOnlyRootFilesystem: true`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`

### Ingress

The default Ingress configuration includes:
- TLS termination via cert-manager
- Rate limiting (100 requests/minute)
- NGINX ingress controller

---

## Helm Configuration Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `api.replicaCount` | `3` | API server replicas |
| `api.image.repository` | `privacyops-api` | API Docker image |
| `api.image.tag` | `latest` | API image tag |
| `api.resources.requests.cpu` | `500m` | API CPU request |
| `api.resources.requests.memory` | `512Mi` | API memory request |
| `web.replicaCount` | `2` | Web frontend replicas |
| `scanWorker.replicaCount` | `2` | Scan worker replicas |
| `scanWorker.maxReplicas` | `20` | Max scan worker replicas (HPA) |
| `scanWorker.autoscaling.targetCPU` | `70` | HPA CPU threshold |
| `secrets.jwtSecret` | *(required)* | JWT signing secret |
| `ingress.enabled` | `true` | Enable Ingress |
| `ingress.host` | `privacyops.local` | Ingress hostname |
| `ingress.tls.enabled` | `true` | Enable TLS |
| `observability.prometheus.scrapeInterval` | `15s` | Metrics scrape interval |
| `observability.jaeger.samplingRate` | `0.1` | Trace sampling rate |

---

## Terraform Infrastructure

The `infra/terraform/` directory contains an AWS deployment targeting `ap-south-1` (Mumbai):

| Resource | Specification |
|----------|--------------|
| VPC | 10.0.0.0/16, 3 AZs, public/private subnets |
| EKS | v1.29, 3x t3.xlarge general + 0-20 t3.large spot (scan workers) |
| RDS PostgreSQL | v16.1, db.r6g.large, 100-500GB, multi-AZ, encrypted |
| ElastiCache Redis | v7.0, cache.r6g.large, encrypted at-rest + in-transit |
| S3 | KMS encryption, public access blocked |
| KMS | Master key with annual rotation |

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **lint-and-test** — ESLint + test suite with PostgreSQL and Redis services
2. **build** — Full TypeScript compilation
3. **docker** — Docker image builds (on `main`/`develop` branches)
4. **security** — `pnpm audit` + TruffleHog secret scanning

---

## Troubleshooting

### Common Issues

**PostgreSQL won't start**
```bash
# Check if port 5432 is already in use
lsof -i :5432
# Remove old data volumes if needed
docker compose down -v
docker compose up -d postgres
```

**Prisma client generation fails**
```bash
# Ensure PostgreSQL is running and DATABASE_URL is correct
docker compose ps postgres
pnpm db:generate
```

**Redis connection refused**
```bash
# Verify Redis is running with the correct password
docker compose logs redis
redis-cli -a privacyops_dev ping
```

**OpenSearch out of memory**
```bash
# Increase JVM heap in docker-compose.yml
# Default is -Xms512m -Xmx512m, increase for large datasets
```

**Temporal workflows not executing**
```bash
# Check Temporal server logs
docker compose logs temporal
# Verify the namespace exists
docker compose exec temporal tctl namespace list
```

**JWT_SECRET error on startup**
```bash
# Generate a proper secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Set it in .env.local
```

**Seed script refuses to run**
```bash
# Seed only runs when NODE_ENV !== 'production'
NODE_ENV=development pnpm db:seed
```

### Verifying Service Health

```bash
# API health check
curl http://localhost:4000/api/v1/health

# API readiness check
curl http://localhost:4000/api/v1/health/ready

# All Docker services
docker compose ps

# Kubernetes pods
kubectl get pods -n privacyops -o wide
```

### Resetting Local Environment

```bash
# Stop all services and remove data
docker compose down -v

# Restart fresh
docker compose up -d
pnpm db:migrate
pnpm db:seed
```
