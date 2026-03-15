# Post-Connector Upgrade Plan — Repository Audit & Architecture Delta

**Date:** 2026-03-15
**Connector inventory:** 43 connectors (9 original + 15 Wave 1 + 14 Wave 2 + 5 Wave 3)
**Scope:** All downstream modules that must evolve to consume the new connector signals

---

## 1. Executive Summary

The connector layer now supports 43 data source types spanning databases, cloud storage, SaaS apps, identity providers, DevOps platforms, SIEM/CSPM tools, and privileged access management. However, the downstream platform modules were designed when only 9 connectors existed and have not been updated to consume the expanded signal surface.

**Critical finding:** The `executeScan()` method in `DiscoveryService` only calls `listAssets()`. It never calls `getAssetSchema()`, `sampleContent()`, or `getAccessPolicies()` — meaning that **schema fields, sample values, and access policies from 43 connectors are never ingested into the platform**. This single gap cascades through every downstream module: classification has no sample values to classify, identity-access has no policies to map, risk scoring has no access signals, and the data graph has no identity-to-data edges.

**Second-order gaps:** Even where data _could_ flow, the downstream modules lack source-type awareness. The classifier treats a Jira ticket identically to a PostgreSQL column. The risk scorer doesn't account for SaaS sharing exposure. The shadow data detector can't identify collaboration sprawl. The attack path analyzer stops at one hop and doesn't trace identity-provider chains.

**Upgrade philosophy:** Extend, don't rebuild. Every change below modifies existing services by adding new methods or extending existing ones. No SDK recreation. No module restructuring. Backward compatibility is preserved — all existing API contracts, Prisma models, and event schemas remain valid.

---

## 2. Connector Impact Assessment

### Connector Categories and Their Signal Types

| Category | Connectors | `listAssets` | `getAssetSchema` | `sampleContent` | `getAccessPolicies` |
|----------|-----------|:---:|:---:|:---:|:---:|
| **Databases** | postgresql, mysql, sqlserver, mongodb, snowflake, bigquery, oracle, cassandra, sap_hana, redshift, databricks, aws_rds | Yes | Yes (real schema) | Yes (SELECT sampling) | Yes (DB grants) |
| **Cloud Storage** | aws_s3, azure_blob, gcp_storage, dropbox | Yes | Yes (inferred) | Yes (object listing) | Yes (bucket/ACL policies) |
| **SaaS / Collaboration** | salesforce, servicenow, google_drive, onedrive, sharepoint, slack, teams, jira, confluence, workday, hubspot, zendesk | Yes | Yes (well-known schemas) | Yes (record/content sampling) | Yes (sharing/role permissions) |
| **Identity Providers** | okta, azure_ad, ping_identity, cyberark, sailpoint | Yes | Yes (identity schemas) | No (empty generator) | Yes (role/group memberships) |
| **DevOps** | github, gitlab, bitbucket, jenkins | Yes | Yes (repo/pipeline schemas) | No (empty generator) | Yes (repo/org permissions) |
| **SIEM / Security** | splunk, microsoft_sentinel, elastic_security, wiz, prisma_cloud | Yes | Yes (alert/finding schemas) | Yes (log/alert sampling) | Yes (rule/policy access) |
| **Generic** | generic_rest | Yes | Configurable | Configurable | Configurable |

### Signal Consumption Status (Current)

| Signal | Produced by | Consumed by | Gap |
|--------|------------|------------|-----|
| `listAssets()` | All 43 | `DiscoveryService.executeScan()` | **Working** |
| `getAssetSchema()` | All 43 | **Nobody** | **Critical gap** — fields never populated |
| `sampleContent()` | ~30 connectors | **Nobody** | **Critical gap** — sampleValues never stored |
| `getAccessPolicies()` | ~38 connectors | **Nobody** | **Critical gap** — accessPermissions never populated |
| `getMetadata()` | All 43 | `ConnectorRegistry.getMetadata()` | Working (used for UI listing) |
| `testConnection()` | All 43 | `ConnectorHealthService` | Working |

