# TechD PrivacyOps — Enterprise Upgrade Architecture Plan
## Data Security Intelligence Platform — Full Module Upgrade Specification

**Generated:** 2026-03-11
**Repository:** privacyops (NestJS + Next.js + Prisma + Temporal + NATS + OpenSearch)
**Branch:** claude/privacyops-scaffold-01V167DUhtLLKXVfpnQmbeP6

---

## REPOSITORY STATE SUMMARY

### Existing Infrastructure
| Layer | Technology | Status |
|-------|-----------|--------|
| API Framework | NestJS 10.x | Operational |
| Database ORM | Prisma (PostgreSQL) | 27 models defined |
| Workflow Engine | Temporal.io | 4 workflows (scan, dsar, breach, retention) |
| Event Bus | NATS JetStream | 35 event types defined |
| Search | OpenSearch | Basic index/search/delete |
| Auth | JWT + OIDC + SAML + MFA | Complete |
| Frontend | Next.js 14 + React Query + Tailwind | 15 pages |
| Shared Types | packages/shared-types | Enums + event types |

### Existing Modules (15 feature modules, 15 core modules)
- **Core:** Auth, RBAC, ABAC, Audit (chain-hashed), Crypto, Events, Search, Tenant, Workflow, Notifications, SCIM, Health, Security Events, Prisma, Approval
- **Feature:** Connectors (2 implementations), Discovery, Classification, DSPM, Consent, DSAR, Incidents, Retention, RoPA, Vendors, Assessments, Compliance, Dashboard, Users

### Connector Registry
- Implemented: `aws_s3`, `postgresql`
- Type definitions exist for: `mysql`, `mongodb`, `azure_blob`, `gcp_storage`, `snowflake`, `bigquery`, `google_drive`, `onedrive`, `sharepoint`, `salesforce`, `github`, `slack`, `m365`

---

## MODULE 1: WORKFLOW ENGINE UPGRADE

### Existing Implementation
- `core/workflow/workflow.service.ts` — 4 workflow starters (scan, dsar, breach, retention)
- `core/workflow/temporal.client.ts` — Temporal client wrapper
- 4 workflow definitions: `scan`, `dsar`, `breach`, `retention`
- 4 activity files with stub implementations
- 5 task queues defined
- `Workflow` model in Prisma with `temporalWorkflowId` tracking

### Upgrade Architecture
Add structured task management, DPIA approval workflows, remediation approval workflows, vendor review workflows, data deletion approval workflows, and event-driven triggers.

### Schema Changes
```
NEW MODEL: WorkflowTask
  id              UUID PK
  tenantId        UUID
  workflowId      UUID FK → Workflow
  taskType        VARCHAR(50)  // review, approve, execute, notify, verify
  title           VARCHAR(500)
  description     TEXT
  ownerId         UUID FK → User
  assigneeId      UUID?
  priority        VARCHAR(20)  // critical, high, medium, low
  status          VARCHAR(50)  // pending, in_progress, completed, blocked, skipped
  dueDate         TIMESTAMP?
  completedAt     TIMESTAMP?
  auditEvidence   JSON?        // Links to evidence artifacts
  metadata        JSON?
  dependsOnTaskId UUID?        // Task dependency chain
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

MODIFY MODEL: Workflow
  ADD FIELD: triggerType    VARCHAR(50)  // manual, event, schedule, threshold
  ADD FIELD: triggerConfig  JSON?        // Event filter / schedule config
  ADD FIELD: priority       VARCHAR(20)
  ADD FIELD: assigneeId     UUID?
```

### New Workflow Definitions
- `dpiaApprovalWorkflow` — Multi-stage DPIA review with escalation
- `remediationApprovalWorkflow` — Remediation action with rollback support
- `vendorReviewWorkflow` — Vendor assessment with SLA tracking
- `dataDeletionApprovalWorkflow` — Multi-approver deletion with legal hold check

### Event Triggers to Add
| Event | Trigger |
|-------|---------|
| `finding.created` (severity=critical) | → remediationApprovalWorkflow |
| `dsar.received` | → dsarWorkflow (exists) |
| `incident.reported` | → breachNotificationWorkflow (exists) |
| `shadow_data.detected` | → remediationApprovalWorkflow |
| `attack_path.detected` | → remediationApprovalWorkflow |
| `assessment.submitted` | → dpiaApprovalWorkflow |
| `vendor.assessment.due` | → vendorReviewWorkflow |
| `retention.policy.triggered` | → dataDeletionApprovalWorkflow |

### Services to Extend
- `WorkflowService` — Add starters for new workflows, task management methods
- `EventBusService` — Add event-trigger subscription registration

### APIs to Extend
- `GET /workflows/:id/tasks` — List tasks for a workflow
- `PATCH /workflows/:id/tasks/:taskId` — Update task status
- `POST /workflows/trigger` — Manual trigger with event payload

### Files to Modify
- `apps/api/src/core/workflow/workflow.service.ts`
- `apps/api/src/core/workflow/workflow.module.ts`
- `apps/api/prisma/schema.prisma`
- `packages/shared-types/src/events.ts`

### New Files
- `apps/api/src/core/workflow/workflows/dpia-approval.workflow.ts`
- `apps/api/src/core/workflow/workflows/remediation.workflow.ts`
- `apps/api/src/core/workflow/workflows/vendor-review.workflow.ts`
- `apps/api/src/core/workflow/workflows/data-deletion.workflow.ts`
- `apps/api/src/core/workflow/activities/approval.activities.ts`
- `apps/api/src/core/workflow/activities/vendor.activities.ts`
- `apps/api/src/core/workflow/event-trigger.service.ts`

### Migration Impact
- New table: `workflow_tasks` — No data migration needed
- Existing `workflows` table gets 3 new nullable columns — Backward compatible

---

## MODULE 2: DISCOVERY ENGINE UPGRADE

### Existing Implementation
- `modules/discovery/discovery.service.ts` — 251 lines
- Methods: `startScan`, `executeScan`, `findAllScans`, `findAllAssets`, `findAssetById`
- Uses `ConnectorRegistry` to delegate discovery to connector implementations
- `Asset` model captures: name, type, path, schema, size, rowCount, owner, tags
- `ScanJob` model tracks scan status and stats

### Upgrade Architecture
Extend discovery to support unstructured file storage, SaaS platforms, shadow dataset signals, AI dataset detection. Add richer metadata collection including permissions and activity.

