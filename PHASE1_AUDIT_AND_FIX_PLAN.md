# PHASE 1: AUDIT + FIX PLAN
## PrivacyOps Platform — Production Readiness Delta Fixes

---

## 1. Executive Summary

The PrivacyOps platform has strong foundational infrastructure (39 modules, NATS JetStream, Temporal.io, Prisma ORM) but suffers from six concrete production blockers:

1. **API routing collision** — Two controllers share the `incidents` prefix, making 7 AI-powered incident endpoints unreachable
2. **Event pipeline** — 93% of published events (53 of 57) have zero consumers; no DLQ, no retry policy, no idempotency
3. **Connector layer** — Only AWS S3 works; PostgreSQL lacks the `pg` driver in package.json; 5 others are stubs with empty method bodies
4. **Workflow orchestration** — 8 Temporal workflows exist but zero cron jobs and zero WebSocket/SSE for realtime status
5. **Schema Heuristics** — `SchemaHeuristicsEngine` class exists at `classification/engine/schema-heuristics.ts` but is never imported or called anywhere
6. **Graph subsystem** — Functional but has N+1 query patterns in BFS traversals and missing composite indexes

---

## 2. Confirmed Production Blockers

| # | Blocker | Severity | Current Score | Target Score |
|---|---------|----------|--------------|-------------|
| 1 | Route collision: 7 incident-AI endpoints unreachable | CRITICAL | 7/10 | 9/10 |
| 2 | 93% orphaned events; no consumers for security, compliance, breach events | CRITICAL | 3/10 | 7/10 |
| 3 | 6 of 7 connectors non-functional; `pg` missing from deps | CRITICAL | 2/10 | 7/10 |
| 4 | No cron jobs; no WebSocket status channel | HIGH | 6/10 | 8/10 |
| 5 | SchemaHeuristicsEngine is dead code | MEDIUM | 8/10 | 9/10 |
| 6 | Graph N+1 queries; missing composite indexes | MEDIUM | 7/10 | 8/10 |

---

## 3. API Routing Collision Analysis

### Root Cause

Two controllers in `IncidentsModule` share the identical prefix `@Controller('incidents')`:

- **IncidentsController** (`incidents.controller.ts`, line 22) — registered first
- **IncidentResponseAiController** (`incident-response-ai.controller.ts`, line 15) — registered second

In NestJS, when two controllers share a prefix, the first controller's parameterized routes (`:id`) act as catch-all patterns that shadow the second controller's sub-routes. Specifically, `GET /incidents/:id` in `IncidentsController` (line 123) intercepts requests intended for `IncidentResponseAiController`.

### Unreachable Endpoints (7 total)

| Method | Path | Purpose | Shadowed By |
|--------|------|---------|-------------|
| `POST` | `/incidents/:id/ai-classify` | AI classification | `:id` catch-all |
| `POST` | `/incidents/:id/impact-analysis` | AI impact analysis | `:id` catch-all |
| `GET` | `/incidents/:id/impact` | Get impact analysis | Direct collision with IncidentsController's `GET :id/impact` (line 171) |
| `POST` | `/incidents/:id/playbook` | Generate AI playbook | `:id` catch-all |
| `GET` | `/incidents/:id/playbook` | Get playbook | `:id` catch-all |
| `POST` | `/incidents/:id/playbook/approve` | Approve playbook | `:id` catch-all |
| `POST` | `/incidents/:id/contain` | Execute containment | `:id` catch-all |

### Fix Strategy

Change `IncidentResponseAiController` prefix from `'incidents'` to `'incidents/:incidentId/ai'`. This:
- Resolves all 7 collisions
- Creates a clean sub-resource namespace
- Preserves `IncidentsController` routes unchanged
- Is backward-compatible (previous routes were unreachable anyway, so no existing client depends on them)

Additionally, the duplicate `GET :id/impact` endpoint in `IncidentsController` (line 171) should be reviewed: it returns a subset of incident fields, while the AI controller version returns an AI-generated impact analysis. Both can coexist since they'll be at different paths after the fix.

### Route Table After Fix