---

## 3. Discovery Engine Gaps

**File:** `apps/api/src/modules/discovery/discovery.service.ts`

### Current Behavior
- `executeScan()` creates a connector, calls `listAssets()`, batch-upserts assets into the `Asset` table
- **Does NOT call** `getAssetSchema()` to populate `AssetField` records with column metadata
- **Does NOT call** `sampleContent()` to populate `AssetField.sampleValues` for classification
- **Does NOT call** `getAccessPolicies()` to populate `Asset.accessPermissions` for identity mapping
- `discoverShadowData()` uses fingerprint-based duplicate detection only; no collaboration sprawl, no external sharing detection
- `discoverAiDatasets()` uses regex name/path matching only; no content-based detection

### Required Changes

1. **Extend `executeScan()` with post-discovery enrichment phases:**
   - After `listAssets()` completes, iterate discovered assets and call `getAssetSchema()` for each, upserting `AssetField` records
   - For connectors where `capabilities.supportsContentSampling === true`, call `sampleContent()` and store values in `AssetField.sampleValues`
   - For connectors where `capabilities.supportsAccessAnalysis === true` and `getAccessPolicies` exists, call it and store results in `Asset.accessPermissions`
   - Add scan phases to `ScanJob.stats`: `{ assetsDiscovered, fieldsPopulated, fieldsSampled, accessPoliciesCollected }`

2. **Add source-type-aware enrichment hints:**
   - Use `ConnectorMetadata.capabilities` to decide which enrichment phases to run
   - Skip `sampleContent` for identity/DevOps connectors (capability = false)
   - Respect `ScanJob.config.scanScope` to limit enrichment to matching assets

3. **Emit enrichment events:**
   - `scan.schema.completed` — after schema population
   - `scan.sampling.completed` — after content sampling
   - `scan.access.completed` — after access policy collection

**Estimated complexity:** Medium. Modifies `executeScan()` only. All connector methods already exist.

---

## 4. Classification Engine Gaps

**File:** `apps/api/src/modules/classification/classification.service.ts`
**File:** `apps/api/src/modules/classification/engine/classifier.ts`

### Current Behavior
- `classifyAsset()` loads `AssetField.sampleValues` and runs pattern matching
- **But `sampleValues` is never populated** because `executeScan()` never calls `sampleContent()`
- Classifier treats all sources identically — no source-type-aware patterns
- No support for unstructured content (Confluence pages, Jira descriptions, Slack messages)
- No SaaS-specific detection patterns (Salesforce object names, ServiceNow fields)

### Required Changes

1. **Prerequisite: Discovery must populate sampleValues** (Section 3)

2. **Add source-type context to classification:**
   - Pass `dataSource.type` to `classifier.classify()` as context
   - Add SaaS field name patterns (e.g., `assignee.emailAddress` in Jira → PII)
   - Add unstructured content patterns for document-based connectors (Confluence body, Google Drive file content)

3. **Add connector-category-aware confidence adjustments:**
   - Boost confidence when field names match well-known SaaS schemas (e.g., `email` field in SailPoint identity = high confidence PII)
   - Lower confidence for security tool fields (e.g., `alert.description` containing IP addresses != PII)

4. **Add auto-classification trigger on scan completion:**
   - Subscribe to `scan.sampling.completed` event
   - Automatically run classification on newly sampled fields

**Estimated complexity:** Low-Medium. Extends `Classifier` with context parameter. Adds event subscriber.

---

## 5. Data Graph Gaps

**File:** `apps/api/src/modules/data-graph/data-graph-sync.service.ts`
**File:** `apps/api/src/modules/data-graph/graph-enrichment.service.ts`

