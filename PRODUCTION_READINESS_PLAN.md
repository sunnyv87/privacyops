# PrivacyOps Production Readiness — Upgrade Plan & Assessment

**Date:** 2026-03-12
**Scope:** 37 audit issues across 10 remediation steps
**Approach:** Extend only, no recreation, backward compatible

---

## CURRENT READINESS SCORES

| Dimension              | Score  | Status       |
|------------------------|--------|--------------|
| Security               | 7/10   | Acceptable   |
| Connector Scalability  | 2/10   | Critical (5/7 are stubs, only 2 registered) |
| API Performance        | 4/10   | Poor         |
| Event Architecture     | 2/10   | Critical     |
| Data Graph             | 6/10   | Fair         |
| Database Schema        | 7/10   | Acceptable   |
| **Overall**            | **5.2/10** | **Not Production Ready** |

---

## STEP 1: DATA GRAPH COMPLETION

**Current State:** Data graph module exists (`data-graph/`) with `DataGraphNode`, `DataGraphEdge` models, BFS traversal, sync from assets/vendors/users, and enrichment (risk signals, attack vectors, controls). 8 node types and 7 edge types defined in enums.

**What's Missing:**
- No `processing_activities` or `retention_policies` node sync (types exist in enum but never synced)
- Graph enrichment doesn't link `compliance_controls` entities
- No bidirectional edge support (edges are one-way only)
- No graph pruning / stale-node cleanup
- `GraphAnalyticsService` exists but analytics results aren't fed back into risk scoring

**Plan:**
1. **Extend `DataGraphSyncService`** — Add `syncProcessingActivities()` to create nodes from `ProcessingPurpose` + `RopaEntry` records with `GOVERNED_BY` edges to related assets
2. **Extend `DataGraphSyncService`** — Add `syncRetentionPolicies()` to create nodes from `RetentionPolicy` records with `GOVERNED_BY` edges to applicable assets
3. **Extend `DataGraphSyncService`** — Add `syncComplianceControls()` to create nodes from `Control` + `Regulation` records with `CONTROLLED_BY_POLICY` edges
4. **Add stale node cleanup** — `pruneStaleNodes(tenantId, olderThanDays)` method to soft-remove nodes whose source entities are deleted
5. **Feed analytics into risk** — Wire `GraphAnalyticsResult` outputs into `EntityRiskProfile` updates

**Files to modify:**
- `apps/api/src/modules/data-graph/data-graph-sync.service.ts`
- `apps/api/src/modules/data-graph/graph-enrichment.service.ts`
- `apps/api/src/modules/data-graph/data-graph.service.ts`

**Estimated complexity:** Medium
**Risk:** Low (additive only)

---

## STEP 2: CONNECTOR COVERAGE EXPANSION (7 → 18+)

**Current State:** 7 connectors exist: `aws-s3`, `azure-blob`, `gcp-storage`, `postgres`, `mysql`, `mongodb`, `snowflake`. Only Snowflake status is unknown — need to verify.

**Critical Issues in Existing Connectors:**
| Connector | Extends BaseConnector? | Registered in Module? | Status |
|-----------|----------------------|----------------------|--------|
| aws-s3 | NO — implements IConnector directly | YES | Production-ready but no pagination (MaxKeys:1000, no ContinuationToken). `sampleContent` empty stub. No retry/rate-limit. |
| postgres | NO — implements IConnector directly | YES | Production-ready but uses `pg.Client` (not `Pool`). SQL injection in sampleContent. `rejectUnauthorized: false`. No query timeout. |
| mysql | YES | **NO** | Heavily stubbed — pool creation commented out, returns empty arrays |
| mongodb | YES | **NO** | Partially implemented — collection listing works, rest stubbed |
| azure-blob | YES | **NO** | Heavily stubbed — client creation commented out, TODO comments throughout |
| gcp-storage | YES | **NO** | Heavily stubbed — returns empty arrays, client commented out |
| snowflake | YES | **NO** | Heavily stubbed — all operations return placeholders |