```
IncidentsController (prefix: 'incidents')         — unchanged
  POST   /incidents
  POST   /incidents/detection-rules
  GET    /incidents/detection-rules
  PUT    /incidents/detection-rules/:id
  DELETE /incidents/detection-rules/:id
  GET    /incidents/stats
  GET    /incidents
  GET    /incidents/:id
  PUT    /incidents/:id
  GET    /incidents/:id/notifications
  GET    /incidents/:id/impact

IncidentResponseAiController (prefix: 'incidents/:incidentId/ai')   — NEW PREFIX
  POST   /incidents/:incidentId/ai/classify
  POST   /incidents/:incidentId/ai/impact-analysis
  GET    /incidents/:incidentId/ai/impact
  POST   /incidents/:incidentId/ai/playbook
  GET    /incidents/:incidentId/ai/playbook
  POST   /incidents/:incidentId/ai/playbook/approve
  POST   /incidents/:incidentId/ai/contain
```

---

## 4. Event Pipeline Analysis

### Current State

- **Transport**: NATS JetStream, stream `PRIVACYOPS`, 7-day retention, 1M message limit
- **Published**: 57 unique event types from 31 services
- **Consumed**: 4 events via `EventTriggerService` + 1 via `ScanWorker` = 5 total (9%)
- **Orphaned**: 52 events (91%) — published into the void
- **DLQ**: None
- **Retry**: Only `msg.nak()` which redelivers indefinitely until 7-day expiry
- **Idempotency**: `correlationId` field exists but never populated or checked
- **Metrics**: None

### Consumed Events (current)

| Event | Consumer | Action |
|-------|----------|--------|
| `finding.created` (severity=critical) | EventTriggerService | → startRemediationWorkflow |
| `assessment.submitted` | EventTriggerService | → startDpiaApprovalWorkflow |
| `vendor.assessment.due` | EventTriggerService | → startVendorReviewWorkflow |
| `retention.policy.triggered` | EventTriggerService | → startDataDeletionWorkflow |
| `scan.queued` | ScanWorker | → discovery.executeScan() |

### Fix Strategy

Create a new `EventConsumerService` in `apps/api/src/core/events/event-consumers.service.ts` that subscribes to the highest-impact orphaned events and routes them to existing services/workflows. This extends the existing `EventTriggerService` pattern.

**Priority event consumers to implement (14 new subscriptions):**

| Event | Consumer Action | Justification |
|-------|----------------|---------------|
| `incident.breach_detected` | → `WorkflowService.startBreachWorkflow()` | Breach workflow exists but has no event trigger |
| `incident.reported` | → `NotificationsService.send()` | Critical incidents need immediate notification |
| `dsar.received` | → `WorkflowService.startDsarWorkflow()` | DSAR workflow exists but has no event trigger |
| `scan.completed` | → `DataGraphSyncService.syncAssets()` | Discovery results should flow into graph |
| `classification.completed` | → `DataGraphSyncService.syncAssets()` | Classification should update graph nodes |
| `risk.score.changed` | → `NotificationsService.send()` (if critical) | Risk changes above threshold need alerts |
| `remediation.proposed` | → `NotificationsService.send()` | Proposed remediations need reviewer notification |
| `remediation.completed` | → `DspmService.recalculateRisk()` | Completed remediation should trigger risk rescore |
| `consent.revoked` | → audit log + notification | Consent revocation has compliance implications |
| `security.unauthorized_access` | → `IncidentsService.create()` | Security events should auto-create incidents |
| `security.suspicious_activity` | → `NotificationsService.send()` | Security alerts need immediate notification |
| `compliance.score.changed` | → audit log | Compliance score changes need audit trail |
| `shadow-data.scan.completed` | → `DspmService.recalculateRisk()` | Shadow data affects risk posture |
| `connector.health_degraded` | → `NotificationsService.send()` | Degraded connectors need ops notification |

**Additional improvements:**

1. Add retry policy with exponential backoff (max 3 attempts, 1s/2s/4s) in `EventBusService.subscribe()`
2. Add DLQ stream (`PRIVACYOPS_DLQ`) for events that fail all retries
3. Add event consumption counter logging (event type + success/failure counts)