### Current Behavior
- `syncAll()` syncs only 3 entity types: assets, vendors, users
- Creates only `STORED_IN` (asset→datasource), `CONTAINS` (parent→child), `SHARED_WITH` (asset→vendor) edges
- **Does NOT create** `ACCESSIBLE_BY` edges from identity-access mappings
- **Does NOT create** edges for external sharing (public links, cross-org access)
- **Does NOT sync** identity-provider entities (Okta users/groups, Azure AD groups)
- `GraphEnrichmentService.syncEntities()` syncs users as `identity` nodes but doesn't link them to assets via access mappings

### Required Changes

1. **Add `syncIdentityAccess()` to `DataGraphSyncService`:**
   - Query `IdentityAccessMapping` records for the tenant
   - Create `ACCESSIBLE_BY` edges from asset nodes to identity nodes
   - Include permission metadata on edges (permission level, source, isExcessive flags)

2. **Add `syncExternalSharing()` to `DataGraphSyncService`:**
   - Query assets where `accessPermissions` contains `public` or cross-tenant principals
   - Create `SHARED_WITH` edges to a synthetic `external` node or `public` node

3. **Add identity-provider entity sync:**
   - When identity-provider connectors (Okta, Azure AD, PingIdentity, CyberArk, SailPoint) are scanned, create `identity` and `group` nodes from discovered assets
   - Create `MEMBER_OF` edges between identity and group nodes

4. **Add `syncAll()` to call new sync methods:**
   - Add `syncIdentityAccess()` and `syncExternalSharing()` calls

5. **Extend edge relationship types** in Prisma schema comments:
   - Add `MEMBER_OF`, `AUTHENTICATES_VIA` to documented allowed values

**Estimated complexity:** Medium. Adds 2-3 new methods to `DataGraphSyncService`.

---

## 6. Identity-to-Data Access Intelligence Gaps

**File:** `apps/api/src/modules/identity-access/identity-access.service.ts`
**File:** `apps/api/src/modules/identity-access/access-analyzer.ts`

### Current Behavior
- `buildMappings()` reads from `asset.accessPermissions` (a JSON field on the Asset table)
- **But `accessPermissions` is never populated by discovery** — the field stays `null`
- `AccessAnalyzer` heuristics are generic: excessive = has `admin/owner`, inactive = no access in 90 days, public = `identityType === 'public'`
- No cross-connector identity correlation (same user in Okta, GitHub, and Salesforce)
- No identity-provider enrichment (resolving group memberships from Okta/Azure AD)

### Required Changes

1. **Prerequisite: Discovery must call `getAccessPolicies()`** (Section 3)

2. **Add `buildMappingsFromConnector()` method:**
   - Accept `AccessPolicy[]` from connector output directly
   - Map `AccessPolicy.principal` / `principalType` / `permissions` to `IdentityAccessMapping` fields
   - Call existing `AccessAnalyzer` analysis after creation

3. **Add cross-connector identity correlation:**
   - Match identities across data sources by email, externalId, or name
   - Create a unified identity view showing all assets a single identity can access across all sources
   - Store correlation in `IdentityAccessMapping.metadata` or a new linking field

4. **Enrich with identity-provider data:**
   - When an identity maps to a known Okta/Azure AD/PingIdentity user, resolve their group memberships
   - Flag identities that have been deprovisioned in the IdP but still have active access in data sources

5. **Add source-type-aware excessive access thresholds:**
   - `admin` in GitHub repo != `admin` in production PostgreSQL
   - Weight risk by data sensitivity of the accessed asset

**Estimated complexity:** Medium. Extends `buildMappings()` and `AccessAnalyzer`.

---

## 7. Shadow Data Detection Gaps

**File:** `apps/api/src/modules/shadow-data/shadow-data.service.ts`
**File:** `apps/api/src/modules/shadow-data/fingerprint.service.ts`
**File:** `apps/api/src/modules/shadow-data/ownership-inference.service.ts`