### Schema Changes
```
MODIFY MODEL: Asset
  ADD FIELD: ownerEmail         VARCHAR(255)?
  ADD FIELD: lastAccessedAt     TIMESTAMP?
  ADD FIELD: lastModifiedBy     VARCHAR(255)?
  ADD FIELD: accessPermissions  JSON?        // [{principal, type, permissions}]
  ADD FIELD: activityMetadata   JSON?        // {readCount, writeCount, lastAccess}
  ADD FIELD: storageLocation    VARCHAR(500)? // region/zone/cluster
  ADD FIELD: encryptionStatus   VARCHAR(50)? // encrypted, unencrypted, unknown
  ADD FIELD: isShadowData       BOOLEAN DEFAULT false
  ADD FIELD: isAiDataset        BOOLEAN DEFAULT false
  ADD FIELD: fingerprint        VARCHAR(128)? // Content hash for deduplication
  ADD FIELD: discoverySource    VARCHAR(50)?  // connector, manual, inference

MODIFY MODEL: ScanJob
  ADD FIELD: scanScope    JSON?   // {includePatterns, excludePatterns, depth}
  ADD FIELD: discoveryMode VARCHAR(50)? // full, incremental, targeted, shadow
```

### Services to Extend
- `DiscoveryService` — Add `discoverShadowData()`, `discoverAiDatasets()`, `enrichAssetMetadata()`, `detectDuplicates()`
- `ConnectorRegistry` — Add capability check for `supportsAccessAnalysis`

### APIs to Extend
- `GET /discovery/assets` — Add filters: `isShadowData`, `isAiDataset`, `encryptionStatus`
- `POST /discovery/scans` — Add `discoveryMode` and `scanScope` to StartScanDto
- `GET /discovery/shadow-data` — New endpoint for shadow data summary
- `GET /discovery/ai-datasets` — New endpoint for AI dataset inventory

### Files to Modify
- `apps/api/src/modules/discovery/discovery.service.ts`
- `apps/api/src/modules/discovery/discovery.controller.ts`
- `apps/api/src/modules/discovery/dto/discovery.dto.ts`
- `apps/api/prisma/schema.prisma`

### New Files
- `apps/api/src/modules/discovery/shadow-data.service.ts`
- `apps/api/src/modules/discovery/ai-dataset.service.ts`

### Migration Impact
- Asset table gets ~10 new nullable columns — Backward compatible, no data migration

---

## MODULE 3: CLASSIFICATION ENGINE UPGRADE

### Existing Implementation
- `modules/classification/classification.service.ts` — 376 lines
- `modules/classification/engine/classifier.ts` — 161 lines
- Detection methods: regex, dictionary, context (keyword+regex boost)
- Toxic combination detection for PII+PFI, PHI+identity, Aadhaar+PFI, Creds+PII
- Labels model: category (pii/pfi/phi/sensitive/public), sensitivityLevel (1-5), detectionPatterns

### Upgrade Architecture
Extend classifier to detect credentials, biometrics, government identifiers, AI training datasets. Add ML-based classification, schema heuristic engine.

### Schema Changes
```
MODIFY MODEL: ClassificationLabel
  ADD FIELD: mlModelId       VARCHAR(100)?  // Reference to ML model for this label
  ADD FIELD: schemaHeuristics JSON?         // {tableNamePatterns, columnNamePatterns, dataTypeHints}

MODIFY MODEL: Classification
  ADD FIELD: modelVersion    VARCHAR(50)?   // ML model version used
  ADD FIELD: evidence        JSON?          // {sampleMatches, regexPattern, mlScore}

NEW ENUM values for ClassificationCategory:
  CREDENTIALS = 'credentials'
  BIOMETRIC = 'biometric'
  GOVERNMENT_ID = 'government_id'
  AI_TRAINING = 'ai_training'
```

### Services to Extend
- `Classifier` — Add `classifyBySchemaHeuristics()`, integrate ML model scoring via HTTP
- `ClassificationService` — Add `bulkClassify()`, `getClassificationCoverage()`

### APIs to Extend
- `POST /classification/bulk-classify` — Classify multiple assets in one call
- `GET /classification/coverage` — Coverage stats (% assets classified)
- `GET /classification/toxic-combinations` — List all toxic combinations across tenant

### Files to Modify
- `apps/api/src/modules/classification/engine/classifier.ts`
- `apps/api/src/modules/classification/classification.service.ts`
- `apps/api/src/modules/classification/classification.controller.ts`
- `apps/api/src/modules/classification/dto/classification.dto.ts`
- `packages/shared-types/src/enums.ts`

### New Files
- `apps/api/src/modules/classification/engine/schema-heuristics.ts`
- `apps/api/src/modules/classification/engine/ml-classifier.client.ts`

### Migration Impact
- 2 new nullable columns on existing tables — Backward compatible

---

## MODULE 4: CONNECTOR SDK EXPANSION

### Existing Implementation
- `IConnector` interface with 7 methods (initialize, test, disconnect, listAssets, getSchema, sampleContent, getAccessPolicies)
- `ConnectorRegistry` with factory pattern
- 2 implementations: `AwsS3Connector` (211 lines), `PostgresConnector` (227 lines)
- `ConnectorConfig`, `ConnectorCapabilities`, `ConnectorMetadata` types
- 18 `DataSourceType` values defined

### Upgrade Architecture
Add base connector class with auth, retry, rate limiting, pagination. Implement connectors for top-priority categories.

### Schema Changes
```
MODIFY MODEL: DataSource
  ADD FIELD: rateLimitConfig  JSON?  // {maxRequestsPerSecond, burstLimit}
  ADD FIELD: retryConfig      JSON?  // {maxRetries, backoffMs}
  ADD FIELD: lastHealthCheck  TIMESTAMP?
  ADD FIELD: healthStatus     VARCHAR(50)?  // healthy, degraded, unhealthy
```

### New Files — Connector SDK
- `apps/api/src/modules/connectors/sdk/base-connector.ts` — Abstract class with retry, rate-limit, pagination, error handling, schema normalization
- `apps/api/src/modules/connectors/sdk/auth/oauth2.auth.ts`
- `apps/api/src/modules/connectors/sdk/auth/api-key.auth.ts`
- `apps/api/src/modules/connectors/sdk/auth/iam-role.auth.ts`

### New Files — Connector Implementations (Priority Order)
**Phase 1 (Cloud Storage):**
- `implementations/azure-blob.connector.ts`
- `implementations/gcp-storage.connector.ts`

**Phase 2 (Databases):**
- `implementations/mysql.connector.ts`
- `implementations/mongodb.connector.ts`
- `implementations/snowflake.connector.ts`

**Phase 3 (SaaS):**
- `implementations/salesforce.connector.ts`
- `implementations/google-drive.connector.ts`
- `implementations/onedrive.connector.ts`

**Phase 4 (DevOps/Identity):**
- `implementations/github.connector.ts`
- `implementations/okta.connector.ts`

### Services to Extend
- `ConnectorRegistry` — Auto-register all implementations
- `ConnectorsService` — Add health check scheduling, batch test

### APIs to Extend
- `POST /connectors/:id/health` — Trigger health check
- `GET /connectors/health` — Health summary of all connectors