---

## 5. Connector Layer Analysis

### Current State

| Connector | Status | SDK Installed | Working Methods |
|-----------|--------|---------------|-----------------|
| AWS S3 | **REAL** | `@aws-sdk/client-s3` v3.500.0 | 7/8 (sampleContent is TODO) |
| PostgreSQL | **REAL CODE** | `pg` **NOT IN package.json** | 0/7 (runtime crash) |
| MySQL | STUB | `mysql2` not installed | 0/7 |
| MongoDB | STUB | `mongodb` not installed | 0/7 |
| Azure Blob | STUB | `@azure/storage-blob` not installed | 0/7 |
| GCP Storage | STUB | `@google-cloud/storage` not installed | 0/7 |
| Snowflake | STUB | `snowflake-sdk` not installed | 0/7 |

**Missing connector implementations (no code at all):** SQL Server, BigQuery, Okta, Azure AD, Salesforce, GitHub

### Connector SDK Contract

All connectors implement `IConnector`:
- `initialize(config)` — Set up credentials
- `testConnection()` — Verify connectivity
- `disconnect()` — Clean up
- `listAssets()` — AsyncGenerator yielding discovered assets
- `getAssetSchema(assetExternalId)` — Column/field definitions
- `sampleContent(assetExternalId, options)` — Data sampling
- `getMetadata()` — Connector capabilities
- `getAccessPolicies?(assetExternalId)` — Optional permissions

`BaseConnector` provides retry logic (3 retries, exponential backoff) and rate limiting (10 req/s, 20 burst).

### Fix Strategy

**Tier 1 — Fix broken existing connectors (2):**
1. **PostgreSQL**: Add `pg` and `@types/pg` to `apps/api/package.json`. The implementation code is already complete.
2. **MySQL**: Install `mysql2`, implement real connection/discovery/sampling using `mysql2/promise`. Convert from stub to real.

**Tier 2 — Implement highest-value new connectors (6):**
3. **SQL Server** — New file `mssql.connector.ts`, using `mssql` package. SQL Server is essential for enterprise deployments.
4. **BigQuery** — New file `bigquery.connector.ts`, using `@google-cloud/bigquery`. Critical for data lake scenarios.
5. **Snowflake** — Convert stub to real using `snowflake-sdk`. Major cloud data warehouse.
6. **MongoDB** — Convert stub to real using `mongodb` native driver. Key NoSQL connector.
7. **Azure Blob** — Convert stub to real using `@azure/storage-blob`. Enterprise cloud storage.
8. **GCP Storage** — Convert stub to real using `@google-cloud/storage`. Cloud storage parity.

**Each working connector will support:**
- Authentication (initialize + config)
- Health check (testConnection)
- Dataset/asset discovery (listAssets)
- Metadata extraction (getAssetSchema)
- Permission collection (getAccessPolicies) — where applicable
- Owner mapping — via access policies

**Note on Okta/Azure AD/Salesforce/GitHub:** These require significantly different connector patterns (identity providers vs data stores) and are lower priority. Recommend deferring to a follow-up phase.

### Connector Health Fix

Current `ConnectorHealthService` doesn't actually call `testConnection()` on connectors — it simulates health checks. Fix: wire health checks to call the actual connector's `testConnection()` method.

---

## 6. Workflow Orchestration Analysis

### Current State

**8 Temporal workflows defined:**

| Workflow | Task Queue | Trigger | Status |
|----------|-----------|---------|--------|
| scanWorkflow | scan-queue | ScanWorker (event) | Working |
| dsarWorkflow | dsar-queue | Manual only | No event trigger |
| breachNotificationWorkflow | breach-queue | Manual only | No event trigger |
| retentionDisposalWorkflow | retention-queue | EventTriggerService | Working |
| dpiaApprovalWorkflow | approval-queue | EventTriggerService | Working |
| remediationWorkflow | approval-queue | EventTriggerService (critical) | Working |
| vendorReviewWorkflow | vendor-queue | EventTriggerService | Working |
| dataDeletionWorkflow | retention-queue | EventTriggerService | Working |