### Current Behavior
- 3 detection strategies: duplicate fingerprints, unmanaged stores, unknown ownership
- `FingerprintService` computes SHA-256 hashes of content buffers — **but no connector currently provides content buffers for fingerprinting**
- `OwnershipInferenceService` uses asset metadata (`createdBy`, `lastModifiedBy`) and most recent accessor
- No detection of:
  - Collaboration sprawl (data copied to personal Google Drives, team Slack channels)
  - External sharing (public links in OneDrive, shared Confluence spaces)
  - SaaS export shadows (Salesforce reports exported to S3, Jira exports in Google Drive)
  - DevOps secret exposure (credentials in GitHub repos, Jenkins build logs)

### Required Changes

1. **Add collaboration sprawl detection:**
   - For SaaS/collaboration connectors, identify personal vs. shared spaces
   - Flag assets in personal drives/channels that contain classified data
   - Use `ConnectorMetadata.type` to determine connector category

2. **Add external sharing detection:**
   - Parse `accessPermissions` for public links, anyone-with-link sharing, external domain access
   - Create `ShadowDataAlert` records with `alertType: 'external_sharing'` (add to allowed values)

3. **Add cross-source content matching:**
   - Use `sampleContent()` values to compute field-level fingerprints
   - Detect when the same data appears in both a production database and a SaaS export

4. **Extend `ShadowDataAlert.alertType` values:**
   - Add: `external_sharing`, `collaboration_sprawl`, `saas_export`, `credential_exposure`

**Estimated complexity:** Medium. Adds 2-3 new detection methods to `ShadowDataService`.

---

## 8. Lineage & Propagation Gaps

**File:** `apps/api/src/modules/lineage/lineage.service.ts`

### Current Behavior
- Manual lineage recording only (`recordLineage()` with explicit source/target/transform)
- Upstream/downstream tracing via recursive BFS
- No automatic lineage inference from connector metadata
- No integration with connector discovery signals

### Required Changes

1. **Add automatic lineage inference:**
   - When `sampleContent()` reveals matching data across two assets (same fingerprint, same schema shape), create inferred lineage with `confidence < 1.0`
   - Detect ETL patterns: Redshift → S3 exports, Databricks notebooks → Delta tables
   - Use `DataLineageRecord.transformType` values: `copy`, `etl`, `export`, `share`

2. **Add connector-metadata-driven lineage:**
   - Salesforce reports that reference objects → create `export` lineage
   - Jenkins/GitHub Actions that move data → create `pipeline` lineage
   - Confluence/Jira attachments stored in S3/GCS → create `share` lineage

3. **Integrate with data graph:**
   - When lineage is recorded, create corresponding `FLOWS_TO` edges in the graph
   - Add `FLOWS_TO` to documented relationship types

**Estimated complexity:** Medium-High. Inference logic is heuristic-based and requires connector-specific rules.

---

## 9. Risk Scoring Gaps

**File:** `apps/api/src/modules/dspm/dspm.service.ts`
**File:** `apps/api/src/modules/dspm/engine/risk-scorer.ts`

### Current Behavior
- `recalculateRisk()` uses metadata fields: `isPubliclyAccessible`, `principalCount`, `hasEncryption`
- `score()` computes: sensitivity x exposure x access x volume
- Sub-scores: `vendorExposureScore`, `aiUsageScore`, `identityAccessScore`, `retentionViolationScore`, `securityMisconfigScore`
- **No connector-specific risk signals** — all connectors treated identically
- No SaaS exposure scoring (external sharing, public links)
- No DevOps exposure scoring (public repos, leaked secrets)
- No identity-provider risk enrichment (deprovisioned users with active access)

### Required Changes

1. **Add connector-category risk signals to `RiskScorer`:**
   - `saasExposureScore()`: external sharing count, public link count, cross-org access
   - `devopsExposureScore()`: public repo count, branch protection status, secret scanning findings
   - `identityRiskScore()`: deprovisioned users with active access, excessive cross-system permissions
   - `securityToolEnrichmentScore()`: incorporate Wiz/Prisma Cloud/Sentinel findings as risk factors