**NOTE:** Only 2 of 7 connectors are registered in `ConnectorsModule`. The other 5 are dead code — not injectable at runtime.

**Plan:**

### Phase 2A: Fix Existing Connectors (CRITICAL — before adding new ones)
1. **Refactor all 7 connectors to extend `BaseConnector`** — inherit retry logic, rate limiting
2. **Fix S3 pagination** — Add `ContinuationToken` loop in `listAssets()` for buckets with >1000 objects
3. **Fix S3 `sampleContent`** — Implement actual file download + parsing (CSV/JSON/Parquet headers)
4. **Fix Postgres: `Client` → `Pool`** — Use connection pooling with configurable `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`
5. **Fix Postgres SQL injection** — Use `pg-format` or `quote_ident()` for dynamic identifiers in sampleContent
6. **Fix Postgres SSL** — Make `rejectUnauthorized` configurable (default `true`), support CA cert
7. **Add per-operation timeouts** — `statement_timeout` for Postgres, `AbortController` for S3/HTTP connectors
8. **Add connection pooling to BaseConnector** — Abstract pool management for database connectors

### Phase 2B: Add New Connectors
| # | Connector | Category | Complexity |
|---|-----------|----------|------------|
| 1 | SQL Server | Database | Medium — TDS protocol via `mssql` |
| 2 | BigQuery | Data Warehouse | Medium — `@google-cloud/bigquery` |
| 3 | Redshift | Data Warehouse | Low — Postgres-wire compatible, extend PostgresConnector |
| 4 | Databricks | Data Warehouse | Medium — REST API + SQL via `databricks-sql-nodejs` |
| 5 | Salesforce | SaaS/CRM | High — SOQL + Describe API, OAuth2 flow |
| 6 | Okta | Identity | Medium — REST API, paginated user/group listing |
| 7 | Azure AD | Identity | Medium — Microsoft Graph API, paginated |
| 8 | GitHub | DevOps | Medium — REST/GraphQL API, repo scanning |
| 9 | ServiceNow | IT/GRC | Medium — REST Table API |
| 10 | Google Drive | Storage | Medium — Drive API v3, OAuth2 |
| 11 | SharePoint | Storage | High — Microsoft Graph API, complex auth |

**Files to modify/create:**
- `apps/api/src/modules/connectors/sdk/base-connector.ts` — add pool management
- All 7 existing `implementations/*.connector.ts` — refactor to extend BaseConnector
- `apps/api/src/modules/connectors/connector-registry.ts` — register new types
- 11 new files in `implementations/`
- `packages/shared-types/src/enums.ts` — extend `DataSourceType` enum

**Estimated complexity:** High
**Risk:** Medium (existing connector refactoring must not break current integrations)

---

## STEP 3: CONTROLLER ROUTE COLLISION FIXES

**Current State:** 38 controllers, 3 confirmed route collisions:

| Collision | Route | Controllers |
|-----------|-------|-------------|
| 1 | `POST /data-graph/sync` | `DataGraphController.syncAll()` vs `GraphAnalyticsController.syncEntities()` |
| 2 | `GET /incidents/:id/impact` | `IncidentsController.getImpact()` vs `IncidentResponseAiController.getImpactAnalysis()` |
| 3 | `POST /ai-governance/systems/:id/lineage` | `AiGovernanceController` vs `AiGovernanceIntelligenceController` |

**Plan:**
1. **Fix collision 1** — Move `GraphAnalyticsController` sync route to `POST /data-graph/analytics/sync` or remove duplicate and consolidate into `DataGraphController`
2. **Fix collision 2** — Move AI impact analysis to `GET /incidents/:id/ai-impact` in `IncidentResponseAiController`, keep original in `IncidentsController`
3. **Fix collision 3** — Move intelligence lineage to `POST /ai-governance/intelligence/systems/:id/lineage` by changing controller prefix to `@Controller('ai-governance/intelligence')`
4. **Verify frontend** — Check `apps/web` for any references to changed routes