**Missing:**
- **Cron/scheduled jobs**: Zero. No `@nestjs/schedule`, no `@Cron()`, no Bull/BullMQ. No scheduling library installed.
- **WebSocket/SSE**: Zero. No `@nestjs/websockets`, no `socket.io`, no `ws`. No realtime library installed.
- **Workflow status polling**: `getWorkflowStatus()` exists in `WorkflowService` but only exposed via direct service call, no controller endpoint.

### Fix Strategy

**A. Cron Scheduling (using `@nestjs/schedule`)**

Install `@nestjs/schedule` and create `ScheduledJobsService`:

| Cron Job | Schedule | Action |
|----------|----------|--------|
| Periodic access review | Weekly (Sunday 2AM) | Query stale access mappings, create review tasks |
| Stale data review | Daily (3AM) | Find assets not scanned in 30+ days, queue re-scan |
| Vendor reassessment reminders | Daily (9AM) | Find vendors with assessments due within 7 days, notify |
| Retention policy enforcement | Daily (1AM) | Find assets past retention period, trigger retention workflow |
| Breach SLA monitoring | Every 15 minutes | Check open breaches approaching notification deadlines |

**B. WebSocket Gateway (using `@nestjs/websockets` + `socket.io`)**

Create `WorkflowGateway` at `apps/api/src/core/workflow/workflow.gateway.ts`:
- Namespace: `/workflows`
- Events emitted: `workflow:started`, `workflow:progress`, `workflow:completed`, `workflow:failed`
- Auth: JWT token validation on connection
- Tenant isolation: Room-per-tenant (`tenant:{tenantId}`)
- Integration: WorkflowService emits events when workflows start/complete

**C. Workflow status controller endpoint**

Add `GET /workflows/:id/status` to expose `WorkflowService.getWorkflowStatus()` via REST.

---

## 7. Engine Integration Analysis

### Integration Chain Status

| Chain | Mechanism | Status |
|-------|-----------|--------|
| Discovery → Classification | Temporal scanWorkflow (activity chain) | **Working** — discoverAssets → classifyAsset → calculateRiskScore |
| Classification → Graph | None | **BROKEN** — classification.completed event published but not consumed; no call to DataGraphSyncService |
| Graph → Risk | Direct service call in graph-analytics | **Working** — computeRiskPropagation() reads EntityRiskProfile |
| Risk → Remediation | Event trigger (finding.created, critical) | **Working** — triggers remediationWorkflow |
| Shadow Detection → Risk | None | **BROKEN** — shadow-data.scan.completed event orphaned |
| Lineage → Risk | None | **BROKEN** — lineage.recorded event orphaned |
| Attack Path → Risk | None | **BROKEN** — attack.simulation.completed event orphaned |
| Breach → Workflow | None | **BROKEN** — incident.breach_detected event orphaned; breachWorkflow exists but no trigger |
| DSAR → Workflow | None | **BROKEN** — dsar.received event orphaned; dsarWorkflow exists but no trigger |

### Schema Heuristics Engine

**File**: `apps/api/src/modules/classification/engine/schema-heuristics.ts`

**Status**: DEAD CODE
- Class `SchemaHeuristicsEngine` with method `classifyByColumnName(name)`
- 44 regex patterns for column name matching (email, phone, SSN, DOB, etc.)
- Never imported anywhere in the codebase
- Never instantiated by any service
- `ClassificationService` uses `Classifier` (from `engine/classifier.ts`) instead, which does similar keyword matching + regex matching on sample values

**Decision**: WIRE IT into the classification pipeline. The Schema Heuristics engine adds value because:
1. It classifies by column NAME patterns (the `Classifier` does keyword matching but with tenant-defined patterns from DB)
2. It has 44 hardcoded sensitive data patterns that act as fallback detection
3. It runs independently of whether sample data is available

**Integration point**: In `ClassificationService.classifyAsset()`, after the main `Classifier.classify()` loop, run `SchemaHeuristicsEngine.classifyByColumnName()` for each field. If the heuristic finds a match and no classification exists yet (or confidence is higher), add it as a classification with method `'heuristic'`.