2. **Extend `recalculateRisk()` to use access policies:**
   - Count principals from `accessPermissions` (populated by enriched discovery)
   - Detect public access from `AccessPolicy.principalType === 'public'`
   - Factor in identity-provider deprovisioning signals

3. **Add `RiskFinding.source` values:**
   - Add: `connector_access`, `connector_exposure`, `identity_correlation`

**Estimated complexity:** Medium. Extends `RiskScorer` with new sub-score methods.

---

## 10. Attack Path Analysis Gaps

**File:** `apps/api/src/modules/attack-paths/attack-path-analyzer.ts`

### Current Behavior
- Links exposed identities (public/excessive access) to sensitive assets via lineage
- Only follows 1-hop lineage from exposed entry points
- No identity-provider chain (Okta → app → data)
- No DevOps paths (compromised GitHub Actions → production database)
- No collaboration paths (Slack message with creds → cloud resource)

### Required Changes

1. **Extend hop depth to N-hop analysis:**
   - Follow identity-provider chains: IdP group → SaaS app → data asset
   - Follow DevOps chains: code repo → CI/CD → deployment → data store
   - Use data graph BFS with configurable max depth (default 3)

2. **Add connector-aware entry point detection:**
   - Public GitHub repos as entry points
   - Externally shared Google Drive folders as entry points
   - Public Jira/Confluence spaces as entry points
   - Overpermissioned SailPoint access profiles as entry points

3. **Add identity-provider chain resolution:**
   - When an excessive identity is found, trace back to IdP source
   - Show the full chain: "User X in Okta group Y → has Salesforce admin → can access PII table Z"

4. **Integrate with graph analytics:**
   - Use `GraphAnalyticsService.computeRiskPropagation()` for multi-hop risk assessment
   - Use `computeImpactRadius()` to determine blast radius of compromised identities

**Estimated complexity:** Medium-High. Requires graph traversal changes and connector-specific entry point rules.

---

## 11. Automated Remediation Gaps

**File:** `apps/api/src/modules/remediation/remediation.service.ts`
**File:** `apps/api/src/modules/remediation/remediation-executor.service.ts`

### Current Behavior
- Lifecycle: propose → approve → execute → rollback
- `RemediationExecutorService` dispatches by `actionType` string
- All execution handlers are stubs returning `{ success: true, message: '... delegated to connector' }`
- **No actual connector integration** — remediation never calls connector APIs
- No connector-specific action types (e.g., "remove Confluence space permission", "revoke Okta app assignment")

### Required Changes

1. **Add connector-aware action adapters:**
   - Map `RemediationAction.actionType` to connector-specific operations
   - `revoke_access` + `aws_s3` → remove bucket policy statement
   - `revoke_access` + `okta` → deactivate user assignment
   - `restrict_public` + `google_drive` → change sharing to restricted
   - `revoke_access` + `cyberark` → remove safe member

2. **Extend `RemediationExecutorService` to instantiate connectors:**
   - Load the `DataSource` config for the affected asset
   - Create connector via `ConnectorRegistry`
   - Execute the connector-specific operation

3. **Add new remediation action types:**
   - `rotate_credentials` (CyberArk, SailPoint)
   - `restrict_sharing` (Google Drive, OneDrive, SharePoint, Confluence)
   - `disable_public_access` (GitHub, GitLab, Bitbucket)
   - `enforce_encryption` (S3, Azure Blob, GCP Storage)

4. **Add pre-execution validation:**
   - Verify the connector supports the requested action
   - Check current state before executing (idempotency)

**Estimated complexity:** High. Requires connector-specific adapter pattern. Can be implemented incrementally per connector category.

---

## 12. Dashboards & Reporting Gaps

**File:** `apps/api/src/modules/dashboard/dashboard.service.ts`

### Current Behavior
- `getStats()`: privacy health score, findings count, DSAR count, connected sources, total assets
- No connector health/coverage metrics
- No source-type breakdown of risk, classification, or access
- Extended views: shadow data summary, identity access overview, attack path summary, risk heatmap, AI governance overview
- No per-connector-type drill-down