**Files to modify:** 3 controller files
**Estimated complexity:** Low
**Risk:** Low (URL changes require frontend alignment — check if routes are called from `apps/web`)

---

## STEP 4: EVENT PIPELINE COMPLETION

**Current State:**
- 154 event types defined in `packages/shared-types/src/events.ts`
- `EventBusService` publishes to NATS JetStream (`privacyops.>` stream)
- Active publishers: DiscoveryService (scan.*), AuditService (security.*), ConnectorHealthService (connector.health_degraded), PlatformAlertService (platform.alert_created)
- **No subscribers/consumers found** — no `@EventPattern`, no `@MessagePattern`, no `.subscribe()` calls
- NATS operates as fire-and-forget

**Gaps:**
- No event consumers for: discovery.completed → classification trigger, classification.completed → risk scoring, risk.score_changed → remediation, shadow_data.detected → alerting, breach.detected → incident creation
- No dead-letter queue
- No event replay capability
- No event schema validation
- Graceful degradation logs to console but events are lost

**Plan:**
1. **Create `EventConsumerService`** — Central consumer registration using `EventBusService.subscribe()` with durable consumers
2. **Wire discovery → classification pipeline** — On `scan.completed`, auto-trigger classification for discovered assets
3. **Wire classification → risk pipeline** — On `classification.completed`, recalculate entity risk profiles
4. **Wire risk → remediation pipeline** — On `risk.score_changed` (above threshold), create remediation proposals
5. **Wire shadow data → alerts** — On `shadow_data.detected`, create `PlatformAlert`
6. **Wire breach detection → incidents** — On `breach.detected`, auto-create `Incident` record
7. **Add dead-letter subject** — `privacyops.dlq.>` for failed event processing
8. **Add event schema validation** — Validate event payloads against shared types before publish

**Files to create/modify:**
- New: `apps/api/src/core/events/event-consumer.service.ts`
- New: `apps/api/src/core/events/event-handlers/*.handler.ts` (one per pipeline)
- Modify: `apps/api/src/core/events/event-bus.service.ts` — add DLQ, schema validation
- Modify: `apps/api/src/app.module.ts` — register consumer service

**Estimated complexity:** High
**Risk:** Medium (event handlers must be idempotent; duplicate processing must be handled)

---

## STEP 5: PRODUCTION SECURITY HARDENING

**Current State:**
- Helmet enabled, CORS configured, JWT validated at startup
- ValidationPipe with whitelist/forbidNonWhitelisted/transform
- No request timeout, no body size limit, no compression
- Swagger exposed unconditionally (no production gate)
- `enableImplicitConversion: true` — type coercion attack surface
- Two rate limiters: in-memory per-tenant (non-horizontal) + Redis per-IP (opt-in)
- No global exception filter (default NestJS errors may leak stack traces)
- OAuth2 auth has race condition on concurrent token refresh, no retry on refresh failure
- Connector credentials stored unencrypted (`// TODO: Encrypt with tenant KMS key`)

**Plan:**
1. **Add request timeout** — `app.use()` with timeout middleware (30s default, configurable)
2. **Add body size limit** — `app.use(json({ limit: '1mb' }))` and `urlencoded({ limit: '1mb' })`
3. **Add compression** — `app.use(compression())`
4. **Gate Swagger in production** — Disable or require auth for `NODE_ENV=production`
5. **Remove `enableImplicitConversion`** — Use explicit `@Type()` decorators in DTOs
6. **Consolidate rate limiting** — Merge to single Redis-backed rate limiter, apply globally, key by tenant+IP
7. **Add global exception filter** — Catch all unhandled exceptions, sanitize error responses (no stack traces in production)
8. **Fix OAuth2 race condition** — Add mutex/lock on token refresh, add retry with backoff
9. **Encrypt connector credentials** — Implement KMS-backed encryption in `ConnectorsService.create/update`
10. **Add pageSize upper bound** — Cap at 100 in `ConnectorsService.findAll` and all paginated endpoints
11. **Add security headers review** — CSP, X-Content-Type-Options, etc. via Helmet configuration