---

## 8. Graph Subsystem Analysis

### Storage Model

- **Nodes**: `DataGraphNode` table — `{id, tenantId, nodeType, entityId, label, metadata}`
- **Edges**: `DataGraphEdge` table — `{id, tenantId, sourceNodeId, targetNodeId, relationshipType, metadata, confidence}`
- **11 node types**: asset, dataset, column, identity, vendor, ai_system, processing_activity, retention_policy, risk_signal, attack_vector, control
- **10 edge types**: CONTAINS, STORED_IN, ACCESSIBLE_BY, OWNED_BY, SHARED_WITH, USED_BY_AI, GOVERNED_BY, EXPOSED_TO, TARGETS, CONTROLLED_BY_POLICY

### Current Indexes

**DataGraphNode:**
- `@@unique([tenantId, nodeType, entityId])` — Good
- `@@index([tenantId, nodeType])` — Good

**DataGraphEdge:**
- `@@index([tenantId])` — Single column only
- `@@index([sourceNodeId])` — Single column only
- `@@index([targetNodeId])` — Single column only
- `@@index([relationshipType])` — Single column only

### Performance Issues

1. **N+1 in `findPaths()`**: BFS loop queries edges per-node. Depth=5 can produce 30+ queries.
2. **N+1 in `computeRiskPropagation()`**: 3 queries per node (node data, EntityRiskProfile, edges).
3. **Repeated node loads in `getSubgraph()`**: Same node loaded multiple times via edge includes.
4. **Missing composite indexes**: Queries filter by `(tenantId, sourceNodeId)` and `(tenantId, targetNodeId)` but no composite index exists.

### Fix Strategy (Pragmatic, No Rewrite)

**A. Add missing composite indexes** (Prisma schema migration):

```
DataGraphEdge:
  @@index([tenantId, sourceNodeId])     — covers outgoing edge lookups per tenant
  @@index([tenantId, targetNodeId])     — covers incoming edge lookups per tenant
  @@index([sourceNodeId, targetNodeId, relationshipType])  — prevents duplicate edges
```

**B. Batch EntityRiskProfile lookups** in `computeRiskPropagation()`:
- Collect all entityIds in BFS frontier
- Single `findMany({ where: { entityId: { in: [...] } } })` instead of per-node lookups

**C. Preload edges in `findPaths()`**:
- Load all edges for the tenant in a single query at the start
- Build in-memory adjacency list
- Run BFS on in-memory structure (same pattern already used in `computeClusters()`)

---

## 9. Files To Modify

| # | File | Change |
|---|------|--------|
| 1 | `apps/api/src/modules/incidents/incident-response-ai.controller.ts` | Change `@Controller('incidents')` to `@Controller('incidents/:incidentId/ai')`, update `@Param('id')` to `@Param('incidentId')` |
| 2 | `apps/api/src/core/events/event-bus.service.ts` | Add retry policy (3 attempts, exponential backoff), DLQ stream creation, consumption counter |
| 3 | `apps/api/src/core/workflow/event-trigger.service.ts` | Add 10+ new event-to-action rules |
| 4 | `apps/api/src/modules/connectors/implementations/mysql.connector.ts` | Replace stub with real `mysql2/promise` implementation |
| 5 | `apps/api/src/modules/connectors/implementations/mongodb.connector.ts` | Replace stub with real `mongodb` driver implementation |
| 6 | `apps/api/src/modules/connectors/implementations/azure-blob.connector.ts` | Replace stub with real `@azure/storage-blob` implementation |
| 7 | `apps/api/src/modules/connectors/implementations/gcp-storage.connector.ts` | Replace stub with real `@google-cloud/storage` implementation |
| 8 | `apps/api/src/modules/connectors/implementations/snowflake.connector.ts` | Replace stub with real `snowflake-sdk` implementation |
| 9 | `apps/api/src/modules/observability/connector-health.service.ts` | Wire actual `testConnection()` calls |
| 10 | `apps/api/src/core/workflow/workflow.module.ts` | Register ScheduledJobsService, WorkflowGateway |
| 11 | `apps/api/src/modules/classification/classification.service.ts` | Integrate SchemaHeuristicsEngine into classify pipeline |
| 12 | `apps/api/src/modules/data-graph/data-graph.service.ts` | Optimize findPaths() and getSubgraph() with preloaded adjacency |
| 13 | `apps/api/src/modules/data-graph/graph-analytics.service.ts` | Batch EntityRiskProfile lookups in computeRiskPropagation() |
| 14 | `apps/api/prisma/schema.prisma` | Add composite indexes on DataGraphEdge |
| 15 | `apps/api/package.json` | Add missing dependencies |