### Required Changes

1. **Add connector coverage dashboard:**
   - Count of configured vs. available connector types (X of 43)
   - Per-connector-type: status (active/pending/failed), last scan time, assets discovered, health status

2. **Add source-type-aware breakdowns:**
   - Risk findings grouped by connector category (databases vs. SaaS vs. identity vs. DevOps vs. security)
   - Classification distribution per source type
   - Identity access heatmap: which identities have cross-source access

3. **Add connector health summary to main dashboard:**
   - Use existing `ConnectorHealthService.getHealthSummary()` data
   - Show healthy/degraded/unhealthy counts

4. **Add data coverage metrics:**
   - % of assets with schema populated
   - % of assets with sample values collected
   - % of assets with access policies collected
   - Gap analysis: connectors that support sampling but haven't been sampled

**Estimated complexity:** Low-Medium. Mostly new query methods in `DashboardService`.

---

## 13. Event Pipeline Gaps

**File:** `apps/api/src/core/events/event-bus.service.ts`

### Current Behavior
- NATS JetStream-based pub/sub with durable consumers
- Publishes events: `scan.queued`, `scan.started`, `scan.completed`, `scan.failed`
- Dead-letter queue with 3 retries and exponential backoff
- Prometheus metrics integration
- **No events for** schema enrichment, content sampling, access policy collection, or connector health changes
- **No event consumers** for triggering downstream processing after scan phases

### Required Changes

1. **Add scan phase events (published by Discovery):**
   - `scan.schema.completed` — triggers classification
   - `scan.sampling.completed` — triggers auto-classification
   - `scan.access.completed` — triggers identity-access mapping
   - `scan.enrichment.completed` — triggers graph sync and risk recalculation

2. **Add event consumers in downstream modules:**
   - `ClassificationService` subscribes to `scan.sampling.completed`
   - `IdentityAccessService` subscribes to `scan.access.completed`
   - `DataGraphSyncService` subscribes to `scan.enrichment.completed`
   - `DspmService` subscribes to `scan.enrichment.completed`

3. **Add connector health events:**
   - `connector.health.recovered` — when status goes from unhealthy to healthy
   - Already exists: `connector.health_degraded`

**Estimated complexity:** Low. Events are simple publish calls. Consumers are `subscribe()` calls in module `onModuleInit()`.

---

## 14. Cross-Cutting: Prisma Schema Readiness

**File:** `apps/api/prisma/schema.prisma`

### Current State
The schema is already well-prepared for most upgrade needs:

| Model | Ready? | Notes |
|-------|--------|-------|
| `Asset.accessPermissions` | Yes | JSON field, ready for `getAccessPolicies()` output |
| `Asset.fingerprint` | Yes | 128-char string for content hashing |
| `Asset.isShadowData` | Yes | Boolean flag for shadow detection |
| `AssetField.sampleValues` | Yes | JSON field for `sampleContent()` output |
| `IdentityAccessMapping` | Yes | All required fields present |
| `DataGraphNode.nodeType` | Extend | Add `connector`, `group` to documented values |
| `DataGraphEdge.relationshipType` | Extend | Add `MEMBER_OF`, `AUTHENTICATES_VIA`, `FLOWS_TO` |
| `ShadowDataAlert.alertType` | Extend | Add `external_sharing`, `collaboration_sprawl` |
| `ScanJob.stats` | Yes | JSON field, can add phase stats |
| `ConnectorHealthLog` | Yes | Full health logging infrastructure |

### Required Schema Changes
- **None blocking.** All extensions are to documented allowed values (string fields, not enums). The Prisma schema uses strings, not enums, so no migration is needed for new values.
- Optional: add `externalId` to `IdentityAccessMapping` for cross-connector identity correlation.

---

## 15. Connector SDK Gaps

**File:** `apps/api/src/modules/connectors/sdk/base-rest-api-connector.ts`
**File:** `apps/api/src/modules/connectors/interfaces/connector.interface.ts`