### Files to Modify
- `apps/api/src/modules/connectors/connector-registry.ts`
- `apps/api/src/modules/connectors/connectors.service.ts`
- `apps/api/src/modules/connectors/connectors.controller.ts`
- `apps/api/src/modules/connectors/interfaces/connector.interface.ts`

### Migration Impact
- 4 new nullable columns on `data_sources` — Backward compatible

---

## MODULE 5: DSPM DATA GRAPH

### Existing Implementation
- No graph model exists
- `DspmService.getDataMap()` returns a flat JSON structure of assets + sources
- Relationships are implicit through FK references (Asset→DataSource, Classification→Asset)

### Upgrade Architecture
Introduce a data graph model stored in PostgreSQL (not a separate graph DB) using a nodes/edges pattern. The graph connects assets, datasets, columns, identities, vendors, AI systems, processing activities, and retention policies.

### Schema Changes
```
NEW MODEL: DataGraphNode
  id           UUID PK
  tenantId     UUID
  nodeType     VARCHAR(50)  // asset, dataset, column, identity, vendor, ai_system, processing_activity, retention_policy
  entityId     UUID         // FK to the actual entity
  label        VARCHAR(500)
  metadata     JSON?
  createdAt    TIMESTAMP
  updatedAt    TIMESTAMP

  @@unique([tenantId, nodeType, entityId])
  @@index([tenantId, nodeType])

NEW MODEL: DataGraphEdge
  id               UUID PK
  tenantId         UUID
  sourceNodeId     UUID FK → DataGraphNode
  targetNodeId     UUID FK → DataGraphNode
  relationshipType VARCHAR(50) // CONTAINS, STORED_IN, ACCESSIBLE_BY, OWNED_BY, SHARED_WITH, USED_BY_AI, GOVERNED_BY
  metadata         JSON?
  confidence       DECIMAL(3,2)?
  discoveredAt     TIMESTAMP
  createdAt        TIMESTAMP

  @@index([tenantId])
  @@index([sourceNodeId])
  @@index([targetNodeId])
  @@index([relationshipType])
```

### New Services
- `DataGraphService` — CRUD for nodes/edges, traversal queries, path finding
- `DataGraphSyncService` — Syncs entities from existing models into graph nodes/edges

### APIs
- `GET /data-graph/nodes` — Query nodes by type, label search
- `GET /data-graph/nodes/:id/neighbors` — Get connected nodes (1 hop)
- `GET /data-graph/paths` — Find paths between two nodes
- `GET /data-graph/subgraph` — Get subgraph for an entity
- `POST /data-graph/sync` — Trigger full graph sync from existing data

### New Files
- `apps/api/src/modules/data-graph/data-graph.module.ts`
- `apps/api/src/modules/data-graph/data-graph.service.ts`
- `apps/api/src/modules/data-graph/data-graph-sync.service.ts`
- `apps/api/src/modules/data-graph/data-graph.controller.ts`
- `apps/api/src/modules/data-graph/dto/data-graph.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts` — Register DataGraphModule
- `apps/api/prisma/schema.prisma`
- `packages/shared-types/src/enums.ts`

### Migration Impact
- 2 new tables — No impact on existing data
- Graph sync will populate from existing assets, users, vendors

---

## MODULE 6: RISK SCORING ENGINE UPGRADE

### Existing Implementation
- `modules/dspm/engine/risk-scorer.ts` — 129 lines
- Inputs: sensitivityLevel, publicAccess, crossAccountAccess, principalCount, encryption, MFA, rowCount, stale, retentionPolicy
- Formula: `Sensitivity × Exposure × Access × Volume`
- Output: score (0-100), severity, breakdown, factors

### Upgrade Architecture
Extend with vendor exposure, AI usage, identity access breadth, retention violations, security misconfiguration scoring. Add composite risk for multi-asset entities.

### Schema Changes
```
MODIFY MODEL: RiskFinding
  ADD FIELD: riskBreakdown     JSON?  // Full scoring breakdown
  ADD FIELD: linkedGraphNodeId UUID?  // Link to data graph node
  ADD FIELD: autoRemediation   JSON?  // Suggested remediation actions

NEW MODEL: EntityRiskProfile
  id           UUID PK
  tenantId     UUID
  entityType   VARCHAR(50)  // asset, vendor, identity, ai_system
  entityId     UUID
  compositeScore  DECIMAL(5,2)
  scoreBreakdown  JSON
  riskFactors     JSON
  lastCalculated  TIMESTAMP
  trend           VARCHAR(20)  // increasing, stable, decreasing
  createdAt    TIMESTAMP
  updatedAt    TIMESTAMP

  @@unique([tenantId, entityType, entityId])
```

### Services to Extend
- `RiskScorer` — Add `vendorExposureScore()`, `aiUsageScore()`, `identityAccessScore()`, `retentionViolationScore()`, `securityMisconfigScore()`
- `DspmService` — Add `calculateEntityRisk()`, `getRiskTrends()`

### APIs to Extend
- `GET /dspm/risk-profiles` — Entity-level risk profiles
- `GET /dspm/risk-trends` — Risk score trends over time
- `POST /dspm/risk/recalculate-all` — Bulk recalculation

### Files to Modify
- `apps/api/src/modules/dspm/engine/risk-scorer.ts`
- `apps/api/src/modules/dspm/dspm.service.ts`
- `apps/api/src/modules/dspm/dspm.controller.ts`
- `apps/api/prisma/schema.prisma`

### Migration Impact
- 2 new nullable columns on `risk_findings` — Backward compatible
- 1 new table `entity_risk_profiles`

---

## MODULE 7: AUTOMATED REMEDIATION ENGINE

### Existing Implementation
- No remediation engine exists
- `ApprovalRequest` model exists for gated operations
- `ApprovalService` exists in `core/auth/services/approval.service.ts`
- Workflow engine supports approval workflows

### Upgrade Architecture
Create a remediation engine that defines, executes, and tracks remediation actions with approval workflows, rollback support, and audit evidence.

### Schema Changes
```
NEW MODEL: RemediationAction
  id              UUID PK
  tenantId        UUID
  findingId       UUID FK → RiskFinding
  actionType      VARCHAR(50)  // remove_public_access, revoke_permissions, apply_retention, quarantine, trigger_review
  status          VARCHAR(50)  // proposed, pending_approval, approved, executing, completed, failed, rolled_back
  approvalId      UUID? FK → ApprovalRequest
  executedBy      UUID?
  executedAt      TIMESTAMP?
  rollbackData    JSON?        // State before remediation for rollback
  result          JSON?        // Execution result
  validationResult JSON?       // Post-execution validation
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([findingId])
  @@index([status])
```

### New Services
- `RemediationService` — Propose, approve, execute, validate, rollback
- `RemediationExecutor` — Connector-aware execution (calls connectors to apply changes)

### APIs
- `POST /remediation/propose` — Propose action for a finding
- `POST /remediation/:id/approve` — Approve action
- `POST /remediation/:id/execute` — Execute action
- `POST /remediation/:id/rollback` — Rollback action
- `GET /remediation` — List actions with filters
- `GET /remediation/:id` — Get action details with audit trail

