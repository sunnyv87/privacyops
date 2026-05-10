# TechD PrivacyOps -- Environment Configuration

## Overview

All environment variables are defined in `.env.example` at the repository root. Copy this file to `.env.local` for local development. In production, inject values via Kubernetes secrets and configmaps (see `infra/helm/privacyops/templates/secrets.yaml` and `infra/helm/privacyops/templates/configmap.yaml`).

The API server (`apps/api/src/main.ts`) validates critical secrets at startup and will refuse to start in production if `JWT_SECRET` is weak, short, or matches a known template value.

---

## Complete Environment Variable Reference

### Database (PostgreSQL 16)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://privacyops:privacyops_dev@localhost:5432/privacyops` | Prisma connection string. Must include `?sslmode=require` in production. |

The Prisma schema is at `apps/api/prisma/schema.prisma`. The connection is managed by `apps/api/src/core/prisma/prisma.service.ts`.

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | `redis://:privacyops_dev@localhost:6379` | IORedis connection string. Used for BullMQ job queues and caching. |

Injected as the `REDIS_CLIENT` provider in the NestJS DI container.

### OpenSearch

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENSEARCH_URL` | Yes | `http://localhost:9200` | OpenSearch cluster URL for full-text search. Used by `apps/api/src/core/search/search.service.ts`. |

### NATS JetStream

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NATS_URL` | Yes | `nats://localhost:4222` | NATS server URL. |
| `NATS_TOKEN` | No | -- | Token-based auth (mutually exclusive with user/pass). |
| `NATS_USER` | No | -- | Username for NATS auth. |
| `NATS_PASS` | No | -- | Password for NATS auth. |
| `EVENT_HMAC_SECRET` | Recommended | -- | HMAC-SHA256 signing key for event integrity. All published events are signed; consumers verify before processing. |

Connection logic is in `apps/api/src/core/events/event-bus.service.ts`.

### Temporal

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEMPORAL_ADDRESS` | Yes | `localhost:7233` | Temporal frontend service gRPC address. |
| `TEMPORAL_NAMESPACE` | No | `privacyops` | Temporal namespace. Created during first connection. |

Used by both `apps/api/src/core/workflow/temporal.client.ts` (API server) and `apps/api/src/workers/temporal-worker.ts` (worker process).

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | -- | Minimum 32 characters, 12+ distinct characters. Rejects known weak values (change-me, dev-secret, placeholder, etc.). Hard failure in production. |
| `JWT_ACCESS_TTL` | No | `900` | Access token lifetime in seconds (15 min default). |
| `JWT_REFRESH_TTL` | No | `604800` | Refresh token lifetime in seconds (7 days default). |

Validated by `validateJwtSecret()` in `apps/api/src/main.ts`. The function rejects: length < 32, known template substrings, fewer than 12 distinct characters.

### Keycloak / OIDC

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KEYCLOAK_BASE_URL` | Conditional | `http://localhost:8080` | Keycloak base URL. Required if OIDC is enabled. |
| `KEYCLOAK_REALM` | Conditional | `privacyops` | Keycloak realm name. |
| `KEYCLOAK_CLIENT_ID` | Conditional | `privacyops-api` | OIDC client ID. |
| `KEYCLOAK_CLIENT_SECRET` | Conditional | -- | OIDC client secret. |

Strategy at `apps/api/src/core/auth/strategies/oidc.strategy.ts`. Enables PKCE and state validation.

### SAML SSO

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SAML_ENTRY_POINT` | Conditional | -- | IdP SSO URL. |
| `SAML_ISSUER` | No | `privacyops-sp` | SP entity ID. |
| `SAML_CERT` | Conditional | -- | IdP X.509 signing certificate (PEM). |
| `SAML_CALLBACK_URL` | No | `/api/v1/auth/saml/callback` | ACS callback URL. |
| `SAML_AUDIENCE` | No | `privacyops-sp` | Audience restriction value. |

Strategy at `apps/api/src/core/auth/strategies/saml.strategy.ts`. Enforces signed assertions and signed logout requests.

### Object Storage (S3/MinIO)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_ENDPOINT` | Yes | `http://localhost:9000` | S3-compatible endpoint. Use MinIO locally. |
| `S3_REGION` | No | `ap-south-1` | AWS region or MinIO region. |
| `S3_BUCKET` | No | `privacyops-data` | Primary data bucket. |
| `S3_ACCESS_KEY` | Yes | -- | Access key ID. |
| `S3_SECRET_KEY` | Yes | -- | Secret access key. |

Used by `apps/api/src/core/crypto/signed-url.service.ts` for pre-signed upload/download URLs.

### Encryption and KMS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KMS_KEY_ARN` | Conditional | -- | AWS KMS key ARN for envelope encryption. Required in production. |
| `ENCRYPTION_MASTER_KEY` | Conditional | -- | Local master key (development fallback). Never use in production. |

Managed by `apps/api/src/core/crypto/kms.service.ts` and `apps/api/src/core/crypto/crypto.service.ts`.