### Current State
The SDK is complete and requires **no changes**. The `IConnector` interface already defines all necessary methods:
- `initialize()`, `testConnection()`, `disconnect()` — lifecycle
- `listAssets()` — discovery (AsyncGenerator)
- `getAssetSchema()` — schema retrieval
- `sampleContent()` — content sampling (AsyncGenerator)
- `getAccessPolicies()` — access policy retrieval (optional)
- `getMetadata()` — connector metadata

### Assessment
**No SDK changes needed.** The problem is not missing connector methods — it's that the platform never calls them.

---

## 16. Dependency Map

```
executeScan() ─── calls listAssets() ──────────────────────── [WORKING]
      │
      ├── should call getAssetSchema() ──► AssetField records ──► ClassificationService
      │                                                            └── needs sampleValues
      │
      ├── should call sampleContent() ──► AssetField.sampleValues ──► ClassificationService
      │                                                                 └── auto-classify
      │
      └── should call getAccessPolicies() ──► Asset.accessPermissions
                                                    │
                                                    ├──► IdentityAccessService.buildMappings()
                                                    │         └──► IdentityAccessMapping records
                                                    │                    │
                                                    │                    ├──► DataGraphSyncService (ACCESSIBLE_BY edges)
                                                    │                    ├──► RiskScorer (access signals)
                                                    │                    └──► AttackPathAnalyzer (entry points)
                                                    │
                                                    └──► ShadowDataService (external sharing detection)
```

### Event Flow (Target State)
```
scan.completed
  └──► scan.schema.completed
         └──► scan.sampling.completed
                ├──► ClassificationService (auto-classify)
                └──► scan.access.completed
                       ├──► IdentityAccessService (build mappings)
                       ├──► DataGraphSyncService (sync identity-access edges)
                       ├──► DspmService (recalculate risk)
                       └──► ShadowDataService (external sharing check)
```

---

## 17. Implementation Priority & Sequencing

### Phase 1 — Foundation (Must Do First)
| # | Module | Change | Why First |
|---|--------|--------|-----------|
| 1 | Discovery | Extend `executeScan()` with schema, sampling, access phases | **Everything depends on this** |
| 2 | Event Pipeline | Add scan phase events | Enables event-driven downstream processing |

### Phase 2 — Core Intelligence (Depends on Phase 1)
| # | Module | Change | Dependency |
|---|--------|--------|------------|
| 3 | Classification | Add source-type context, auto-classify subscriber | Needs sampleValues from Phase 1 |
| 4 | Identity-Access | Add `buildMappingsFromConnector()`, analysis enrichment | Needs accessPermissions from Phase 1 |
| 5 | Data Graph | Add `syncIdentityAccess()`, `syncExternalSharing()` | Needs identity mappings from #4 |

### Phase 3 — Advanced Analytics (Depends on Phase 2)
| # | Module | Change | Dependency |
|---|--------|--------|------------|
| 6 | Risk Scoring | Add connector-category sub-scores | Needs access + identity data from Phase 2 |
| 7 | Shadow Data | Add collaboration sprawl + external sharing detection | Needs access data from Phase 2 |
| 8 | Attack Paths | Add N-hop analysis + connector-aware entry points | Needs graph edges from #5 |

### Phase 4 — Operationalization (Independent)
| # | Module | Change | Dependency |
|---|--------|--------|------------|
| 9 | Dashboards | Add connector coverage + source-type breakdowns | Can query existing data |
| 10 | Remediation | Add connector-aware action adapters | Can start with stub implementations |
| 11 | Lineage | Add automatic inference from content matching | Needs fingerprints + sampling data |

---