---

## 10. New Files Needed

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/api/src/core/events/event-consumers.service.ts` | Central event consumer service with 14 subscriptions |
| 2 | `apps/api/src/core/workflow/scheduled-jobs.service.ts` | Cron job service for recurring reviews/enforcement |
| 3 | `apps/api/src/core/workflow/workflow.gateway.ts` | WebSocket gateway for realtime workflow status |
| 4 | `apps/api/src/modules/connectors/implementations/mssql.connector.ts` | SQL Server connector (new) |
| 5 | `apps/api/src/modules/connectors/implementations/bigquery.connector.ts` | BigQuery connector (new) |
| 6 | `apps/api/test/incidents-routing.e2e-spec.ts` | Route reachability test |
| 7 | `apps/api/test/event-consumers.e2e-spec.ts` | Event publish/consume flow tests |
| 8 | `apps/api/test/connectors.e2e-spec.ts` | Connector health check + discovery tests |
| 9 | `apps/api/prisma/migrations/YYYYMMDD_add_graph_indexes/migration.sql` | Graph index migration (auto-generated by prisma) |

---

## 11. Packages / Dependencies Missing

Add to `apps/api/package.json`:

| Package | Version | Purpose |
|---------|---------|---------|
| `pg` | `^8.13.0` | PostgreSQL connector driver |
| `@types/pg` | `^8.11.0` | TypeScript types for pg (devDep) |
| `mysql2` | `^3.11.0` | MySQL connector driver |
| `mongodb` | `^6.10.0` | MongoDB connector driver |
| `mssql` | `^11.0.0` | SQL Server connector driver |
| `@google-cloud/bigquery` | `^7.9.0` | BigQuery connector driver |
| `snowflake-sdk` | `^1.14.0` | Snowflake connector driver |
| `@azure/storage-blob` | `^12.25.0` | Azure Blob Storage connector driver |
| `@google-cloud/storage` | `^7.14.0` | Google Cloud Storage connector driver |
| `@nestjs/schedule` | `^4.1.0` | Cron job scheduling |
| `@nestjs/websockets` | `^10.4.0` | WebSocket support |
| `@nestjs/platform-socket.io` | `^10.4.0` | Socket.IO adapter for NestJS |
| `socket.io` | `^4.8.0` | WebSocket library |

---

## 12. DB Migration Impact

**Single migration required** — add composite indexes to `data_graph_edges`:

```sql
CREATE INDEX "data_graph_edges_tenant_id_source_node_id_idx"
  ON "data_graph_edges" ("tenant_id", "source_node_id");

CREATE INDEX "data_graph_edges_tenant_id_target_node_id_idx"
  ON "data_graph_edges" ("tenant_id", "target_node_id");

CREATE UNIQUE INDEX "data_graph_edges_source_target_rel_idx"
  ON "data_graph_edges" ("source_node_id", "target_node_id", "relationship_type");