### AI Co-Pilot

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Conditional | -- | API key for Claude provider (`apps/api/src/modules/co-pilot/ai-providers/claude.provider.ts`). |

The co-pilot is gated behind the `ai_llm_enrichment` feature flag per tenant. The circuit breaker (5 failures in 60s) auto-opens and logs via `ai_circuit_state` Prometheus gauge.

### Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Conditional | -- | SMTP server for email notifications. |
| `SMTP_PORT` | No | `587` | SMTP port. |
| `SMTP_USER` | Conditional | -- | SMTP username. |
| `SMTP_PASS` | Conditional | -- | SMTP password. |
| `SMTP_FROM` | No | `noreply@privacyops.techd.com` | Sender email address. |
| `WEBHOOK_SIGNING_SECRET` | Recommended | -- | HMAC key for signing outbound webhooks. |

Channels implemented in `apps/api/src/core/notifications/channels/`.

### Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_ENABLED` | No | `true` | Set to `false` to disable OpenTelemetry tracing. |
| `OTEL_SERVICE_NAME` | No | `privacyops-api` | Service name in traces. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318` | OTLP HTTP exporter endpoint (Jaeger/Grafana Tempo). |
| `WORKER_HEALTH_PORT` | No | `4001` | Health check port for the Temporal worker process. |
| `LOG_LEVEL` | No | `debug` (dev), `log` (prod) | NestJS log level. |

Tracing initialization at `apps/api/src/core/telemetry/tracing.ts`. Must be imported before any other code in `main.ts`.

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development`, `staging`, or `production`. Controls Swagger visibility and secret strictness. |
| `PORT` | No | `4000` | API HTTP listen port. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins. Empty entries are filtered to prevent null origin reflection. |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:4000/api/v1` | Public API base URL for the Next.js frontend. |

---

## Production Secrets Management

### Kubernetes Secrets (Helm)

The Helm chart references existing secrets via `existingSecret` keys:

```yaml
# infra/helm/privacyops/values.yaml
postgresql:
  existingSecret: privacyops-db-credentials
redis:
  existingSecret: privacyops-redis-credentials
s3:
  existingSecret: privacyops-s3-credentials
```

These are injected as `secretKeyRef` in `infra/helm/privacyops/templates/api-deployment.yaml`.

### AWS Secrets Manager Integration

For production, use `apps/api/src/core/security/secrets-manager.service.ts` to fetch secrets at startup:

```bash
# Store secrets
aws secretsmanager create-secret \
  --name privacyops/production/database \
  --secret-string '{"url":"postgresql://..."}' \
  --region ap-south-1

aws secretsmanager create-secret \
  --name privacyops/production/jwt \
  --secret-string '{"secret":"<256-bit-key>"}' \
  --region ap-south-1
```

### Rotation Policy

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| `JWT_SECRET` | 90 days | Deploy new secret, keep old secret valid for `JWT_REFRESH_TTL` (7 days) |
| `DATABASE_URL` password | 90 days | Rotate via RDS, update K8s secret, rolling restart |
| `EVENT_HMAC_SECRET` | 180 days | Deploy new key, consumers accept both old and new for 24h |
| `ENCRYPTION_MASTER_KEY` | Annual | Re-wrap DEKs under new master key via `kms.service.ts` |
| `ANTHROPIC_API_KEY` | On compromise | Revoke old key, deploy new key, restart API |

---

## Startup Validation

The bootstrap process (`apps/api/src/main.ts`) enforces:

1. **JWT_SECRET strength**: Rejects weak secrets in production (hard error), warns in development.
2. **Billing provider guard**: `BillingService` validates that `BILLING_PROVIDER` is not `null` in production (prevents accidental free-tier-only deployments).
3. **Request body limits**: `express.json()` capped at 1MB, `express.text()` at 256KB.
4. **Server timeout**: `server.setTimeout(120_000)` kills hanging connections after 2 minutes.

---

## ConfigMap Reference

The Helm configmap (`infra/helm/privacyops/templates/configmap.yaml`) carries non-secret configuration:

```yaml
data:
  NODE_ENV: "production"
  API_PORT: "4000"
  WEB_PORT: "3000"
  OPENSEARCH_URL: "http://{{ .Values.opensearch.host }}:{{ .Values.opensearch.port }}"
  NATS_URL: {{ .Values.nats.url }}
  TEMPORAL_ADDRESS: {{ .Values.temporal.address }}
  TEMPORAL_NAMESPACE: "privacyops"
  S3_REGION: {{ .Values.s3.region }}
  S3_BUCKET: {{ .Values.s3.bucket }}
  CORS_ORIGINS: "https://app.privacyops.techd.com"
  LOG_LEVEL: "log"
  OTEL_ENABLED: "true"
  OTEL_SERVICE_NAME: "privacyops-api"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://jaeger-collector:4318"
  WORKER_HEALTH_PORT: "4001"
```