**Files to modify:**
- `apps/api/src/main.ts`
- `apps/api/src/core/security/rate-limiter.service.ts`
- `apps/api/src/core/auth/guards/rate-limit.guard.ts`
- `apps/api/src/modules/connectors/sdk/auth/oauth2.auth.ts`
- `apps/api/src/modules/connectors/connectors.service.ts`
- New: `apps/api/src/core/filters/global-exception.filter.ts`
- New: `apps/api/src/core/middleware/timeout.middleware.ts`
- Multiple DTO files (remove implicit conversion)

**Estimated complexity:** High
**Risk:** Medium (rate limiter consolidation and implicit conversion removal need thorough testing)

---

## STEP 6: SCALABILITY REVIEW

**Current State:**
- In-memory rate limiter → won't work with multiple replicas
- Sequential asset/field upserts → O(n) writes per scan, 2M+ for large databases
- No connection pooling in connectors (Postgres uses single `Client`)
- Health checks create new connection per check
- No concurrent scan management (multiple scans can overwhelm target)
- Metrics interceptor swallows errors silently

**Plan:**
1. **Batch asset upserts** — Replace sequential `prisma.asset.upsert` with `prisma.$transaction` batches (100 at a time) or `createMany` with conflict handling
2. **Batch field upserts** — Same batching strategy for `assetField`
3. **Add concurrent scan limiter** — Per-tenant and global max concurrent scans (configurable via env)
4. **Connection pool for health checks** — Reuse connector instances via a short-lived cache instead of creating new connections
5. **Stateless rate limiter** — Already covered in Step 5 (consolidate to Redis)
6. **Add metrics error logging** — Replace `.catch(() => {})` with actual error logging (non-blocking)
7. **Add slow request alerting** — Threshold-based alerts when `request_latency_ms > configurable_limit`
8. **Database query optimization** — Add `@index` for common query patterns not yet covered

**Files to modify:**
- `apps/api/src/modules/discovery/discovery.service.ts` — batch upserts
- `apps/api/src/modules/connectors/connectors.service.ts` — scan limiter, connection caching
- `apps/api/src/modules/observability/metrics.interceptor.ts` — error logging
- `apps/api/src/modules/observability/connector-health.service.ts` — pool reuse

**Estimated complexity:** Medium-High
**Risk:** Medium (batch upserts must handle partial failures correctly)

---

## STEP 7: DATABASE SCHEMA VALIDATION

**Current State:** 48+ Prisma models, comprehensive indexes, some issues noted.

**Issues Found:**
1. **Orphaned foreign keys** — `RemediationPlan.findingId`, `IncidentPlaybook.incidentId`, `IncidentImpactAnalysis.incidentId` reference IDs without `@relation` — Prisma won't enforce FK constraints
2. **Inconsistent nullable tenant IDs** — `Role`, `ClassificationLabel`, `Regulation`, `Control` have nullable `tenantId` (system records pattern) but inconsistently applied
3. **Heavy JSON columns** — `evidence`, `metadata`, `configurations` stored as JSON reduce queryability
4. **Weak FK in JSON** — `linkedControlIds`, `linkedObligationIds` stored as JSON arrays, no referential integrity
5. **Missing soft-delete** — Several models (`ConsentRecord`, `Obligation`, etc.) lack `deletedAt`
6. **No explicit `ProcessingActivity` model** — Data spread across `ProcessingPurpose`, `RopaEntry`, `DataLineageRecord`