### New Files
- `apps/api/src/modules/remediation/remediation.module.ts`
- `apps/api/src/modules/remediation/remediation.service.ts`
- `apps/api/src/modules/remediation/remediation-executor.service.ts`
- `apps/api/src/modules/remediation/remediation.controller.ts`
- `apps/api/src/modules/remediation/dto/remediation.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`
- `packages/shared-types/src/events.ts` — Add remediation events

### Migration Impact
- 1 new table — No impact on existing data

---

## MODULE 8: IDENTITY-TO-DATA ACCESS INTELLIGENCE

### Existing Implementation
- `User` model with roles and permissions
- `AccessPolicy` interface in connector (principal, principalType, permissions)
- No identity-to-data access mapping stored

### Upgrade Architecture
Map identities (users, service accounts, vendors) to the datasets they can access. Detect anomalies like inactive users with access, excessive permissions, vendor access, service account abuse, public sharing.

### Schema Changes
```
NEW MODEL: IdentityAccessMapping
  id              UUID PK
  tenantId        UUID
  identityType    VARCHAR(50)  // user, service_account, vendor, group, public
  identityId      VARCHAR(500) // External identity reference
  identityName    VARCHAR(500)
  assetId         UUID FK → Asset
  permissionLevel VARCHAR(50)  // read, write, admin, owner
  accessSource    VARCHAR(100) // iam_policy, bucket_acl, db_grant, share_link
  isExcessive     BOOLEAN DEFAULT false
  isInactive      BOOLEAN DEFAULT false  // Identity hasn't accessed data in 90+ days
  lastAccessedAt  TIMESTAMP?
  discoveredAt    TIMESTAMP
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([assetId])
  @@index([identityType])
  @@index([isExcessive])
  @@index([isInactive])
```

### New Services
- `IdentityAccessService` — Build identity→data mappings, detect anomalies
- `AccessAnalyzer` — Analyze excessive permissions, inactive access, public sharing

### APIs
- `GET /identity-access/mappings` — List identity-to-data mappings
- `GET /identity-access/anomalies` — List detected access anomalies
- `GET /identity-access/identities/:id/data-access` — What data can this identity access?
- `GET /identity-access/assets/:id/identities` — Who can access this asset?
- `GET /identity-access/stats` — Access intelligence summary

### New Files
- `apps/api/src/modules/identity-access/identity-access.module.ts`
- `apps/api/src/modules/identity-access/identity-access.service.ts`
- `apps/api/src/modules/identity-access/access-analyzer.ts`
- `apps/api/src/modules/identity-access/identity-access.controller.ts`
- `apps/api/src/modules/identity-access/dto/identity-access.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

### Migration Impact
- 1 new table — No impact on existing data

---

## MODULE 9: SHADOW DATA DETECTION

### Existing Implementation
- `Asset` model with discovery metadata
- No shadow data detection logic
- No fingerprinting or duplicate detection

### Upgrade Architecture
Detect duplicate sensitive datasets, orphaned files, stale exports, shadow SaaS storage, backup copies, AI sandbox datasets. Uses signals from discovery, classification, data graph, and content fingerprinting.

### Schema Changes
```
Uses Asset model (extended in Module 2):
  - isShadowData
  - fingerprint
  - discoverySource

NEW MODEL: ShadowDataAlert
  id              UUID PK
  tenantId        UUID
  alertType       VARCHAR(50)  // duplicate, orphaned, stale_export, shadow_saas, backup_copy, ai_sandbox
  assetId         UUID FK → Asset
  relatedAssetId  UUID?        // For duplicates, the original asset
  severity        VARCHAR(20)
  description     TEXT
  evidence        JSON
  status          VARCHAR(50)  // open, investigating, resolved, false_positive
  resolvedAt      TIMESTAMP?
  resolvedBy      UUID?
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([alertType])
  @@index([status])
```

### New Services
- `ShadowDataService` — Detection orchestrator
- `FingerprintService` — Content-based fingerprinting for duplicate detection
- `OwnershipInferenceService` — Infer dataset ownership from access patterns

### APIs
- `GET /shadow-data/alerts` — List shadow data alerts
- `GET /shadow-data/alerts/:id` — Alert details
- `PATCH /shadow-data/alerts/:id/status` — Update alert status
- `GET /shadow-data/stats` — Shadow data statistics
- `POST /shadow-data/scan` — Trigger shadow data detection scan

### New Files
- `apps/api/src/modules/shadow-data/shadow-data.module.ts`
- `apps/api/src/modules/shadow-data/shadow-data.service.ts`
- `apps/api/src/modules/shadow-data/fingerprint.service.ts`
- `apps/api/src/modules/shadow-data/ownership-inference.service.ts`
- `apps/api/src/modules/shadow-data/shadow-data.controller.ts`
- `apps/api/src/modules/shadow-data/dto/shadow-data.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 10: SENSITIVE DATA LINEAGE & PROPAGATION

### Existing Implementation
- No lineage tracking exists
- Data graph (Module 5) will provide relationship infrastructure

### Upgrade Architecture
Track how sensitive data propagates from origin to downstream datasets, vendors, and AI systems. Enable breach impact analysis.

### Schema Changes
```
NEW MODEL: DataLineageRecord
  id              UUID PK
  tenantId        UUID
  sourceAssetId   UUID FK → Asset
  targetAssetId   UUID FK → Asset
  transformType   VARCHAR(50)  // copy, etl, export, share, api_sync, backup, ai_training
  dataCategories  JSON         // What data types flow through this link
  isActive        BOOLEAN DEFAULT true
  discoveredAt    TIMESTAMP
  lastObservedAt  TIMESTAMP?
  metadata        JSON?
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([sourceAssetId])
  @@index([targetAssetId])
  @@index([transformType])
```

### New Services
- `DataLineageService` — Build and query lineage graphs
- `BreachImpactAnalyzer` — Given a breached asset, trace all downstream impact

### APIs
- `GET /lineage/asset/:assetId/upstream` — Trace data origins
- `GET /lineage/asset/:assetId/downstream` — Trace data destinations
- `GET /lineage/asset/:assetId/full` — Full lineage graph
- `GET /lineage/breach-impact/:assetId` — Breach impact analysis
- `POST /lineage/record` — Manually record a lineage link