## 18. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance degradation from calling 3 extra methods per asset during scan | High | Medium | Batch calls, add concurrency limits, make enrichment phases optional per scan config |
| Rate limiting on SaaS APIs during mass sampling | High | Medium | Respect `rateLimitConfig` on DataSource, use exponential backoff (already in BaseConnector) |
| Large sample values consuming storage | Medium | Low | Cap `sampleValues` at 5 values per field, truncate long strings |
| Breaking existing scan behavior | Low | High | Make enrichment phases opt-in via `ScanJob.config`, default to current behavior |
| Credential exposure in sampleValues | Medium | Critical | Apply redaction/masking before storing sample values, respect `excludePatterns` |

---

## 19. Backward Compatibility Guarantees

1. **All existing API endpoints remain unchanged** — new functionality is additive
2. **Existing scan behavior is preserved** — enrichment phases are opt-in via scan config
3. **Prisma schema has no breaking migrations** — all new values are for string fields, not enums
4. **Event schema is additive** — new event types don't affect existing subscribers
5. **Connector SDK is unchanged** — no modifications to `IConnector`, `BaseConnector`, or `BaseRestApiConnector`
6. **Existing test suites remain valid** — 43 connector tests + registry tests unaffected

---

## 20. Files to Modify (Complete Manifest)

### Phase 1 — Discovery + Events
| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/discovery/discovery.service.ts` | **Modify** | Extend `executeScan()` with schema, sampling, access enrichment phases |
| `apps/api/src/modules/discovery/dto/discovery.dto.ts` | **Modify** | Add enrichment config fields to `StartScanDto` |

### Phase 2 — Core Intelligence
| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/classification/classification.service.ts` | **Modify** | Add auto-classify event subscriber, pass source type to classifier |
| `apps/api/src/modules/classification/engine/classifier.ts` | **Modify** | Accept source-type context, add SaaS-aware patterns |
| `apps/api/src/modules/identity-access/identity-access.service.ts` | **Modify** | Add `buildMappingsFromConnector()`, cross-connector correlation |
| `apps/api/src/modules/identity-access/access-analyzer.ts` | **Modify** | Add source-type-aware thresholds |
| `apps/api/src/modules/data-graph/data-graph-sync.service.ts` | **Modify** | Add `syncIdentityAccess()`, `syncExternalSharing()` |

### Phase 3 — Advanced Analytics
| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/dspm/engine/risk-scorer.ts` | **Modify** | Add `saasExposureScore()`, `devopsExposureScore()`, `identityRiskScore()` |
| `apps/api/src/modules/dspm/dspm.service.ts` | **Modify** | Integrate new risk signals into `recalculateRisk()` |
| `apps/api/src/modules/shadow-data/shadow-data.service.ts` | **Modify** | Add collaboration sprawl + external sharing detection |
| `apps/api/src/modules/attack-paths/attack-path-analyzer.ts` | **Modify** | Extend to N-hop, add connector-aware entry points |
| `apps/api/src/modules/lineage/lineage.service.ts` | **Modify** | Add automatic lineage inference |

### Phase 4 — Operationalization
| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/modules/dashboard/dashboard.service.ts` | **Modify** | Add connector coverage + source-type breakdowns |
| `apps/api/src/modules/remediation/remediation-executor.service.ts` | **Modify** | Add connector-aware action routing |

### Tests (New)
| File | Action | Description |
|------|--------|-------------|
| `apps/api/test/modules/discovery/discovery-enrichment.spec.ts` | **Create** | Test schema/sampling/access enrichment phases |
| `apps/api/test/modules/classification/auto-classify.spec.ts` | **Create** | Test event-driven auto-classification |
| `apps/api/test/modules/identity-access/connector-mappings.spec.ts` | **Create** | Test `buildMappingsFromConnector()` |
| `apps/api/test/modules/data-graph/identity-sync.spec.ts` | **Create** | Test identity-access edge sync |
| `apps/api/test/modules/dspm/connector-risk-signals.spec.ts` | **Create** | Test connector-category risk sub-scores |
| `apps/api/test/modules/shadow-data/external-sharing.spec.ts` | **Create** | Test collaboration sprawl detection |

**Total: 14 files modified, 6 test files created. Zero new modules. Zero SDK changes.**