**Plan:**
1. **Add missing `@relation` fields** — For `RemediationPlan`, `IncidentPlaybook`, `IncidentImpactAnalysis`
2. **Standardize nullable tenantId** — Document the system-record pattern, add `@@index([tenantId])` to all models using it
3. **Add composite indexes** — For frequent join patterns identified during query profiling
4. **Add `deletedAt` to models** missing soft-delete support
5. **Migration safety** — All schema changes via `prisma migrate dev` with backward-compatible additive changes only

**Files to modify:**
- `apps/api/prisma/schema.prisma`

**Estimated complexity:** Medium
**Risk:** Low (additive schema changes, no destructive migrations)

---

## STEP 8: ENGINE INTEGRATION VALIDATION

**Current State:** The Discovery → Classification → Graph → Risk → Remediation pipeline exists as separate modules but is not wired end-to-end.

**Integration Chain:**
```
Connector.listAssets() → DiscoveryService.executeScan() → [GAP] →
ClassificationService → [GAP] → DataGraphSyncService → [GAP] →
DspmService.calculateRisk() → [GAP] → RemediationService
```

**Gaps:**
- Discovery completes but doesn't trigger classification
- Classification doesn't trigger graph sync
- Graph sync doesn't trigger risk recalculation
- Risk changes don't trigger remediation proposals

**Plan:**
1. **Wire via event pipeline (Step 4)** — Each stage publishes completion event, next stage subscribes
2. **Add integration test** — End-to-end test: create connector → run scan → verify classification → verify graph → verify risk → verify remediation proposal
3. **Add pipeline status tracking** — Track each asset through the full pipeline stages (discovery → classified → graphed → risk-scored → remediated)
4. **Add pipeline metrics** — Time-to-complete per stage, throughput, error rates

**Dependencies:** Step 4 (event pipeline) must be completed first
**Estimated complexity:** Medium
**Risk:** Low (wiring existing services together)

---

## STEP 9: CONNECTOR HEALTH CHECK VERIFICATION

**Current State:**
- `ConnectorsService.healthCheck()` creates new connection per check, runs `testConnection()`, updates status
- `ConnectorHealthService` in observability module tracks health logs with status history
- Health endpoint: `GET /health` (liveness) and `GET /health/ready` (DB check)
- No scheduled health checks
- No health degradation alerting thresholds

**Plan:**
1. **Add scheduled health checks** — Cron-based (`@Cron`) health check runner for all active connectors (configurable interval, default 5min)
2. **Add health degradation thresholds** — After N consecutive failures, mark connector as `degraded` and publish alert
3. **Reuse connections for health checks** — Cache connector instances to avoid creating new connections per check
4. **Add health check timeout** — 10s timeout per connector health check to prevent hanging
5. **Add health dashboard data** — Extend `getHealthSummary()` with latency percentiles and failure history

**Files to modify:**
- `apps/api/src/modules/connectors/connectors.service.ts`
- `apps/api/src/modules/observability/connector-health.service.ts`
- New: `apps/api/src/modules/connectors/connector-health-scheduler.service.ts`

**Estimated complexity:** Low-Medium
**Risk:** Low

---

## STEP 10: FINAL PRODUCTION READINESS REPORT

After completing Steps 1-9, re-score all dimensions:

**Target Scores:**
| Dimension              | Current | Target | Delta |
|------------------------|---------|--------|-------|
| Security               | 7/10    | 9/10   | +2    |
| Connector Scalability  | 3/10    | 8/10   | +5    |
| API Performance        | 4/10    | 8/10   | +4    |
| Event Architecture     | 2/10    | 8/10   | +6    |
| Data Graph             | 6/10    | 9/10   | +3    |
| Database Schema        | 7/10    | 9/10   | +2    |
| **Overall**            | **5.5/10** | **8.5/10** | **+3.0** |

---

## EXECUTION ORDER & DEPENDENCIES