### New Files
- `apps/api/src/modules/lineage/lineage.module.ts`
- `apps/api/src/modules/lineage/lineage.service.ts`
- `apps/api/src/modules/lineage/breach-impact-analyzer.ts`
- `apps/api/src/modules/lineage/lineage.controller.ts`
- `apps/api/src/modules/lineage/dto/lineage.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 11: DATA EXPOSURE & ATTACK PATH ANALYSIS

### Existing Implementation
- Risk scoring considers publicAccess and crossAccountAccess
- No attack path modeling

### Upgrade Architecture
Model attack paths from external identities through misconfigured assets to sensitive data. Generate scored attack path alerts.

### Schema Changes
```
NEW MODEL: AttackPath
  id              UUID PK
  tenantId        UUID
  title           VARCHAR(500)
  severity        VARCHAR(20)
  score           DECIMAL(5,2)
  pathNodes       JSON   // Ordered array of {nodeType, nodeId, label, vulnerability}
  entryPoint      JSON   // {type, identifier, description}
  targetAsset     UUID FK → Asset
  targetDataTypes JSON   // What sensitive data is reachable
  status          VARCHAR(50)  // active, mitigated, false_positive
  mitigatedAt     TIMESTAMP?
  mitigatedBy     UUID?
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([severity])
  @@index([status])
```

### New Services
- `AttackPathService` — Discovery, analysis, scoring
- `AttackPathAnalyzer` — Path construction from identity→asset→data graph

### APIs
- `GET /attack-paths` — List attack paths with filters
- `GET /attack-paths/:id` — Attack path details
- `PATCH /attack-paths/:id/status` — Update status
- `GET /attack-paths/stats` — Summary statistics
- `POST /attack-paths/analyze` — Trigger analysis

### New Files
- `apps/api/src/modules/attack-paths/attack-paths.module.ts`
- `apps/api/src/modules/attack-paths/attack-paths.service.ts`
- `apps/api/src/modules/attack-paths/attack-path-analyzer.ts`
- `apps/api/src/modules/attack-paths/attack-paths.controller.ts`
- `apps/api/src/modules/attack-paths/dto/attack-path.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 12: CONSENT MANAGEMENT UPGRADE

### Existing Implementation
- `ConsentService` — 492 lines with full CRUD for notices, purposes, records, revocation, stats
- Models: `ProcessingPurpose`, `ConsentNotice`, `DataSubject`, `ConsentRecord`
- Records channel, IP, userAgent, proof, lawfulBasis
- Already comprehensive

### Upgrade Architecture
Add consent integration with DSAR, retention, and processing registry. Add consent preference center API, version-aware consent tracking, jurisdiction-aware defaults.

### Schema Changes
```
MODIFY MODEL: ConsentRecord
  ADD FIELD: linkedDsarId     UUID?   // DSAR that triggered revocation
  ADD FIELD: linkedRopaId     UUID?   // Processing activity this consent covers
  ADD FIELD: jurisdiction     VARCHAR(50)?  // Data subject's jurisdiction

MODIFY MODEL: ProcessingPurpose
  ADD FIELD: linkedRopaId     UUID?   // Link to RoPA entry
  ADD FIELD: retentionDays    INT?    // Retention period for data under this purpose
  ADD FIELD: jurisdictions    JSON?   // Applicable jurisdictions
```

### Services to Extend
- `ConsentService` — Add `getPreferenceCenter()`, `getConsentByJurisdiction()`, `linkToRopa()`, `getConsentTimeline()`

### APIs to Extend
- `GET /consent/preference-center/:dataSubjectId` — Full consent state for a data subject
- `GET /consent/jurisdictions` — Consent stats by jurisdiction
- `POST /consent/link-ropa` — Link consent purpose to RoPA entry

### Files to Modify
- `apps/api/src/modules/consent/consent.service.ts`
- `apps/api/src/modules/consent/consent.controller.ts`
- `apps/api/src/modules/consent/dto/consent.dto.ts`
- `apps/api/prisma/schema.prisma`

### Migration Impact
- 5 new nullable columns across 2 tables — Backward compatible

---

## MODULE 13: DSAR AUTOMATION UPGRADE

### Existing Implementation
- `DsarService` — 492 lines with full CRUD, status management, assignment, timeline, stats
- Temporal `dsarWorkflow` with 5 activities: verify, collect, generate, notifyComplete, notifyOverdue
- SLA tracking with due date monitoring

### Upgrade Architecture
Add cross-system data discovery using data graph, lineage-based search, automated response generation, data deletion verification.

### Schema Changes
```
MODIFY MODEL: DsarRequest
  ADD FIELD: discoveredDataSources JSON?  // [{sourceId, assetCount, status}]
  ADD FIELD: responseMetadata      JSON?  // {packageSize, formatType, generatedAt}
  ADD FIELD: deletionVerification  JSON?  // {verified, verifiedAt, verifiedBy, evidence}
  ADD FIELD: automationLevel       VARCHAR(50)?  // manual, semi_auto, full_auto
```

### Services to Extend
- `DsarService` — Add `discoverSubjectData()`, `generateResponsePackage()`, `verifyDeletion()`
- DSAR activities — Implement actual data collection using ConnectorRegistry

### APIs to Extend
- `POST /dsar/requests/:id/discover` — Trigger cross-system discovery for a DSAR
- `GET /dsar/requests/:id/discovered-data` — View discovered data summary
- `POST /dsar/requests/:id/generate-response` — Generate response package
- `POST /dsar/requests/:id/verify-deletion` — Verify deletion completion

### Files to Modify
- `apps/api/src/modules/dsar/dsar.service.ts`
- `apps/api/src/modules/dsar/dsar.controller.ts`
- `apps/api/src/modules/dsar/dto/dsar.dto.ts`
- `apps/api/src/core/workflow/activities/dsar.activities.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 14: DPIA / PRIVACY RISK UPGRADE

### Existing Implementation
- `AssessmentsService` — 276 lines with CRUD, stats
- `PrivacyAssessment` model with riskItems, overallRiskScore, linkedRopaId, evidenceIds

### Upgrade Architecture
Add automated DPIA triggers, privacy risk scoring engine, processing activity linkage, multi-stage approval workflows.

### Schema Changes
```
MODIFY MODEL: PrivacyAssessment
  ADD FIELD: triggerType        VARCHAR(50)?   // manual, automated, regulatory
  ADD FIELD: triggerReason      TEXT?
  ADD FIELD: linkedVendorId     UUID?
  ADD FIELD: linkedConsentIds   JSON?
  ADD FIELD: approvalWorkflowId UUID?
  ADD FIELD: privacyRiskScore   JSON?          // Structured privacy-specific risk breakdown

NEW MODEL: DpiaTriggerRule
  id              UUID PK
  tenantId        UUID
  name            VARCHAR(255)
  condition       JSON    // {field, operator, value} rules
  isActive        BOOLEAN DEFAULT true
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP
```

### Services to Extend
- `AssessmentsService` — Add `checkTriggers()`, `calculatePrivacyRisk()`, `linkToProcessing()`

### APIs to Extend
- `POST /assessments/check-triggers` — Evaluate DPIA trigger rules
- `GET /assessments/:id/privacy-risk` — Detailed privacy risk breakdown
- `POST /assessments/trigger-rules` — CRUD for trigger rules
- `GET /assessments/trigger-rules` — List trigger rules

### Files to Modify
- `apps/api/src/modules/assessments/assessments.service.ts`
- `apps/api/src/modules/assessments/assessments.controller.ts`
- `apps/api/src/modules/assessments/dto/assessment.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 15: RETENTION GOVERNANCE UPGRADE

