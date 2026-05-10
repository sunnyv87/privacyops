# TechD PrivacyOps -- Database Setup Guide

## Overview

PrivacyOps uses PostgreSQL 16 as the primary database, managed through Prisma ORM. The schema (`apps/api/prisma/schema.prisma`) defines 60+ tables with Row Level Security (RLS) for multi-tenant isolation. The initialization scripts are in `scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/init-db.sql` | Creates Temporal databases and enables extensions |
| `scripts/security-hardening.sql` | Base RLS policies, `current_tenant_id()` function |
| `scripts/rls-extension.sql` | RLS for post-hardening tables (40+ additional tables) |

---

## 1. Local Development Setup

### Start PostgreSQL via Docker Compose

```bash
# From repository root
docker compose up -d postgres

# Verify
docker compose exec postgres pg_isready -U privacyops
```

The `docker-compose.yml` configures PostgreSQL with:

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: privacyops
    POSTGRES_PASSWORD: privacyops_dev
    POSTGRES_DB: privacyops
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U privacyops']
    interval: 5s
    timeout: 5s
    retries: 5
```

### Initialize Extensions

The `init-db.sql` script runs on first startup:

```sql
-- scripts/init-db.sql
CREATE DATABASE temporal;
CREATE DATABASE temporal_visibility;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 2. Prisma Schema and Migrations

### Schema Location

The Prisma schema is at `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Generate Prisma Client

```bash
pnpm db:generate
# or directly:
npx prisma generate --schema apps/api/prisma/schema.prisma
```

### Run Migrations (Development)

```bash
# Create and apply a new migration
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name <migration_name>

# Using turbo
pnpm db:migrate
```

### Deploy Migrations (Production)

```bash
# Apply pending migrations without generating new ones
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

### Seed Data

```bash
pnpm db:seed
# Runs: apps/api/prisma/seed.ts
```

---

## 3. Schema Overview: Core Domains

The 60+ table schema is organized into these domains:

### Tenancy and Identity
| Table | Description |
|-------|-------------|
| `tenants` | Multi-tenant root. Links to plans, billing, subscriptions. |
| `users` | Tenant-scoped users with auth provider, MFA, lockout tracking. |
| `roles` | System and tenant roles with JSON permission arrays. |
| `user_roles` | M:N join with optional scope restrictions. |

### DSPM: Data Sources and Connectors
| Table | Description |
|-------|-------------|
| `data_sources` | Registered connector instances (43 types). |
| `assets` | Discovered data assets (tables, buckets, files, etc.). |
| `asset_fields` | Column/field-level metadata within assets. |
| `scan_jobs` | Discovery and classification scan execution records. |

### Classification and Risk
| Table | Description |
|-------|-------------|
| `classifications` | PII/PHI/PCI classification results per asset. |
| `classification_labels` | Label taxonomy (SSN, email, credit_card, etc.). |
| `risk_findings` | DSPM risk findings with severity scoring. |
| `entity_risk_profiles` | Aggregated risk scores per entity. |

### Privacy Operations
| Table | Description |
|-------|-------------|
| `dsar_requests` | Data Subject Access Requests with status tracking. |
| `data_subjects` | Identity resolution for DSARs. |
| `consent_records` | Consent grants/revocations per data subject. |
| `consent_notices` | Published consent notice versions. |
| `processing_purposes` | Legal basis for data processing (GDPR Art. 6). |
| `ropa_entries` | Records of Processing Activities. |

### Compliance and Governance
| Table | Description |
|-------|-------------|
| `privacy_assessments` | DPIAs and PIAs with approval workflows. |
| `incidents` | Breach/incident tracking with severity and timeline. |
| `retention_policies` | Data retention rules and schedules. |
| `vendors` | Third-party vendor registry. |
| `vendor_assessments` | Vendor risk assessment records. |
| `regulations` | Regulatory framework definitions. |
| `legal_holds` | Litigation hold enforcement with RLS. |

### Audit and Security
| Table | Description |
|-------|-------------|
| `audit_logs` | SHA256 hash-chained audit trail (tamper-evident). |
| `audit_chain_state` | Per-tenant last hash and sequence counter. |
| `approval_requests` | Multi-level approval workflow state. |

### SaaS / Billing
| Table | Description |
|-------|-------------|
| `plans` | Subscription plan definitions. |
| `billing_accounts` | Stripe customer mapping. |
| `subscriptions` | Active subscription state. |
| `invoices` | Invoice records. |
| `usage_events` | Metered usage events. |
| `usage_aggregates` | Pre-aggregated usage for billing. |
| `feature_overrides` | Per-tenant feature flag overrides. |
| `onboarding_state` | Tenant onboarding progress. |

---

## 4. Row Level Security (RLS)

### Architecture

RLS enforces tenant isolation at the database level, independent of application-level guards. Every query from the API automatically scopes to the requesting tenant.

### How It Works

1. `scripts/security-hardening.sql` creates the `current_tenant_id()` function that reads a session variable:

