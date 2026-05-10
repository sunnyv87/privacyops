# TechD PrivacyOps -- Upgrade and Migration Guide

## Overview

This guide covers safe upgrade procedures for the PrivacyOps platform, including Prisma database migrations, blue-green deployments, rollback procedures, and version compatibility.

---

## 1. Prisma Migration Workflow

### Development: Create a Migration

```bash
# Make schema changes in apps/api/prisma/schema.prisma, then:
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name <descriptive_name>

# Examples:
npx prisma migrate dev --name add_legal_holds_table
npx prisma migrate dev --name add_ai_governance_columns
npx prisma migrate dev --name add_saas_billing_tables
```

This generates a migration file at `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` and applies it to the local database.

### Production: Deploy Pending Migrations

```bash
# Apply all pending migrations (does NOT generate new ones)
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

### Migration Status

```bash
# Check which migrations have been applied
npx prisma migrate status --schema apps/api/prisma/schema.prisma
```

### Init Container (Kubernetes)

Migrations run as a Kubernetes init container before the API starts:

```yaml
initContainers:
  - name: prisma-migrate
    image: ghcr.io/techd/privacyops-api:{{ .Values.api.image.tag }}
    command: ["npx", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: privacyops-db-credentials
            key: database-url
```

---

## 2. Database Migration Safety

### Pre-Migration Checklist

1. **Backup the database** before any migration:
   ```bash
   pg_dump -h pg-primary.db.svc -U privacyops -Fc privacyops > \
     backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump
   ```

2. **Review the generated SQL** in `prisma/migrations/<timestamp>/migration.sql`

3. **Test in staging** with a copy of production data

4. **Check for destructive operations**:
   - `DROP TABLE` / `DROP COLUMN` -- always require a phased approach
   - `ALTER TABLE ... ALTER COLUMN TYPE` -- may require table rewrites
   - `CREATE INDEX` without `CONCURRENTLY` -- locks the table

### Safe Column Removal (3-Phase)

Never remove a column in a single deployment. Use a 3-phase approach:

**Phase 1: Stop writing (Deploy v2.1)**
```prisma
model Asset {
  // Mark as optional, stop writing to it
  legacyField String? @map("legacy_field")  // DEPRECATED: remove in v2.3
}
```

**Phase 2: Stop reading (Deploy v2.2)**
- Remove all code references to `legacyField`
- Verify in staging that no queries reference the column

**Phase 3: Drop column (Deploy v2.3)**
```bash
npx prisma migrate dev --name drop_asset_legacy_field
```

### Safe Index Creation

For large tables, create indexes concurrently to avoid blocking:

```sql
-- Instead of Prisma's default CREATE INDEX:
CREATE INDEX CONCURRENTLY idx_assets_tenant_classification
  ON assets (tenant_id, classification_status);
```

Add this as a custom migration:

```bash
npx prisma migrate dev --create-only --name add_assets_classification_index
# Edit the generated migration.sql to use CONCURRENTLY
npx prisma migrate dev
```

---

## 3. RLS Extension Updates

After schema changes that add new tenant-scoped tables, update the RLS extension:

```bash
# Add new table names to scripts/rls-extension.sql, then apply:
psql $DATABASE_URL -f scripts/rls-extension.sql
```

The script is idempotent -- it drops and recreates policies for each table. Verify RLS is active:

```sql
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 4. Blue-Green Deployment

### Strategy

Blue-green deployment eliminates downtime by running two identical environments:

```
                   ┌─────────────┐
Traffic ──────────>│   Ingress   │
                   └──────┬──────┘
                          │
              ┌───────────┴───────────┐
              │                       │
      ┌───────▼───────┐     ┌────────▼────────┐
      │  Blue (v2.0)  │     │  Green (v2.1)   │
      │  (current)    │     │  (new version)  │
      └───────────────┘     └─────────────────┘
```

### Procedure

```bash
# 1. Deploy green environment (new version)
helm install privacyops-green infra/helm/privacyops/ \
  --namespace privacyops \
  --set api.image.tag=v2.1.0 \
  --set web.image.tag=v2.1.0 \
  --set ingress.enabled=false \
  --values infra/helm/privacyops/values.yaml

# 2. Run migrations on green (if init container is configured, this is automatic)
kubectl exec -n privacyops deploy/privacyops-green-api -- \
  npx prisma migrate deploy --schema prisma/schema.prisma

# 3. Verify green health
kubectl exec -n privacyops deploy/privacyops-green-api -- \
  wget -qO- http://localhost:4000/api/v1/health/ready

# 4. Run smoke tests against green
k6 run --env BASE_URL=http://privacyops-green-api:4000/api/v1 \
  apps/api/test/load/smoke.js

# 5. Switch traffic to green
kubectl patch ingress privacyops -n privacyops \
  --type=json -p='[
    {"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/name","value":"privacyops-green-api"}
  ]'

# 6. Monitor for 15 minutes
# Watch error rates and latency in Grafana

# 7. Decommission blue (after validation period)
helm uninstall privacyops-blue --namespace privacyops
```

### Database Compatibility

Both blue and green MUST be able to work with the same database schema. This means:
- New columns must be nullable or have defaults
- Old columns must not be removed until the old version is decommissioned
- New tables can be added freely (old version ignores them)

---

## 5. Rolling Update (Standard)

For non-breaking changes, use Helm's rolling update:

```bash
helm upgrade privacyops infra/helm/privacyops/ \
  --namespace privacyops \
  --set api.image.tag=v2.1.0 \
  --set web.image.tag=v2.1.0 \
  --reuse-values
```

The deployment configuration ensures zero downtime:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  minReadySeconds: 30
```

With `maxUnavailable: 0`, Kubernetes ensures that all existing pods remain available while new pods are created and pass readiness probes.

---

## 6. Rollback Procedures

### Helm Rollback

```bash
# List revision history
helm history privacyops --namespace privacyops

# Rollback to previous revision
helm rollback privacyops <revision-number> --namespace privacyops

# Rollback to the immediately previous version
helm rollback privacyops 0 --namespace privacyops
```

### Database Rollback

Prisma does not support automatic migration rollback. Use manual procedures:

```bash
# 1. Identify the failed migration
npx prisma migrate status --schema apps/api/prisma/schema.prisma

# 2. Mark migration as rolled back
npx prisma migrate resolve --rolled-back <migration_name> \
  --schema apps/api/prisma/schema.prisma

# 3. Manually reverse the SQL changes
psql $DATABASE_URL -c "ALTER TABLE assets DROP COLUMN IF EXISTS new_column;"

# 4. For critical failures, restore from backup
pg_restore -h pg-primary.db.svc -U privacyops -d privacyops \
  --clean --if-exists backup_pre_migration_20260510.dump
```

### Emergency Rollback Runbook

1. **Detect**: Alert fires (API5xxErrorSpike, PostgreSQLDown, or manual report)
2. **Assess**: Check Grafana SLO dashboard -- is error budget exhausted?
3. **Decision**: If > 5% error rate sustained for 5 minutes, proceed with rollback
4. **Execute**:
   ```bash
   helm rollback privacyops 0 --namespace privacyops
   ```
5. **Verify**: Check `/api/v1/health/ready` returns 200
6. **Database**: If migration caused the issue, restore from pre-migration backup
7. **Audit chain**: Verify audit log integrity after restore:
   ```bash
   curl -X POST https://api.privacyops.techd.com/api/v1/audit/verify-chain \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
8. **Post-mortem**: Document the failure and fix the migration

---

## 7. Breaking Change Handling

### API Versioning

The API uses the `/api/v1/` prefix. Breaking changes require a new version:

```typescript
// apps/api/src/main.ts
app.setGlobalPrefix('api/v1');

// For v2 endpoints, add a separate controller:
@Controller('api/v2/connectors')
export class ConnectorsV2Controller { ... }
```

### Worker Compatibility

The Temporal worker and API server share the same image but run different entrypoints. Both must be upgraded together when workflow definitions change.

**Safe order of operations:**
1. Deploy new worker version (registers new workflow/activity definitions)
2. Deploy new API version (starts using new workflow definitions)
3. Existing running workflows continue on the old path via Temporal's deterministic replay

### Temporal Workflow Versioning

Use `patched()` for backward-compatible workflow changes:

```typescript
import { patched } from '@temporalio/workflow';

export async function scanWorkflow(input: ScanInput) {
  if (patched('v2-parallel-classify')) {
    // New behavior
  } else {
    // Legacy behavior -- replayed workflows use this
  }
}
```

---

## 8. Version Compatibility Matrix

| PrivacyOps | Node.js | PostgreSQL | Redis | NATS | Temporal | Prisma |
|------------|---------|------------|-------|------|----------|--------|
| 1.x | 20.x | 15, 16 | 7.x | 2.9+ | 1.22+ | 5.x |
| 2.x | 20.x | 16 | 7.x | 2.10+ | 1.23+ | 5.x |
| 2.1+ | 20.x, 22.x | 16, 17 | 7.x | 2.10+ | 1.23+ | 6.x |

### Dependency Upgrade Procedure

```bash
# Update Node.js packages
pnpm update --latest --recursive

# Regenerate Prisma client after Prisma version bump
pnpm db:generate

# Verify
pnpm build
pnpm test
pnpm lint
```

---

## 9. Pre-Upgrade Validation

### Automated Checks

```bash
# 1. Run full test suite
pnpm test

# 2. Run linting
pnpm lint

# 3. Build all packages
pnpm build

# 4. Run E2E tests
npx jest --config apps/api/test/e2e/jest-e2e.config.ts --runInBand

# 5. Run load tests (smoke)
k6 run apps/api/test/load/smoke.js

# 6. Check migration status
npx prisma migrate status --schema apps/api/prisma/schema.prisma
```

### Manual Checks

- [ ] Review `CHANGELOG.md` for breaking changes
- [ ] Verify all environment variables are set for new features
- [ ] Confirm RLS extension includes all new tables
- [ ] Validate Temporal worker registers all 8 task queues
- [ ] Verify connector registry count matches expected (43 types)
- [ ] Check Grafana dashboards render correctly with new metrics

---

## 10. Post-Upgrade Verification

```bash
# 1. Health and readiness
curl -s https://api.privacyops.techd.com/api/v1/health/ready | jq .

# 2. Verify all workers started
kubectl logs -n privacyops deploy/privacyops-temporal-worker --tail=30

# 3. Verify metrics are flowing
curl -s https://api.privacyops.techd.com/api/v1/metrics | grep http_requests_total

# 4. Verify audit chain integrity
curl -X POST https://api.privacyops.techd.com/api/v1/audit/verify-chain \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Run smoke test
k6 run --env BASE_URL=https://api.privacyops.techd.com/api/v1 \
  apps/api/test/load/smoke.js

# 6. Check connector count
curl -s https://api.privacyops.techd.com/api/v1/connectors/types | jq '.length'
# Expected: 43
```