### Existing Implementation
- `RetentionService` — 258 lines with CRUD, disposal trigger
- `RetentionPolicy` model with period, action, legal basis, regulations
- Temporal `retentionDisposalWorkflow` with activities

### Upgrade Architecture
Ensure every dataset has a retention policy. Add retention violation detection, automated archival workflows, disposition certificates.

### Schema Changes
```
MODIFY MODEL: RetentionPolicy
  ADD FIELD: appliedAssetCount  INT DEFAULT 0
  ADD FIELD: lastEnforcedAt     TIMESTAMP?
  ADD FIELD: nextEnforcementAt  TIMESTAMP?

NEW MODEL: RetentionViolation
  id              UUID PK
  tenantId        UUID
  assetId         UUID FK → Asset
  violationType   VARCHAR(50)  // no_policy, expired, overdue_review
  description     TEXT
  severity        VARCHAR(20)
  status          VARCHAR(50)  // open, remediated, accepted
  remediatedAt    TIMESTAMP?
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

NEW MODEL: DispositionCertificate
  id              UUID PK
  tenantId        UUID
  policyId        UUID FK → RetentionPolicy
  assetId         UUID FK → Asset
  action          VARCHAR(50)  // deleted, archived, anonymized
  executedAt      TIMESTAMP
  executedBy      UUID
  evidence        JSON
  integrityHash   VARCHAR(64)
  createdAt       TIMESTAMP
```

### Services to Extend
- `RetentionService` — Add `detectViolations()`, `enforcePolicy()`, `generateDispositionCertificate()`

### APIs to Extend
- `GET /retention/violations` — List retention violations
- `GET /retention/disposition-certificates` — List disposition proofs
- `POST /retention/enforce` — Trigger enforcement scan
- `GET /retention/coverage` — Asset retention coverage stats

### Files to Modify
- `apps/api/src/modules/retention/retention.service.ts`
- `apps/api/src/modules/retention/retention.controller.ts`
- `apps/api/src/modules/retention/dto/retention.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 16: ROPA PROCESSING REGISTRY UPGRADE

### Existing Implementation
- `RopaService` — 268 lines with CRUD, export
- `RopaEntry` model with all Article 30 required fields

### Upgrade Architecture
Add vendor linkage, cross-border transfer tracking, automated completeness scoring, regulatory report generation.

### Schema Changes
```
MODIFY MODEL: RopaEntry
  ADD FIELD: linkedVendorIds       JSON?
  ADD FIELD: linkedTransferIds     JSON?   // Cross-border transfer references
  ADD FIELD: linkedConsentPurposes JSON?   // Already exists — verify
  ADD FIELD: completenessScore     DECIMAL(3,2)?
  ADD FIELD: lastAuditedAt         TIMESTAMP?
  ADD FIELD: auditedBy             UUID?
```

### Services to Extend
- `RopaService` — Add `calculateCompleteness()`, `linkVendors()`, `generateReport()`, `getProcessingMap()`

### APIs to Extend
- `GET /ropa/completeness` — Completeness scores across all entries
- `GET /ropa/report` — Generate regulatory RoPA report
- `POST /ropa/:id/link-vendors` — Link vendors to entry
- `GET /ropa/processing-map` — Visual processing map data

### Files to Modify
- `apps/api/src/modules/ropa/ropa.service.ts`
- `apps/api/src/modules/ropa/ropa.controller.ts`
- `apps/api/src/modules/ropa/dto/ropa.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 17: COMPLIANCE AUTOMATION UPGRADE

### Existing Implementation
- `ComplianceService` — 419 lines with regulations, controls, evidence, scorecard
- Models: `Regulation`, `Obligation`, `Control`, `ObligationControl`, `EvidenceArtifact`
- Scorecard computes per-regulation compliance percentages

### Upgrade Architecture
Add automated evidence collection, control gap analysis, regulatory framework templates, cross-regulation mapping.

### Schema Changes
```
MODIFY MODEL: Control
  ADD FIELD: automatedCheck    JSON?    // {type, config} for automated evidence
  ADD FIELD: lastCheckedAt     TIMESTAMP?
  ADD FIELD: checkResult       VARCHAR(50)?  // pass, fail, partial, error
  ADD FIELD: checkEvidence     JSON?

NEW MODEL: ComplianceFramework
  id            UUID PK
  name          VARCHAR(255)
  shortName     VARCHAR(50)   // GDPR, DPDP, ISO27701, NIST_PF
  version       VARCHAR(50)
  isSystem      BOOLEAN DEFAULT true
  obligations   JSON          // Pre-loaded obligation definitions
  createdAt     TIMESTAMP

NEW MODEL: ControlGap
  id              UUID PK
  tenantId        UUID
  regulationId    UUID FK → Regulation
  obligationId    UUID FK → Obligation
  gapDescription  TEXT
  severity        VARCHAR(20)
  remediationPlan TEXT?
  status          VARCHAR(50)  // identified, planned, in_progress, closed
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP
```

### Services to Extend
- `ComplianceService` — Add `detectGaps()`, `autoCollectEvidence()`, `mapCrossRegulation()`, `importFramework()`

### APIs to Extend
- `GET /compliance/gaps` — List control gaps
- `POST /compliance/auto-evidence` — Trigger automated evidence collection
- `GET /compliance/cross-map` — Cross-regulation control mapping
- `POST /compliance/frameworks/import` — Import a regulation framework
- `GET /compliance/frameworks` — List available frameworks

### Files to Modify
- `apps/api/src/modules/compliance/compliance.service.ts`
- `apps/api/src/modules/compliance/compliance.controller.ts`
- `apps/api/src/modules/compliance/dto/compliance.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 18: THIRD-PARTY RISK UPGRADE

### Existing Implementation
- `VendorsService` — 328 lines with CRUD, assessments, stats
- Models: `Vendor`, `VendorAssessment`

### Upgrade Architecture
Add vendor data access tracking, security posture scoring, compliance evidence collection, continuous monitoring.

### Schema Changes
```
MODIFY MODEL: Vendor
  ADD FIELD: securityPosture     JSON?    // Structured security assessment
  ADD FIELD: complianceEvidence  JSON?    // [{framework, status, lastAudit}]
  ADD FIELD: dataAccessSummary   JSON?    // {assetCount, dataTypes, lastAccess}
  ADD FIELD: monitoringEnabled   BOOLEAN DEFAULT false

MODIFY MODEL: VendorAssessment
  ADD FIELD: automatedFindings   JSON?    // Auto-detected issues
  ADD FIELD: complianceMapping   JSON?    // {framework: {obligationId: status}}