```
Phase 1 (Parallel):
  ├── Step 1: Data Graph completion
  ├── Step 3: Route collision fixes
  ├── Step 7: Database schema validation
  └── Step 5: Security hardening (partial — Swagger, timeout, body limit, exception filter)

Phase 2 (Sequential after Phase 1):
  ├── Step 2A: Fix existing 7 connectors (CRITICAL PATH)
  └── Step 5: Security hardening (remaining — rate limiter, OAuth2, encryption)

Phase 3 (After Phase 2):
  ├── Step 4: Event pipeline completion
  └── Step 6: Scalability (batch upserts, scan limiter)

Phase 4 (After Phase 3):
  ├── Step 2B: Add new connectors (can start in parallel)
  ├── Step 8: Engine integration validation
  └── Step 9: Health check verification

Phase 5:
  └── Step 10: Final production readiness report
```

**Critical Path:** Step 2A (fix connectors) → Step 4 (event pipeline) → Step 8 (integration validation)

---

## SUMMARY OF ALL 37 AUDIT ISSUES MAPPED TO STEPS

| # | Issue | Severity | Step |
|---|-------|----------|------|
| 1 | No request timeout in main.ts | Critical | 5 |
| 2 | S3 connector: no pagination (MaxKeys:1000) | Critical | 2A |
| 3 | No per-operation timeout on connectors | Critical | 2A |
| 4 | Postgres: single Client, no Pool | High | 2A |
| 5 | Postgres: SQL injection in sampleContent | High | 2A |
| 6 | Postgres: rejectUnauthorized: false | High | 2A |
| 7 | Connectors don't extend BaseConnector | High | 2A |
| 8 | Sequential asset upserts (2M+ writes) | High | 6 |
| 9 | In-memory rate limiter (non-horizontal) | High | 5 |
| 10 | Swagger exposed in production | High | 5 |
| 11 | enableImplicitConversion: true | High | 5 |
| 12 | No global exception filter | High | 5 |
| 13 | Credentials stored unencrypted | High | 5 |
| 14 | OAuth2 race condition on refresh | High | 5 |
| 15 | No event consumers/subscribers | High | 4 |
| 16 | No pageSize upper bound | Medium | 5 |
| 17 | No body size limit | Medium | 5 |
| 18 | No compression middleware | Medium | 5 |
| 19 | S3 sampleContent unimplemented | Medium | 2A |
| 20 | Health checks create new connections | Medium | 9 |
| 21 | No concurrent scan management | Medium | 6 |
| 22 | Metrics errors silently swallowed | Medium | 6 |
| 23 | No dead-letter queue for events | Medium | 4 |
| 24 | No event schema validation | Medium | 4 |
| 25 | Orphaned foreign keys in schema | Medium | 7 |
| 26 | Processing activities not synced to graph | Medium | 1 |
| 27 | Retention policies not synced to graph | Medium | 1 |
| 28 | No graph stale-node cleanup | Medium | 1 |
| 29 | Controller route collision risk | Medium | 3 |
| 30 | No scheduled health checks | Medium | 9 |
| 31 | Discovery→Classification not wired | Medium | 8 |
| 32 | Classification→Risk not wired | Medium | 8 |
| 33 | No pipeline status tracking | Low | 8 |
| 34 | Inconsistent nullable tenantId | Low | 7 |
| 35 | Missing deletedAt on some models | Low | 7 |
| 36 | No slow request alerting | Low | 6 |
| 37 | OAuth2 no retry on token refresh | Low | 5 |

---

## REPOSITORY STATS

| Metric | Count |
|--------|-------|
| Modules | 40 |
| Services | 68 |
| Controllers | 39 |
| Prisma Models | 48+ |
| Existing Connectors | 7 |
| Event Types Defined | 154 |
| Event Consumers | 0 |
| Core Guards | 6 |
| Core Interceptors | 5 |