```sql
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
```

2. `PrismaService` sets this session variable before each tenant-scoped query:

```typescript
// apps/api/src/core/prisma/prisma.service.ts
await prisma.$executeRawUnsafe(
  `SET LOCAL app.current_tenant_id = '${tenantId}'`
);
```

3. The `TenantGuard` (`apps/api/src/core/tenant/guards/tenant.guard.ts`) extracts `tenantId` from the JWT and injects it into the request context.

### RLS Extension Script

`scripts/rls-extension.sql` applies RLS to 40+ post-hardening tables:

```sql
-- Tables with strict tenant isolation
'data_graph_nodes', 'data_graph_edges', 'entity_risk_profiles',
'remediation_actions', 'identity_access_mappings', 'shadow_data_alerts',
'data_lineage_records', 'attack_paths', 'legal_holds',
'dpia_trigger_rules', 'retention_violations', 'disposition_certificates',
'compliance_frameworks', 'control_gaps', 'breach_detection_rules',
'ai_systems', 'ai_dataset_usages', 'co_pilot_conversations',
'risk_predictions', 'risk_anomalies', 'remediation_plans',
'attack_simulations', 'simulated_attack_paths', 'threat_hunts',
'threat_indicators', 'access_baselines', 'ai_model_lineages',
'ai_risk_assessments', 'risk_forecasts', 'graph_analytics_results',
'compliance_advices', 'control_mappings', 'adaptive_policies',
'policy_executions', 'incident_playbooks', 'incident_impact_analyses',
'validation_runs', 'validation_tests'
```

Tables with nullable `tenant_id` (system-level metrics) use a permissive policy:

```sql
-- Allow NULL tenant_id rows to be visible to all, scope non-NULL rows
'service_metrics', 'connector_health_logs',
'platform_alerts', 'optimization_recommendations'
```

### Applying RLS

```bash
# Run after Prisma migrations
psql $DATABASE_URL -f scripts/security-hardening.sql
psql $DATABASE_URL -f scripts/rls-extension.sql
```

The scripts are idempotent -- they use `IF NOT EXISTS` guards and drop/recreate policies.

---

## 5. Connection Pooling (PgBouncer)

### Why PgBouncer

With 3 API replicas, 2 worker replicas, and burst scan workers, direct connections can exceed PostgreSQL's `max_connections`. PgBouncer provides connection pooling.

### PgBouncer Configuration

```ini
; /etc/pgbouncer/pgbouncer.ini
[databases]
privacyops = host=pg-primary.db.svc port=5432 dbname=privacyops

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 10
```

**Important**: Use `pool_mode = transaction` (not `session`) because RLS session variables (`SET LOCAL`) are scoped to the transaction. Prisma's `$transaction()` calls in `AuditService` rely on this.

### Connection String with PgBouncer

```
DATABASE_URL=postgresql://privacyops:<password>@pgbouncer.db.svc:6432/privacyops?pgbouncer=true&sslmode=require
```

Add `?pgbouncer=true` to the Prisma connection string to disable prepared statements (incompatible with PgBouncer transaction pooling).

---

## 6. Backup Strategy

### Automated Backups (AWS RDS)

| Setting | Value |
|---------|-------|
| Backup window | 02:00-03:00 UTC |
| Retention | 35 days |
| Multi-AZ | Enabled |
| Encryption | AES-256 (KMS) |

### Manual Backup

```bash
# Logical backup
pg_dump -h pg-primary.db.svc -U privacyops -Fc privacyops > \
  privacyops_$(date +%Y%m%d_%H%M%S).dump

# Restore
pg_restore -h pg-primary.db.svc -U privacyops -d privacyops \
  --clean --if-exists privacyops_20260510_020000.dump
```

### Point-in-Time Recovery

```bash
# AWS RDS PITR
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier privacyops-prod \
  --target-db-instance-identifier privacyops-pitr \
  --restore-time "2026-05-10T02:00:00Z" \
  --region ap-south-1
```

### Audit Log Integrity Verification

After any restore, verify the SHA256 hash chain has not been broken:

```bash
# Via API
curl -X POST https://api.privacyops.techd.com/api/v1/audit/verify-chain \
  -H "Authorization: Bearer <admin-token>" \
  -H "X-Tenant-Id: <tenant-id>"

# Expected response:
# { "valid": true, "totalChecked": 12847 }
```

The verification logic is in `apps/api/src/core/audit/audit.service.ts` -- the `verifyChain()` method reads all logs in chronological order and recomputes SHA256 hashes to detect tampering or missing records.

---

## 7. Performance Tuning

### PostgreSQL Configuration

```sql
-- Recommended for PrivacyOps workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD storage
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET log_min_duration_statement = 500;  -- Log slow queries > 500ms
SELECT pg_reload_conf();
```

### Key Indexes

The Prisma schema defines indexes on all `tenant_id` columns and frequently queried fields. Verify with:

```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```