```

### Services to Extend
- `VendorsService` — Add `assessSecurityPosture()`, `getVendorDataAccess()`, `monitorVendor()`

### APIs to Extend
- `GET /vendors/:id/data-access` — What data does this vendor access?
- `GET /vendors/:id/security-posture` — Security posture details
- `POST /vendors/:id/monitor` — Enable/disable monitoring
- `GET /vendors/risk-matrix` — Vendor risk matrix view

### Files to Modify
- `apps/api/src/modules/vendors/vendors.service.ts`
- `apps/api/src/modules/vendors/vendors.controller.ts`
- `apps/api/src/modules/vendors/dto/vendor.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 19: BREACH MONITORING UPGRADE

### Existing Implementation
- `IncidentsService` — 399 lines with CRUD, stats
- Temporal `breachNotificationWorkflow` with 5 activities
- Models: `Incident` with full breach lifecycle fields

### Upgrade Architecture
Add real-time breach detection signals, automated incident creation from anomalies, regulatory notification tracking, 72-hour timer.

### Schema Changes
```
MODIFY MODEL: Incident
  ADD FIELD: detectionSource     VARCHAR(50)?   // manual, automated, external
  ADD FIELD: regulatoryDeadline  TIMESTAMP?
  ADD FIELD: notificationsSent   JSON?          // [{authority, sentAt, confirmationId}]
  ADD FIELD: dataSubjectNotified BOOLEAN DEFAULT false
  ADD FIELD: linkedAttackPathId  UUID?
  ADD FIELD: linkedLineageIds    JSON?

NEW MODEL: BreachDetectionRule
  id              UUID PK
  tenantId        UUID
  name            VARCHAR(255)
  ruleType        VARCHAR(50)  // large_export, unauthorized_access, external_exposure, anomaly
  condition       JSON
  severity        VARCHAR(20)
  isActive        BOOLEAN DEFAULT true
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP
```

### Services to Extend
- `IncidentsService` — Add `detectBreach()`, `trackNotifications()`, `calculateDeadline()`

### APIs to Extend
- `POST /incidents/detection-rules` — CRUD for detection rules
- `GET /incidents/detection-rules` — List rules
- `GET /incidents/:id/notifications` — Regulatory notification tracking
- `GET /incidents/:id/impact` — Impact analysis using lineage

### Files to Modify
- `apps/api/src/modules/incidents/incidents.service.ts`
- `apps/api/src/modules/incidents/incidents.controller.ts`
- `apps/api/src/modules/incidents/dto/incident.dto.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 20: AI COMPLIANCE GOVERNANCE

### Existing Implementation
- No AI governance module exists
- `AiRecommendation` model exists in schema (for AI-powered suggestions)
- Discovery will be extended for AI dataset detection (Module 2)

### Upgrade Architecture
Track datasets used for AI training, AI system inventory, regulatory compliance (EU AI Act, DPDP), consent lineage for AI usage.

### Schema Changes
```
NEW MODEL: AiSystem
  id              UUID PK
  tenantId        UUID
  name            VARCHAR(255)
  type            VARCHAR(50)    // ml_model, llm, recommendation, classification
  riskCategory    VARCHAR(50)    // unacceptable, high, limited, minimal (EU AI Act)
  status          VARCHAR(50)    // active, development, deprecated, retired
  owner           UUID FK → User
  description     TEXT?
  trainingDatasets JSON          // [{assetId, dataTypes, consentBasis}]
  purpose         TEXT?
  regulatoryBasis JSON?          // [{regulation, article, compliance_status}]
  lastAuditedAt   TIMESTAMP?
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

  @@index([tenantId])
  @@index([riskCategory])

NEW MODEL: AiDatasetUsage
  id              UUID PK
  tenantId        UUID
  aiSystemId      UUID FK → AiSystem
  assetId         UUID FK → Asset
  usageType       VARCHAR(50)  // training, validation, inference, fine_tuning
  dataCategories  JSON
  consentBasis    VARCHAR(50)?
  startDate       TIMESTAMP
  endDate         TIMESTAMP?
  isActive        BOOLEAN DEFAULT true
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP
```

### New Services
- `AiGovernanceService` — AI system CRUD, dataset usage tracking, compliance assessment

### APIs
- `POST /ai-governance/systems` — Register AI system
- `GET /ai-governance/systems` — List AI systems
- `GET /ai-governance/systems/:id` — System details
- `PUT /ai-governance/systems/:id` — Update
- `POST /ai-governance/dataset-usage` — Record dataset usage
- `GET /ai-governance/dataset-usage` — List usage records
- `GET /ai-governance/compliance-report` — AI compliance status

### New Files
- `apps/api/src/modules/ai-governance/ai-governance.module.ts`
- `apps/api/src/modules/ai-governance/ai-governance.service.ts`
- `apps/api/src/modules/ai-governance/ai-governance.controller.ts`
- `apps/api/src/modules/ai-governance/dto/ai-governance.dto.ts`

### Files to Modify
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma`

---

## MODULE 21: DASHBOARDS & INTELLIGENCE UPGRADE

### Existing Implementation
- `DashboardService` — 229 lines: stats, riskDistribution, topRiskyAssets, recentActivity, complianceOverview
- Frontend: main dashboard page with stat cards, risk chart, risky stores
- 15 frontend pages total

### Upgrade Architecture
Add specialized dashboards for data risk, shadow data, identity access, attack paths, compliance posture. Add OpenSearch-powered analytics.

### Schema Changes
None — dashboards aggregate from existing data.

### Services to Extend
- `DashboardService` — Add methods for each dashboard view

### APIs to Extend
- `GET /dashboard/shadow-data` — Shadow data summary
- `GET /dashboard/identity-access` — Identity access overview
- `GET /dashboard/attack-paths` — Attack path summary
- `GET /dashboard/data-risk` — Data risk heatmap data
- `GET /dashboard/ai-governance` — AI compliance overview

### Frontend Pages to Add
- `apps/web/src/app/(dashboard)/shadow-data/page.tsx`
- `apps/web/src/app/(dashboard)/identity-access/page.tsx`
- `apps/web/src/app/(dashboard)/attack-paths/page.tsx`
- `apps/web/src/app/(dashboard)/ai-governance/page.tsx`
- `apps/web/src/app/(dashboard)/lineage/page.tsx`
- `apps/web/src/app/(dashboard)/remediation/page.tsx`