```

**Risk**: LOW — additive indexes only, no schema changes, no data migration. Safe to run on production with concurrent connections. The unique index on `(source, target, relationship_type)` may fail if duplicates already exist; migration should include a dedup step first.

---

## 13. Backward Compatibility Concerns

| Change | Concern | Mitigation |
|--------|---------|------------|
| Incident AI controller prefix change | Route paths change from `/incidents/:id/ai-classify` to `/incidents/:id/ai/classify` | Previous routes were **unreachable** anyway (shadowed), so no existing client depends on them. No backward compat issue. |
| New event consumers | Existing event producers unchanged | Additive only — no risk |
| Connector stub replacements | Stub connectors returned empty arrays | New implementations return real data. Tests relying on empty results need update. |
| WebSocket addition | New capability, no existing WebSocket clients | Additive — no risk |
| Cron jobs | No existing scheduled jobs | Additive — no risk |
| Graph index migration | New indexes only | Additive — no risk |
| SchemaHeuristics integration | Classification results may include additional labels | Additive — more classifications returned, not fewer. Existing classifications unaffected. |

---

## 14. Recommended Fix Order

Execute in this order to maximize production-readiness improvement per step:

### Step 1: API Routing Fix (30 min)
- Change `IncidentResponseAiController` prefix
- Immediately unblocks 7 endpoints
- Zero risk, zero dependencies

### Step 2: Event Pipeline — Consumers + Reliability (4-6 hrs)
- Create `EventConsumerService` with 14 subscriptions
- Add retry policy + DLQ to `EventBusService`
- Add new trigger rules to `EventTriggerService` (breach → workflow, DSAR → workflow)
- This connects the existing publishing to existing services/workflows

### Step 3: Connector Fixes (8-12 hrs)
- Install `pg` (immediate fix for PostgreSQL connector)
- Implement MySQL, SQL Server, BigQuery, Snowflake, MongoDB, Azure Blob, GCP Storage
- Wire real health checks in `ConnectorHealthService`
- 8 genuinely working connectors after this step

### Step 4: Workflow Cron + WebSocket (4-6 hrs)
- Install `@nestjs/schedule`, `@nestjs/websockets`, `socket.io`
- Create `ScheduledJobsService` with 5 cron jobs
- Create `WorkflowGateway` for realtime status
- Add workflow status REST endpoint

### Step 5: Schema Heuristics Wiring (1-2 hrs)
- Import and instantiate `SchemaHeuristicsEngine` in `ClassificationService`
- Add heuristic classification pass after main classifier
- Dead code becomes live feature

### Step 6: Graph Subsystem Optimization (2-3 hrs)
- Add composite indexes (Prisma migration)
- Batch EntityRiskProfile lookups in `computeRiskPropagation()`
- Preload edges in `findPaths()` using in-memory adjacency list

### Step 7: Tests (3-4 hrs)
- Incident route reachability tests
- Event publish/consume flow tests
- Connector health check tests
- Scheduled workflow tests
- Graph query tests

### Step 8: Final Readiness Verification (1 hr)
- Run full test suite
- Verify all routes reachable
- Verify event consumption rate improved
- Verify connectors pass health checks

---

## 15. Risks / Assumptions

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NATS not available in dev/test environment | MEDIUM | Event consumers can't be tested | EventBusService already has console fallback; tests can mock EventBusService |
| Temporal not available in dev/test environment | MEDIUM | Workflow triggers can't be tested | WorkflowService already has `isConnected` guard; tests can mock |
| Connector SDKs require network access to external services | HIGH | Can't run connector integration tests without credentials | Use mock/testcontainer patterns for CI; document required env vars for integration testing |
| Snowflake SDK has native dependencies | MEDIUM | May fail to install on some platforms | Pin to version with pre-built binaries; document platform requirements |
| DLQ stream may accumulate messages without monitoring | MEDIUM | Unnoticed failures pile up | Add DLQ depth logging in scheduled jobs |
| Duplicate graph edges may exist (blocking unique index) | LOW | Migration fails | Add dedup query before creating unique index |
| WebSocket connections need JWT validation | LOW | Unauthenticated connections | Implement `handleConnection` with token validation |

### Assumptions

1. NATS JetStream is the sole event transport — no Redis, Kafka, or RabbitMQ
2. Temporal is the sole workflow engine — no Bull, Agenda, or custom queues
3. Prisma is the sole ORM — all migrations via `prisma migrate`
4. All connector credentials will be provided via `ConnectorConfig` interface
5. WebSocket auth will use the same JWT tokens as REST API
6. Cron jobs run in the API process (not separate workers) — acceptable for current scale
7. No multi-region deployment concerns for this phase