### Files to Modify
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`
- `apps/web/src/components/layout/app-sidebar.tsx` — Add new nav items
- `apps/web/src/hooks/use-api.ts` — Add new hooks

---

## MODULE 22: DEVOPS / SECURITY HARDENING

### Existing Implementation
- `scripts/security-hardening.sql` — RLS policies, audit immutability, app role, indexes
- Crypto module with AES-256-GCM envelope encryption
- Helmet, CORS configuration in `main.ts`
- Rate limiting guard

### Upgrade Architecture
Add secrets management, container hardening config, dependency scanning config, enhanced logging, API rate limiting per tenant.

### New Files
- `apps/api/src/core/security/rate-limiter.service.ts` — Tenant-aware rate limiting using Redis
- `apps/api/src/core/security/secrets-manager.service.ts` — Vault/AWS Secrets Manager abstraction
- `apps/api/src/core/security/request-logger.middleware.ts` — Structured security logging
- `docker/Dockerfile.hardened` — Hardened container config
- `docker/docker-compose.security.yml` — Security-focused compose
- `.github/workflows/security-scan.yml` — Dependency & container scanning
- `scripts/rotate-secrets.sh` — Secret rotation script

### Files to Modify
- `apps/api/src/main.ts` — Add security middleware
- `apps/api/src/core/security/security-events.module.ts` — Register new providers
- `.env.example` — Add secrets manager config vars

---

## MODULE 23: QA & PLATFORM VALIDATION

### Existing Implementation
- 16 test files: 6 core tests (audit, ABAC, MFA, permissions, session, crypto) + 10 module tests
- Tests use Jest with mocked Prisma, Audit, and EventBus services

### Upgrade Architecture
Add integration tests, schema validation, connector tests, risk engine tests, E2E workflow tests.

### New Test Files
- `apps/api/test/integration/workflow-engine.spec.ts`
- `apps/api/test/integration/data-graph.spec.ts`
- `apps/api/test/integration/risk-scoring.spec.ts`
- `apps/api/test/modules/remediation/remediation.service.spec.ts`
- `apps/api/test/modules/shadow-data/shadow-data.service.spec.ts`
- `apps/api/test/modules/lineage/lineage.service.spec.ts`
- `apps/api/test/modules/attack-paths/attack-paths.service.spec.ts`
- `apps/api/test/modules/ai-governance/ai-governance.service.spec.ts`
- `apps/api/test/modules/identity-access/identity-access.service.spec.ts`
- `apps/api/test/connectors/base-connector.spec.ts`
- `apps/api/test/e2e/dsar-workflow.e2e-spec.ts`
- `apps/api/test/e2e/breach-workflow.e2e-spec.ts`
- `apps/api/test/schema/prisma-schema-validation.spec.ts`

### Files to Modify
- `apps/api/package.json` — Add test scripts for integration/e2e

---

## MODULE 24: PLATFORM STABILIZATION

### Existing Issues Identified
1. **Duplicate ApprovalRequest model** — FIXED in this session
2. **Activity stubs** — All 4 activity files throw errors instead of no-op (by design for Temporal)
3. **ConnectorRegistry** — Only 2 of 18 types implemented
4. **Dashboard getDataMap** — Returns flat structure, should use data graph
5. **Search service** — Connected but not used by any module for indexing

### Stabilization Tasks
1. **Schema audit** — Verify all FK references are valid, no orphaned indexes
2. **Module dependency audit** — Ensure no circular dependencies between modules
3. **OpenSearch integration** — Index assets, findings, incidents for full-text search
4. **Event handler registration** — Subscribe to NATS events from all modules
5. **Error handling audit** — Ensure consistent error response format
6. **API documentation** — Generate OpenAPI spec from controllers
7. **Database migration** — Generate Prisma migration from all schema changes
8. **Performance audit** — Add database query pagination guardrails
9. **Config validation** — Add startup config validation for required env vars

### Files to Modify
- `apps/api/src/app.module.ts` — Register all new modules
- `apps/api/src/main.ts` — Add Swagger/OpenAPI
- `apps/api/prisma/schema.prisma` — Final schema consolidation
- Multiple service files — Add OpenSearch indexing hooks
- Multiple service files — Add NATS event subscriptions

---

## IMPLEMENTATION PRIORITY MATRIX

| Phase | Modules | Effort | Dependencies |
|-------|---------|--------|--------------|
| **Phase A** | 1 (Workflow) + 4 (Connectors) | High | Foundation for all other modules |
| **Phase B** | 2 (Discovery) + 3 (Classification) + 5 (Data Graph) | High | Connectors + Workflow |
| **Phase C** | 6 (Risk) + 8 (Identity) + 9 (Shadow Data) | Medium | Discovery + Classification + Graph |
| **Phase D** | 10 (Lineage) + 11 (Attack Paths) + 7 (Remediation) | Medium | Graph + Risk + Identity |
| **Phase E** | 12 (Consent) + 13 (DSAR) + 14 (DPIA) + 15 (Retention) + 16 (RoPA) | Medium | Lineage + Graph |
| **Phase F** | 17 (Compliance) + 18 (Third-Party) + 19 (Breach) + 20 (AI Governance) | Medium | All privacy modules |
| **Phase G** | 21 (Dashboards) + 22 (DevOps) + 23 (QA) + 24 (Stabilization) | Medium | All modules complete |

---

## NEW PRISMA MODELS SUMMARY

| Model | Module | Table Name |
|-------|--------|-----------|
| WorkflowTask | 1 | workflow_tasks |
| DataGraphNode | 5 | data_graph_nodes |
| DataGraphEdge | 5 | data_graph_edges |
| EntityRiskProfile | 6 | entity_risk_profiles |
| RemediationAction | 7 | remediation_actions |
| IdentityAccessMapping | 8 | identity_access_mappings |
| ShadowDataAlert | 9 | shadow_data_alerts |
| DataLineageRecord | 10 | data_lineage_records |
| AttackPath | 11 | attack_paths |
| DpiaTriggerRule | 14 | dpia_trigger_rules |
| RetentionViolation | 15 | retention_violations |
| DispositionCertificate | 15 | disposition_certificates |
| ComplianceFramework | 17 | compliance_frameworks |
| ControlGap | 17 | control_gaps |
| BreachDetectionRule | 19 | breach_detection_rules |
| AiSystem | 20 | ai_systems |
| AiDatasetUsage | 20 | ai_dataset_usage |

**Total new models: 17**
**Total modified models: 14**
**Total new modules: 8**
**Total modified modules: 15**

---

## RISKS AND ASSUMPTIONS

1. **Temporal availability** — Workflow features degrade gracefully when Temporal is unavailable (existing pattern)
2. **NATS availability** — Event triggers require NATS; fallback is manual triggering
3. **OpenSearch availability** — Search features degrade to Prisma queries
4. **Connector SDK** — New connectors require access credentials for testing; mocked in unit tests
5. **Data graph performance** — PostgreSQL-based graph traversal may need query optimization for large tenants; consider materialized views
6. **Attack path analysis** — Computationally intensive; should run as background workflow, not synchronous API
7. **Migration ordering** — Schema changes must be applied before service code deploys
8. **Backward compatibility** — All schema changes use nullable columns or new tables; no breaking changes
9. **Test coverage** — New modules must have unit tests before merge; integration tests follow
10. **Frontend parity** — Dashboard pages for new modules added in Phase G to avoid blocking backend work
