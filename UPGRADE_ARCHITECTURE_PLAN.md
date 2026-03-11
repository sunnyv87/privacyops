# PrivacyOps Ultra Upgrade Architecture Plan
# AI-Native Data Security Intelligence Platform

---

## Executive Summary

This document defines the upgrade architecture for transforming PrivacyOps from a privacy operations platform into an AI-native Data Security Intelligence Platform. The plan introduces 14 advanced AI-driven modules that extend — never replace — the existing 23 modules, 50+ database models, 46 services, and 7 data connectors already in production.

**Design Principles:**
- Extend existing modules; never recreate
- Backward-compatible schema evolution (additive columns, new tables)
- Event-driven integration via existing NATS JetStream bus
- RBAC/audit enforcement on all new endpoints
- Horizontal scalability preserved (stateless services, Temporal workflows)

**Infrastructure Dependencies (New):**
- LLM API (Anthropic Claude) — already configured via `ANTHROPIC_API_KEY`
- Vector store (pgvector extension on existing PostgreSQL)
- Redis streams for real-time telemetry aggregation

---

## CURRENT PLATFORM ARCHITECTURE SUMMARY

### Technology Stack
| Layer | Technology |
|-------|-----------|
| API Framework | NestJS 10.x |
| Database ORM | Prisma (PostgreSQL 15) |
| Workflow Engine | Temporal.io |
| Event Bus | NATS JetStream (7-day retention, 1M msg limit) |
| Search | OpenSearch 2.10 |
| Auth | JWT + OIDC (Keycloak) + SAML + MFA |
| Cache | Redis 7 |
| Storage | MinIO/S3 |
| Frontend | Next.js + React Query + Tailwind |
| Encryption | KMS + AES-256 |

### Existing Modules (23)
ai-governance, vendors, users, retention, discovery, compliance, incidents, identity-access, scim, attack-paths, remediation, assessments, dspm, shadow-data, connectors, lineage, dsar, ropa, consent, dashboard, data-graph, classification

### Existing Database Models (50+)
Tenant, User, Role, UserRole, ApiKey, ScimToken, DataSource, ScanJob, Asset, AssetField, ClassificationLabel, Classification, RiskFinding, EntityRiskProfile, RemediationAction, DataLineageRecord, AttackPath, IdentityAccessMapping, ShadowDataAlert, BreachDetectionRule, DsarRequest, DataSubject, ConsentRecord, ConsentNotice, ProcessingPurpose, PrivacyAssessment, RopaEntry, CrossBorderTransfer, RetentionPolicy, RetentionViolation, DispositionCertificate, Vendor, VendorAssessment, Regulation, Obligation, Control, ObligationControl, ComplianceFramework, ControlGap, Workflow, WorkflowTask, ApprovalRequest, AuditLog, AuditChainState, EvidenceArtifact, AiSystem, AiRecommendation, AiDatasetUsage, DataGraphNode, DataGraphEdge, Incident

### Key Architectural Patterns
1. Multi-tenancy via tenantId propagation (header/JWT)
2. Event sourcing via NATS JetStream (`privacyops.{eventType}`)
3. Workflow orchestration via Temporal (7 task queues)
4. Composite risk scoring (5 dimensions, 0-100 scale)
5. Immutable audit trail with SHA-256 chain integrity
6. RBAC + ABAC + Approval workflows
7. Data graph with BFS path finding (8 node types, 7 edge types)
8. Connector SDK with plugin architecture (7 connectors)

---

## MODULE 1: AI SECURITY CO-PILOT

### 1.1 Existing Implementation Review
- `DataGraphService` provides node/edge CRUD, neighbor discovery, path finding, subgraph extraction
- `DspmService` provides risk findings, risk trends, entity risk calculation
- `LineageService` provides upstream/downstream tracing
- `AiRecommendation` model exists with type/confidence/promptHash fields
- `ANTHROPIC_API_KEY` already in environment config
- No natural language query interface exists

### 1.2 Upgrade Architecture

```
┌──────────────────────────────────────────────────────┐
│                  AI Security Co-Pilot                 │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Query      │  │   Intent     │  │  Security   │ │
│  │ Interpreter  │→ │  Detector    │→ │  Guardrails │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│         │                                     │       │
│  ┌──────▼──────┐  ┌──────────────┐  ┌────────▼────┐ │
│  │ Graph Query │  │  Response    │  │  Context    │ │
│  │  Planner    │→ │  Generator   │← │  Assembler  │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
         │                    │
    ┌────▼────┐    ┌─────────▼─────────┐
    │Existing │    │ Existing Services  │
    │DataGraph│    │ DSPM, Lineage,     │
    │Service  │    │ IdentityAccess,    │
    │         │    │ AttackPaths, etc.  │
    └─────────┘    └───────────────────┘
```

**Components:**

1. **CoPilotService** (new service in new `co-pilot` module)
   - `processQuery(tenantId, userId, query: string): Promise<CoPilotResponse>`
   - `getConversationHistory(tenantId, userId, sessionId)`
   - `provideFeedback(tenantId, responseId, feedback)`

2. **QueryInterpreterService** (new, internal to co-pilot)
   - Uses Claude API to parse natural language into structured intent
   - Intent types: `risk_query`, `data_location`, `compliance_check`, `lineage_trace`, `access_audit`, `remediation_advice`, `attack_path`, `vendor_risk`, `general_summary`
   - Output: `{ intent, entities[], filters, timeRange }`

3. **GraphQueryPlannerService** (new, internal to co-pilot)
   - Translates intents into service calls against existing services
   - Maps entity references to DataGraph node lookups
   - Builds multi-step execution plans for complex queries

4. **ContextAssemblerService** (new, internal to co-pilot)
   - Gathers data from existing services based on query plan
   - Calls: `DataGraphService.findNodes()`, `DspmService.getStats()`, `LineageService.getFullLineage()`, `IdentityAccessService.getAnomalies()`, `AttackPathsService.getAttackPaths()`, etc.
   - Assembles structured context for LLM response generation

5. **ResponseGeneratorService** (new, internal to co-pilot)
   - Sends assembled context + user query to Claude API
   - Applies security guardrails (no raw credentials, no PII in responses)
   - Returns structured response with citations to platform data

6. **SecurityGuardrailsService** (new, internal to co-pilot)
   - Input sanitization (prompt injection prevention)
   - Output filtering (strip sensitive data patterns)
   - Permission-scoped responses (user only sees data they have access to)
   - Rate limiting per user/tenant

### 1.3 Schema Changes

```prisma
model CoPilotConversation {
  id              String   @id @default(uuid())
  tenantId        String
  userId          String
  sessionId       String
  query           String
  intent          String
  queryPlan       Json
  contextSummary  Json
  response        String
  responseTokens  Int
  latencyMs       Int
  feedback        String?  // thumbs_up, thumbs_down, null
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  user            User     @relation(fields: [userId], references: [id])

  @@index([tenantId, userId])
  @@index([tenantId, sessionId])
  @@index([tenantId, intent])
}
```

### 1.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/co-pilot/query` | `copilot:query` | Submit NL query |
| GET | `/co-pilot/history` | `copilot:read` | Get conversation history |
| POST | `/co-pilot/feedback/:id` | `copilot:query` | Submit feedback on response |
| GET | `/co-pilot/suggestions` | `copilot:read` | Get contextual query suggestions |

### 1.5 Services to Modify
- None modified — all integration via existing service method calls

### 1.6 New Services Required
- `CoPilotModule` (new module)
- `CoPilotService`, `QueryInterpreterService`, `GraphQueryPlannerService`, `ContextAssemblerService`, `ResponseGeneratorService`, `SecurityGuardrailsService`

### 1.7 Migration Impact
- Additive: 1 new table, 1 new module
- No existing table changes
- New permissions: `copilot:query`, `copilot:read`

### 1.8 Compatibility Concerns
- LLM API latency (2-10s) — must be async with streaming support
- Token cost management — implement per-tenant usage limits
- Claude API availability — graceful degradation with cached responses

### 1.9 Risks & Assumptions
- Assumes Claude API access is stable and performant
- Prompt injection is a real attack vector — guardrails are critical
- Context window limits may require summarization for large tenants

---

## MODULE 2: AI RISK INTELLIGENCE ENGINE

### 2.1 Existing Implementation Review
- `DspmService.calculateEntityRisk()` computes composite risk across 5 dimensions
- `RiskScorer` in `/dspm/engine/risk-scorer.ts` handles base scoring with sensitivity, exposure, access, volume
- `EntityRiskProfile` model stores composite scores with breakdown
- `DspmService.getRiskTrends()` provides basic historical trends
- `ShadowDataAlert`, `AttackPath`, `IdentityAccessMapping` provide signal inputs
- No predictive/ML-based risk analysis exists

### 2.2 Upgrade Architecture

```
┌───────────────────────────────────────────────────┐
│           AI Risk Intelligence Engine              │
│                                                    │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Signal     │  │   Risk       │  │  Anomaly  │ │
│  │ Aggregator  │→ │  Predictor   │→ │  Detector │ │
│  └────────────┘  └──────────────┘  └───────────┘ │
│        │                │                  │      │
│  ┌─────▼─────┐   ┌─────▼──────┐  ┌───────▼────┐ │
│  │  Trend    │   │  Impact    │  │  Alert     │ │
│  │ Analyzer  │   │  Assessor  │  │  Publisher │ │
│  └───────────┘   └────────────┘  └────────────┘ │
└───────────────────────────────────────────────────┘
         ▲                ▲               │
    ┌────┴────┐    ┌─────┴──────┐   ┌────▼────┐
    │Existing │    │ Existing   │   │ NATS    │
    │RiskScorer│   │ DataGraph  │   │EventBus │
    │EntityRisk│   │ ShadowData │   └─────────┘
    └─────────┘   │ AttackPaths│
                  └────────────┘
```

**Approach:** Extend `DspmService` with new methods and add `RiskIntelligenceService` as a companion service in the existing `dspm` module.

### 2.3 Schema Changes

```prisma
model RiskPrediction {
  id              String   @id @default(uuid())
  tenantId        String
  entityType      String   // asset, vendor, identity, ai_system
  entityId        String
  currentScore    Float
  predictedScore  Float
  predictedDate   DateTime
  confidence      Float
  drivers         Json     // [{ factor, weight, trend }]
  status          String   @default("active") // active, expired, superseded
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, status])
}

model RiskAnomaly {
  id              String   @id @default(uuid())
  tenantId        String
  entityType      String
  entityId        String
  anomalyType     String   // score_spike, pattern_shift, new_exposure, access_surge
  severity        String   // critical, high, medium, low
  description     String
  baselineValue   Float
  observedValue   Float
  deviation       Float
  detectedAt      DateTime @default(now())
  status          String   @default("open") // open, acknowledged, resolved, dismissed
  resolvedAt      DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
  @@index([tenantId, entityType])
}

// ADD COLUMNS to existing EntityRiskProfile:
// predictedScore     Float?
// predictionDrivers  Json?
// trendDirection     String?  // increasing, decreasing, stable
// anomalyCount       Int      @default(0)
```

### 2.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/dspm/risk-intelligence/predictions` | `dspm:read` | Get risk predictions |
| GET | `/dspm/risk-intelligence/predictions/:entityType/:entityId` | `dspm:read` | Get entity prediction |
| POST | `/dspm/risk-intelligence/analyze` | `dspm:admin` | Trigger risk analysis |
| GET | `/dspm/risk-intelligence/anomalies` | `dspm:read` | Get detected anomalies |
| GET | `/dspm/risk-intelligence/trends` | `dspm:read` | Get risk trend analysis |
| GET | `/dspm/risk-intelligence/impact/:entityId` | `dspm:read` | Business impact analysis |

### 2.5 Services to Modify
- `DspmService` — add `getRiskIntelligenceSummary()` method that delegates to new service
- `RiskScorer` — add `getScoreHistory()` to expose historical score data for trend analysis

### 2.6 New Services Required
- `RiskIntelligenceService` (in existing `dspm` module)
  - `generatePredictions(tenantId)` — analyze historical scores, compute predicted future scores
  - `detectAnomalies(tenantId)` — compare current scores against statistical baselines
  - `analyzeTrends(tenantId, entityType?, timeRange?)` — linear regression on score history
  - `assessBusinessImpact(tenantId, entityId)` — compute downstream impact via DataGraph

### 2.7 Migration Impact
- 2 new tables, 4 new columns on `EntityRiskProfile`
- No breaking changes to existing APIs

### 2.8 Risks & Assumptions
- Prediction accuracy depends on historical data volume (minimum 30 days recommended)
- Statistical anomaly detection may produce false positives initially — needs tuning period
- Trend analysis assumes regular risk recalculation cadence

---

## MODULE 3: AUTONOMOUS REMEDIATION AGENT

### 3.1 Existing Implementation Review
- `RemediationService` provides full lifecycle: propose → approve → execute → rollback
- `RemediationExecutorService` handles 8 action types with rollback state capture
- `WorkflowService` supports `startRemediationWorkflow()`
- `ApprovalGuard` and `ApprovalRequest` model enforce approval gates
- No AI-driven remediation planning exists — all proposals are manual

### 3.2 Upgrade Architecture

```
┌────────────────────────────────────────────────────┐
│          Autonomous Remediation Agent               │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐│
│  │  Finding     │  │  Remediation │  │  Safety    ││
│  │  Analyzer    │→ │  Planner     │→ │  Validator ││
│  └─────────────┘  └──────────────┘  └────────────┘│
│        │                │                  │       │
│  ┌─────▼─────┐   ┌─────▼──────┐  ┌───────▼─────┐ │
│  │  Context  │   │  Plan      │  │  Execution  │ │
│  │ Enricher  │   │  Optimizer │  │  Orchestrator│ │
│  └───────────┘   └────────────┘  └─────────────┘ │
└────────────────────────────────────────────────────┘
         │                │               │
    ┌────▼────┐    ┌─────▼──────┐   ┌────▼──────┐
    │Existing │    │ Existing   │   │ Existing  │
    │Remediation│  │ Workflow   │   │ Approval  │
    │Service  │    │ Service    │   │ Guard     │
    └─────────┘    └────────────┘   └───────────┘
```

**Approach:** Add `RemediationAgentService` to the existing `remediation` module.

### 3.3 Schema Changes

```prisma
model RemediationPlan {
  id              String   @id @default(uuid())
  tenantId        String
  findingId       String
  planType        String   // auto_generated, ai_suggested, manual
  steps           Json     // [{ order, actionType, target, params, risk, rollbackPlan }]
  riskAssessment  Json     // { overallRisk, sideEffects[], dependencies[] }
  estimatedImpact Json     // { assetsAffected, usersAffected, downtime }
  confidence      Float
  status          String   @default("proposed") // proposed, approved, executing, completed, failed, rejected
  approvedBy      String?
  approvedAt      DateTime?
  executionLog    Json?
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, findingId])
  @@index([tenantId, status])
}

// ADD COLUMNS to existing RemediationAction:
// planId          String?   // link to RemediationPlan
// aiGenerated     Boolean   @default(false)
// safetyScore     Float?    // 0-1, how safe the action is
```

### 3.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/remediation/agent/analyze/:findingId` | `remediation:admin` | Generate AI remediation plan |
| GET | `/remediation/agent/plans` | `remediation:read` | List AI-generated plans |
| GET | `/remediation/agent/plans/:id` | `remediation:read` | Get plan details |
| POST | `/remediation/agent/plans/:id/approve` | `remediation:admin` | Approve AI plan |
| POST | `/remediation/agent/plans/:id/execute` | `remediation:admin` | Execute approved plan |
| POST | `/remediation/agent/bulk-analyze` | `remediation:admin` | Analyze multiple findings |

### 3.5 Services to Modify
- `RemediationService` — add `getActionsByPlan(planId)` method
- Subscribe to `finding.created` events to trigger auto-analysis for critical/high findings

### 3.6 New Services Required
- `RemediationAgentService` (in existing `remediation` module)
  - `analyzeFinding(tenantId, findingId)` — gather context, generate plan via LLM
  - `validatePlanSafety(plan)` — assess blast radius, reversibility, dependencies
  - `executePlan(tenantId, planId)` — orchestrate multi-step execution via existing RemediationService
  - `bulkAnalyze(tenantId, findingIds[])` — batch analysis

### 3.7 Migration Impact
- 1 new table, 3 new columns on `RemediationAction`
- Event listener for `finding.created` — additive

### 3.8 Risks & Assumptions
- Auto-execution carries inherent risk — always require approval for destructive actions
- Safety validator must be conservative
- Plans may become stale if findings change between generation and approval

---

## MODULE 4: AI ATTACK SIMULATION ENGINE

### 4.1 Existing Implementation Review
- `AttackPathAnalyzer` identifies exposure chains via identity access + data lineage
- Scoring: public access (+40), excessive access (+25), target severity (+10-50)
- `DataGraphService.findPaths()` provides BFS path finding
- `IdentityAccessService` maps identities to data assets
- Current analysis is static — no simulation of attacker behavior

### 4.2 Upgrade Architecture

```
┌──────────────────────────────────────────────────────┐
│            AI Attack Simulation Engine                 │
│                                                       │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐│
│  │  Scenario    │  │  Simulation   │  │  Path      ││
│  │  Generator   │→ │  Engine       │→ │  Scorer    ││
│  └──────────────┘  └───────────────┘  └────────────┘│
│         │                │                  │        │
│  ┌──────▼──────┐  ┌─────▼──────┐  ┌───────▼──────┐ │
│  │  Identity   │  │ Privilege  │  │  Report      │ │
│  │ Compromise  │  │ Escalation │  │  Generator   │ │
│  │  Modeler    │  │  Simulator │  │              │ │
│  └─────────────┘  └────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────┘
         ▲                ▲
    ┌────┴────┐    ┌─────┴──────┐
    │Existing │    │ Existing   │
    │AttackPath│   │ DataGraph  │
    │Analyzer │    │ Identity   │
    │         │    │ Access     │
    └─────────┘    └────────────┘
```

**Approach:** Add `AttackSimulationService` to the existing `attack-paths` module.

### 4.3 Schema Changes

```prisma
model AttackSimulation {
  id              String   @id @default(uuid())
  tenantId        String
  scenarioType    String   // identity_compromise, privilege_escalation, data_exfiltration, lateral_movement
  scenarioConfig  Json     // { entryPoint, targetAssets[], assumedCompromise }
  status          String   @default("pending") // pending, running, completed, failed
  results         Json?    // { pathsDiscovered, criticalPaths[], riskScore, recommendations[] }
  pathsFound      Int      @default(0)
  maxRiskScore    Float    @default(0)
  executionTimeMs Int?
  scheduledBy     String
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
  @@index([tenantId, scenarioType])
}

model SimulatedAttackPath {
  id              String   @id @default(uuid())
  tenantId        String
  simulationId    String
  entryPoint      Json     // { type, entityId, description }
  pathSteps       Json     // [{ step, action, fromEntity, toEntity, technique, probability }]
  targetAsset     Json     // { assetId, sensitivity, dataCategories }
  riskScore       Float
  exploitability  String   // easy, moderate, difficult
  impact          String   // critical, high, medium, low
  mitigations     Json     // [{ action, priority, effort }]
  createdAt       DateTime @default(now())

  simulation      AttackSimulation @relation(fields: [simulationId], references: [id])
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, simulationId])
  @@index([tenantId, riskScore])
}
```

### 4.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/attack-paths/simulations` | `attack-paths:admin` | Create and run simulation |
| GET | `/attack-paths/simulations` | `attack-paths:read` | List simulations |
| GET | `/attack-paths/simulations/:id` | `attack-paths:read` | Get simulation results |
| GET | `/attack-paths/simulations/:id/paths` | `attack-paths:read` | Get discovered paths |
| POST | `/attack-paths/simulations/identity-compromise` | `attack-paths:admin` | Simulate identity compromise |
| POST | `/attack-paths/simulations/data-exfiltration` | `attack-paths:admin` | Simulate exfiltration |

### 4.5 Services to Modify
- `AttackPathsService` — add `getSimulations()` and `getSimulationById()` delegation methods

### 4.6 New Services Required
- `AttackSimulationService` (in existing `attack-paths` module)
  - `runSimulation(tenantId, scenario)` — orchestrate full simulation
  - `simulateIdentityCompromise(tenantId, identityId)` — what-if identity compromise
  - `simulateDataExfiltration(tenantId, assetId)` — reverse trace all access paths
  - `simulatePrivilegeEscalation(tenantId, identityId)` — find escalation chains
  - `generateMitigations(paths[])` — use LLM to suggest mitigations per path

### 4.7 Migration Impact
- 2 new tables, no existing table changes

### 4.8 Risks & Assumptions
- Simulations on large graphs may be expensive — implement depth limits
- Results should be clearly labeled as simulated, not actual breaches

---

## MODULE 5: DATA EXPOSURE THREAT HUNTING ENGINE

### 5.1 Existing Implementation Review
- `IdentityAccessService` detects excessive/inactive access and public sharing
- `ShadowDataService` detects unmanaged/duplicate/orphaned data
- `AttackPathAnalyzer` links exposure to sensitive assets
- `BreachDetectionRule` model exists for large export/unauthorized access rules
- No continuous behavioral anomaly detection exists

### 5.2 Upgrade Architecture

```
┌──────────────────────────────────────────────────────┐
│         Data Exposure Threat Hunting Engine            │
│                                                       │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐│
│  │  Access      │  │  Export       │  │  Credential││
│  │  Pattern     │  │  Monitor     │  │  Misuse    ││
│  │  Analyzer    │  │              │  │  Detector  ││
│  └──────────────┘  └───────────────┘  └────────────┘│
│         │                │                  │        │
│  ┌──────▼──────┐  ┌─────▼──────┐  ┌───────▼──────┐ │
│  │  Shadow AI  │  │  Hunting   │  │  Alert       │ │
│  │  Usage      │  │  Query     │  │  Correlator  │ │
│  │  Detector   │  │  Engine    │  │              │ │
│  └─────────────┘  └────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────┘
         ▲                ▲               │
    ┌────┴────┐    ┌─────┴──────┐   ┌────▼────┐
    │Existing │    │ Existing   │   │ NATS    │
    │Identity │    │ Shadow     │   │EventBus │
    │Access   │    │ Data       │   └─────────┘
    │Service  │    │ Service    │
    └─────────┘    └────────────┘
```

**Approach:** New `threat-hunting` module that consumes data from existing services and adds behavioral analysis.

### 5.3 Schema Changes

```prisma
model ThreatHunt {
  id              String   @id @default(uuid())
  tenantId        String
  huntType        String   // abnormal_access, suspicious_export, credential_misuse, shadow_ai, data_hoarding
  status          String   @default("active") // active, completed, archived
  query           Json     // hunt parameters
  findings        Json?    // [{ type, entity, evidence, severity, confidence }]
  findingsCount   Int      @default(0)
  scheduledBy     String?  // null = system-initiated
  startedAt       DateTime @default(now())
  completedAt     DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, huntType])
  @@index([tenantId, status])
}

model ThreatIndicator {
  id              String   @id @default(uuid())
  tenantId        String
  indicatorType   String   // access_anomaly, export_spike, credential_abuse, shadow_ai_usage, permission_escalation
  entityType      String   // identity, asset, vendor
  entityId        String
  severity        String   // critical, high, medium, low
  confidence      Float
  evidence        Json     // { baseline, observed, deviation, samples[] }
  status          String   @default("open") // open, investigating, confirmed, false_positive, resolved
  correlatedWith  String[] // other indicator IDs
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status, severity])
  @@index([tenantId, entityType, entityId])
}

model AccessBaseline {
  id              String   @id @default(uuid())
  tenantId        String
  entityType      String   // identity, asset
  entityId        String
  baselineData    Json     // { avgDailyAccess, peakAccess, typicalHours, typicalSources }
  calculatedAt    DateTime @default(now())
  validUntil      DateTime

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, entityType, entityId])
}
```

### 5.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/threat-hunting/hunts` | `threat-hunting:admin` | Start a threat hunt |
| GET | `/threat-hunting/hunts` | `threat-hunting:read` | List hunts |
| GET | `/threat-hunting/hunts/:id` | `threat-hunting:read` | Get hunt results |
| GET | `/threat-hunting/indicators` | `threat-hunting:read` | List threat indicators |
| PATCH | `/threat-hunting/indicators/:id` | `threat-hunting:admin` | Update indicator status |
| POST | `/threat-hunting/detect` | `threat-hunting:admin` | Run full detection cycle |
| GET | `/threat-hunting/baselines` | `threat-hunting:read` | View access baselines |

### 5.5 Services to Modify
- None — reads from existing services via dependency injection

### 5.6 New Services Required
- `ThreatHuntingModule` (new module)
- `ThreatHuntingService` — orchestrates hunts, manages lifecycle
- `AccessPatternAnalyzer` — detects abnormal access using baselines
- `ExportMonitorService` — detects suspicious data exports
- `ShadowAiDetector` — identifies unauthorized AI usage of enterprise data
- `AlertCorrelator` — links related indicators into incident candidates

### 5.7 Migration Impact
- 3 new tables, 1 new module
- Consumes events: `finding.created`, `risk.score.changed`, `remediation.proposed`

### 5.8 Risks & Assumptions
- Baseline calculation requires historical data — cold start period needed
- False positive rate may be high initially — needs tuning mechanism

---

## MODULE 6: AI GOVERNANCE INTELLIGENCE

### 6.1 Existing Implementation Review
- `AiGovernanceService` already exists with 7 methods: CRUD for AI systems, dataset usage tracking, compliance reporting
- `AiSystem` model tracks risk categories (unacceptable/high/limited/minimal)
- `AiDatasetUsage` tracks training/validation/inference/fine-tuning usage
- `AiRecommendation` model stores AI-generated insights
- `DataGraphEdge` already supports `USED_BY_AI` relationship type
- Missing: lineage tracking for AI models, automated risk classification, regulatory mapping

### 6.2 Upgrade Architecture

**Approach:** Extend existing `ai-governance` module with new methods and a companion intelligence service.

### 6.3 Schema Changes

```prisma
model AiModelLineage {
  id              String   @id @default(uuid())
  tenantId        String
  aiSystemId      String
  version         String
  parentModelId   String?  // for fine-tuned models
  trainingDatasets Json     // [{ datasetId, assetId, recordCount, dateRange }]
  trainingConfig  Json?    // hyperparameters, training methodology
  evaluationMetrics Json?  // accuracy, bias metrics, fairness scores
  deploymentStatus String  @default("development") // development, staging, production, deprecated, retired
  deployedAt      DateTime?
  retiredAt       DateTime?
  createdAt       DateTime @default(now())

  aiSystem        AiSystem @relation(fields: [aiSystemId], references: [id])
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, aiSystemId])
  @@index([tenantId, deploymentStatus])
}

model AiRiskAssessment {
  id                String   @id @default(uuid())
  tenantId          String
  aiSystemId        String
  assessmentType    String   // automated, manual, regulatory
  riskCategory      String   // unacceptable, high, limited, minimal
  riskFactors       Json     // [{ factor, score, evidence }]
  regulatoryMapping Json     // { euAiAct: "high-risk", gdpr: "automated-decision" }
  dataProtectionImpact Json  // { piiExposure, consentCoverage, retentionCompliance }
  overallScore      Float
  recommendations   Json     // [{ action, priority, rationale }]
  assessedAt        DateTime @default(now())
  nextReviewDate    DateTime?

  aiSystem          AiSystem @relation(fields: [aiSystemId], references: [id])
  tenant            Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, aiSystemId])
  @@index([tenantId, riskCategory])
}

// ADD COLUMNS to existing AiSystem:
// lineageTracked    Boolean  @default(false)
// lastRiskAssessment DateTime?
// regulatoryStatus  String?  // compliant, non_compliant, under_review, exempt
```

### 6.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/ai-governance/systems/:id/lineage` | `ai-governance:admin` | Record model lineage |
| GET | `/ai-governance/systems/:id/lineage` | `ai-governance:read` | Get model lineage |
| POST | `/ai-governance/systems/:id/risk-assessment` | `ai-governance:admin` | Run AI risk assessment |
| GET | `/ai-governance/risk-assessments` | `ai-governance:read` | List all risk assessments |
| GET | `/ai-governance/regulatory-map` | `ai-governance:read` | Cross-regulation AI mapping |
| GET | `/ai-governance/sensitive-data-usage` | `ai-governance:read` | Audit sensitive data in AI |

### 6.5 Services to Modify
- `AiGovernanceService` — add `getModelLineage()`, `runRiskAssessment()`, `getSensitiveDataUsage()`, `getRegulatoryMap()`

### 6.6 New Services Required
- `AiRiskClassifier` (in existing `ai-governance` module) — automated risk classification
- `AiLineageTracker` (in existing `ai-governance` module) — tracks model versioning and provenance

### 6.7 Migration Impact
- 2 new tables, 3 new columns on `AiSystem`
- Extends existing module — no new module registration needed

### 6.8 Risks & Assumptions
- EU AI Act classification criteria may evolve — must be configurable
- Model lineage depends on manual or connector-based input

---

## MODULE 7: PREDICTIVE DATA RISK ENGINE

### 7.1 Existing Implementation Review
- `DspmService.getRiskTrends()` provides basic historical analysis
- `EntityRiskProfile` stores point-in-time composite scores
- `ShadowDataAlert` tracks growth of unmanaged data
- `VendorAssessment` captures vendor risk snapshots
- No forecasting or predictive analytics exist

### 7.2 Upgrade Architecture

**Approach:** Add `PredictiveRiskService` to the existing `dspm` module. Closely related to Module 2 and shares infrastructure.

### 7.3 Schema Changes

```prisma
model RiskForecast {
  id              String   @id @default(uuid())
  tenantId        String
  forecastType    String   // shadow_data_growth, vendor_exposure, access_risk, governance_gap
  timeHorizon     String   // 30d, 60d, 90d
  currentValue    Float
  forecastedValue Float
  confidence      Float
  trend           String   // accelerating, linear, decelerating, stable
  riskFactors     Json     // [{ name, contribution, trend }]
  recommendations Json     // [{ action, impact, urgency }]
  generatedAt     DateTime @default(now())
  expiresAt       DateTime

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, forecastType])
  @@index([tenantId, expiresAt])
}
```

### 7.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/dspm/predictive/forecasts` | `dspm:read` | Get all risk forecasts |
| POST | `/dspm/predictive/generate` | `dspm:admin` | Generate new forecasts |
| GET | `/dspm/predictive/shadow-data-growth` | `dspm:read` | Shadow data growth forecast |
| GET | `/dspm/predictive/vendor-exposure` | `dspm:read` | Vendor exposure forecast |
| GET | `/dspm/predictive/governance-gaps` | `dspm:read` | Governance gap predictions |

### 7.5 Services to Modify
- `DspmService` — add `getPredictiveSummary()` delegation method

### 7.6 New Services Required
- `PredictiveRiskService` (in existing `dspm` module)
  - `generateForecasts(tenantId)` — run all prediction models
  - `forecastShadowDataGrowth(tenantId)` — trend shadow data alerts
  - `forecastVendorExposure(tenantId)` — trend vendor risk scores
  - `forecastAccessRisk(tenantId)` — trend excessive/inactive access
  - `forecastGovernanceGaps(tenantId)` — predict uncovered datasets

### 7.7 Migration Impact
- 1 new table, no existing table changes

### 7.8 Risks & Assumptions
- Requires minimum 30-60 days of historical data for meaningful forecasts
- Predictions are statistical extrapolations — must be clearly labeled

---

## MODULE 8: SECURITY KNOWLEDGE GRAPH EXPANSION

### 8.1 Existing Implementation Review
- `DataGraphService` manages nodes and edges with BFS path finding
- Node types: asset, dataset, column, identity, vendor, ai_system, processing_activity, retention_policy
- Edge types: CONTAINS, STORED_IN, ACCESSIBLE_BY, OWNED_BY, SHARED_WITH, USED_BY_AI, GOVERNED_BY
- `DataGraphNode` has metadata JSON for extensibility
- `DataGraphEdge` has confidence scoring
- Missing: attack vector nodes, risk signal nodes, temporal edges, graph analytics

### 8.2 Upgrade Architecture

**Approach:** Extend the existing `data-graph` module with new node types, edge types, and analytics.

### 8.3 Schema Changes

```prisma
// NEW node types (string enum, no migration needed):
// "attack_vector", "risk_signal", "control", "regulation",
// "incident", "threat_indicator", "data_flow"

// NEW edge types (string enum, no migration needed):
// "DERIVED_FROM", "EXPOSED_TO", "CONTROLLED_BY_POLICY",
// "MITIGATED_BY", "TRIGGERED_BY", "FLOWS_TO", "IMPACTS"

model GraphAnalyticsResult {
  id              String   @id @default(uuid())
  tenantId        String
  analysisType    String   // centrality, clustering, risk_propagation, impact_radius
  parameters      Json
  results         Json
  nodeCount       Int
  edgeCount       Int
  computedAt      DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, analysisType])
}
```

### 8.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/data-graph/enrich` | `data-graph:admin` | Enrich graph with risk/attack/control nodes |
| GET | `/data-graph/analytics/centrality` | `data-graph:read` | Node centrality analysis |
| GET | `/data-graph/analytics/risk-propagation/:nodeId` | `data-graph:read` | Risk propagation from node |
| GET | `/data-graph/analytics/impact-radius/:nodeId` | `data-graph:read` | Impact radius analysis |
| GET | `/data-graph/analytics/clusters` | `data-graph:read` | Graph clustering |
| POST | `/data-graph/sync` | `data-graph:admin` | Sync all entities into graph |

### 8.5 Services to Modify
- `DataGraphService` — add new node/edge type constants, `enrichGraph()`, `syncAllEntities()`

### 8.6 New Services Required
- `GraphAnalyticsService` (in existing `data-graph` module)
  - `computeCentrality(tenantId)` — identify most connected/critical nodes
  - `computeRiskPropagation(tenantId, nodeId)` — how risk spreads from a node
  - `computeImpactRadius(tenantId, nodeId)` — blast radius of a compromise
  - `computeClusters(tenantId)` — identify tightly-coupled clusters
- `GraphEnrichmentService` (in existing `data-graph` module)
  - `enrichWithRiskSignals(tenantId)` — create nodes for active risk findings
  - `enrichWithAttackVectors(tenantId)` — create nodes for known attack paths
  - `enrichWithControls(tenantId)` — create nodes for compliance controls
  - `syncEntities(tenantId)` — ensure all entities have graph representation

### 8.7 Migration Impact
- 1 new table, no existing table changes (node/edge types are strings)

### 8.8 Risks & Assumptions
- Graph analytics on large tenants may be expensive — implement caching and async
- Graph must stay in sync with entity changes — event listeners needed

---

## MODULE 9: AI-DRIVEN COMPLIANCE ADVISOR

### 9.1 Existing Implementation Review
- `ComplianceService` has `detectGaps()`, `autoCollectEvidence()`, `mapCrossRegulation()`, `importFramework()`
- `Regulation`, `Obligation`, `Control`, `ObligationControl`, `ControlGap` models exist
- `ComplianceFramework` supports system and custom frameworks
- GDPR, DPDP, ISO 27701, NIST already loaded
- Missing: AI-driven control mapping, automated gap remediation, NL compliance queries

### 9.2 Upgrade Architecture

**Approach:** Add `ComplianceAdvisorService` to the existing `compliance` module.

### 9.3 Schema Changes

```prisma
model ComplianceAdvice {
  id              String   @id @default(uuid())
  tenantId        String
  regulationId    String?
  adviceType      String   // gap_remediation, control_recommendation, evidence_suggestion, interpretation
  context         Json     // { question?, gapId?, controlId?, datasetIds? }
  advice          String
  citations       Json     // [{ source, article, text }]
  confidence      Float
  status          String   @default("active") // active, applied, dismissed
  appliedActions  Json?
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, adviceType])
  @@index([tenantId, regulationId])
}

model ControlMapping {
  id              String   @id @default(uuid())
  tenantId        String
  sourceFramework String
  sourceControlId String
  targetFramework String
  targetControlId String
  mappingType     String   // exact, partial, related
  confidence      Float
  aiGenerated     Boolean  @default(false)
  verifiedBy      String?
  verifiedAt      DateTime?
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, sourceFramework, sourceControlId, targetFramework, targetControlId])
  @@index([tenantId, sourceFramework])
}
```

### 9.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/compliance/advisor/ask` | `compliance:read` | Ask compliance question |
| GET | `/compliance/advisor/gap-remediation/:gapId` | `compliance:read` | Get gap remediation advice |
| POST | `/compliance/advisor/map-controls` | `compliance:admin` | AI cross-framework mapping |
| GET | `/compliance/advisor/control-mappings` | `compliance:read` | List control mappings |
| POST | `/compliance/advisor/assess-dataset/:assetId` | `compliance:read` | Assess dataset compliance |
| GET | `/compliance/advisor/history` | `compliance:read` | Advice history |

### 9.5 Services to Modify
- `ComplianceService` — add `getAdvisorSummary()` delegation method

### 9.6 New Services Required
- `ComplianceAdvisorService` (in existing `compliance` module)
  - `askComplianceQuestion(tenantId, question)` — NL compliance query
  - `adviseGapRemediation(tenantId, gapId)` — AI remediation for compliance gap
  - `generateControlMappings(tenantId, sourceFramework, targetFramework)` — cross-framework
  - `assessDatasetCompliance(tenantId, assetId)` — which regulations apply

### 9.7 Migration Impact
- 2 new tables, no existing table changes

### 9.8 Risks & Assumptions
- AI compliance advice must include disclaimers — not a substitute for legal counsel
- Cross-framework mappings need human verification for regulatory submissions

---

## MODULE 10: ADAPTIVE DATA PROTECTION POLICIES

### 10.1 Existing Implementation Review
- `RetentionPolicy` model with static rules
- `RetentionService.enforcePolicy()` applies policies
- `RiskScorer` produces risk scores but doesn't drive policy changes
- No dynamic/adaptive policy engine exists

### 10.2 Upgrade Architecture

**Approach:** New `adaptive-policies` module that monitors signals and adjusts protection policies dynamically.

### 10.3 Schema Changes

```prisma
model AdaptivePolicy {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  policyType      String   // access_control, encryption, retention, classification, monitoring
  triggerConditions Json    // [{ signal, operator, threshold }]
  actions         Json     // [{ actionType, parameters }]
  currentState    String   @default("inactive") // inactive, monitoring, triggered, enforcing, cooldown
  lastTriggeredAt DateTime?
  lastEvaluatedAt DateTime?
  triggerCount    Int      @default(0)
  isEnabled       Boolean  @default(true)
  cooldownMinutes Int      @default(60)
  requiresApproval Boolean @default(true)
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, policyType])
  @@index([tenantId, isEnabled])
}

model PolicyExecution {
  id              String   @id @default(uuid())
  tenantId        String
  policyId        String
  triggerSignals  Json
  actionsExecuted Json
  status          String   @default("pending") // pending, approved, executing, completed, failed, rejected
  approvedBy      String?
  approvedAt      DateTime?
  executedAt      DateTime?
  completedAt     DateTime?
  rollbackData    Json?

  policy          AdaptivePolicy @relation(fields: [policyId], references: [id])
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, policyId])
  @@index([tenantId, status])
}
```

### 10.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/adaptive-policies` | `policies:admin` | Create adaptive policy |
| GET | `/adaptive-policies` | `policies:read` | List policies |
| GET | `/adaptive-policies/:id` | `policies:read` | Get policy details |
| PATCH | `/adaptive-policies/:id` | `policies:admin` | Update policy |
| DELETE | `/adaptive-policies/:id` | `policies:admin` | Delete policy |
| POST | `/adaptive-policies/:id/evaluate` | `policies:admin` | Manually evaluate |
| GET | `/adaptive-policies/:id/executions` | `policies:read` | Execution history |
| POST | `/adaptive-policies/executions/:id/approve` | `policies:admin` | Approve execution |

### 10.5 Services to Modify
- None — consumes events from existing services

### 10.6 New Services Required
- `AdaptivePoliciesModule` (new module)
- `AdaptivePolicyService` — CRUD and lifecycle
- `PolicyEvaluationEngine` — evaluates triggers against current signals
- `PolicyExecutionService` — executes via existing RemediationService, RetentionService
- `SignalCollector` — gathers signals from risk scores, access patterns, threats

### 10.7 Migration Impact
- 2 new tables, 1 new module
- New permissions: `policies:read`, `policies:admin`

### 10.8 Risks & Assumptions
- Adaptive policies could cause cascading enforcement if not bounded
- Cooldown periods and approval gates are critical safety mechanisms

---

## MODULE 11: AI-DRIVEN INCIDENT RESPONSE

### 11.1 Existing Implementation Review
- `IncidentsService` has `detectBreach()`, `trackNotifications()`, `calculateDeadline()`
- `Incident` model tracks severity, personal data breach flag, forensic evidence
- `BreachDetectionRule` model exists for automated detection
- `WorkflowService.startBreachWorkflow()` orchestrates response
- Missing: AI classification, automated playbooks, impact analysis, containment

### 11.2 Upgrade Architecture

**Approach:** Extend existing `incidents` module with AI-powered analysis.

### 11.3 Schema Changes

```prisma
model IncidentPlaybook {
  id              String   @id @default(uuid())
  tenantId        String
  incidentId      String
  playbookType    String   // containment, investigation, notification, recovery
  steps           Json     // [{ order, action, target, status, executedAt, result }]
  aiGenerated     Boolean  @default(true)
  status          String   @default("proposed") // proposed, approved, executing, completed, paused
  approvedBy      String?
  approvedAt      DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  incident        Incident @relation(fields: [incidentId], references: [id])
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, incidentId])
  @@index([tenantId, status])
}

model IncidentImpactAnalysis {
  id                  String   @id @default(uuid())
  tenantId            String
  incidentId          String
  affectedAssetCount  Int
  affectedSubjectCount Int
  affectedVendorCount Int
  dataCategories      Json     // [{ category, recordCount }]
  jurisdictions       Json     // [{ jurisdiction, subjectCount, notificationRequired }]
  regulatoryImpact    Json     // [{ regulation, obligations[], deadlines[] }]
  businessImpact      Json     // { financialExposure, reputationalRisk, operationalImpact }
  containmentStatus   String   @default("uncontained")
  analyzedAt          DateTime @default(now())

  incident            Incident @relation(fields: [incidentId], references: [id])
  tenant              Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, incidentId])
}

// ADD COLUMNS to existing Incident:
// aiClassification    String?
// aiSeverityScore     Float?
// containmentStatus   String?
// playbookGenerated   Boolean  @default(false)
```

### 11.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/incidents/:id/ai-classify` | `incidents:admin` | AI incident classification |
| POST | `/incidents/:id/impact-analysis` | `incidents:admin` | Run impact analysis |
| GET | `/incidents/:id/impact` | `incidents:read` | Get impact analysis |
| POST | `/incidents/:id/playbook` | `incidents:admin` | Generate response playbook |
| GET | `/incidents/:id/playbook` | `incidents:read` | Get playbook |
| POST | `/incidents/:id/playbook/approve` | `incidents:admin` | Approve playbook |
| POST | `/incidents/:id/contain` | `incidents:admin` | Execute containment |

### 11.5 Services to Modify
- `IncidentsService` — add `getImpactAnalysis()`, `getPlaybook()` delegation methods

### 11.6 New Services Required
- `IncidentResponseAiService` (in existing `incidents` module)
  - `classifyIncident(tenantId, incidentId)` — AI classification and severity
  - `analyzeImpact(tenantId, incidentId)` — full blast radius via DataGraph
  - `generatePlaybook(tenantId, incidentId)` — response playbook
  - `executeContainment(tenantId, incidentId)` — automated containment

### 11.7 Migration Impact
- 2 new tables, 4 new columns on `Incident`

### 11.8 Risks & Assumptions
- Automated containment must have circuit breakers
- Impact analysis accuracy depends on DataGraph completeness

---

## MODULE 12: CONTINUOUS DATA SECURITY VALIDATION

### 12.1 Existing Implementation Review
- `AttackPathAnalyzer.analyzeAttackPaths()` performs static analysis
- `RemediationExecutorService.validate()` checks action executability
- `IdentityAccessService.buildMappings()` can re-scan access
- No continuous validation loop or posture scoring exists

### 12.2 Upgrade Architecture

**Approach:** New `security-validation` module for continuous posture validation.

### 12.3 Schema Changes

```prisma
model ValidationRun {
  id              String   @id @default(uuid())
  tenantId        String
  runType         String   // full, access_control, remediation_verify, attack_surface, compliance
  status          String   @default("pending") // pending, running, completed, failed
  testsTotal      Int      @default(0)
  testsPassed     Int      @default(0)
  testsFailed     Int      @default(0)
  testsSkipped    Int      @default(0)
  postureScore    Float?   // 0-100
  findings        Json?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, runType])
  @@index([tenantId, status])
}

model ValidationTest {
  id              String   @id @default(uuid())
  tenantId        String
  testName        String
  testCategory    String   // access_control, encryption, retention, classification, network
  testLogic       Json     // { check, target, expectedResult }
  isEnabled       Boolean  @default(true)
  lastResult      String?  // pass, fail, skip
  lastRunAt       DateTime?
  failCount       Int      @default(0)
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, testName])
  @@index([tenantId, testCategory])
}
```

### 12.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/security-validation/run` | `validation:admin` | Start validation run |
| GET | `/security-validation/runs` | `validation:read` | List runs |
| GET | `/security-validation/runs/:id` | `validation:read` | Get run results |
| GET | `/security-validation/posture` | `validation:read` | Current posture score |
| GET | `/security-validation/tests` | `validation:read` | List tests |
| POST | `/security-validation/tests` | `validation:admin` | Create custom test |
| PATCH | `/security-validation/tests/:id` | `validation:admin` | Update test |
| POST | `/security-validation/verify-remediation/:actionId` | `validation:admin` | Verify remediation |

### 12.5 Services to Modify
- None — consumes existing services

### 12.6 New Services Required
- `SecurityValidationModule` (new module)
- `SecurityValidationService` — orchestrates validation runs
- `PostureScorer` — computes posture from test results
- `AccessControlValidator` — validates access controls haven't drifted
- `RemediationVerifier` — confirms remediations are still effective
- `EncryptionValidator` — validates encryption of sensitive assets

### 12.7 Migration Impact
- 2 new tables, 1 new module
- New permissions: `validation:read`, `validation:admin`

### 12.8 Risks & Assumptions
- Continuous validation generates load — must be rate-limited
- Posture scoring weights need calibration per tenant

---

## MODULE 13: PLATFORM OBSERVABILITY & TELEMETRY

### 13.1 Existing Implementation Review
- `HealthModule` provides basic liveness checks
- `AuditLog` captures all mutations with timestamps
- No service-level metrics, connector health tracking, or performance telemetry

### 13.2 Upgrade Architecture

**Approach:** New `observability` module with metrics collection via NestJS interceptor.

### 13.3 Schema Changes

```prisma
model ServiceMetric {
  id              String   @id @default(uuid())
  tenantId        String?  // null = platform-level
  serviceName     String
  metricName      String   // request_count, error_count, latency_p50, latency_p95, latency_p99
  metricValue     Float
  tags            Json?
  recordedAt      DateTime @default(now())

  @@index([serviceName, metricName, recordedAt])
  @@index([tenantId, serviceName])
}

model ConnectorHealthLog {
  id              String   @id @default(uuid())
  tenantId        String
  dataSourceId    String
  healthStatus    String   // healthy, degraded, unhealthy, unreachable
  responseTimeMs  Int?
  errorMessage    String?
  checksPerformed Json
  checkedAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, dataSourceId])
  @@index([tenantId, healthStatus])
}

model PlatformAlert {
  id              String   @id @default(uuid())
  tenantId        String?
  alertType       String   // service_error, connector_failure, high_latency, queue_backlog, disk_usage
  severity        String   // critical, warning, info
  source          String
  message         String
  metadata        Json?
  status          String   @default("active") // active, acknowledged, resolved
  acknowledgedBy  String?
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())

  @@index([status, severity])
  @@index([tenantId, alertType])
}
```

### 13.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/observability/metrics` | `observability:read` | Get service metrics |
| GET | `/observability/connector-health` | `observability:read` | Connector health |
| GET | `/observability/alerts` | `observability:read` | Platform alerts |
| PATCH | `/observability/alerts/:id` | `observability:admin` | Acknowledge/resolve |
| GET | `/observability/dashboard` | `observability:read` | Telemetry dashboard |
| GET | `/observability/performance` | `observability:read` | Performance summary |

### 13.5 Services to Modify
- None — uses NestJS interceptors for automatic collection

### 13.6 New Services Required
- `ObservabilityModule` (new module)
- `MetricsCollectorService` — collects metrics via interceptor
- `ConnectorHealthService` — periodic health checks on data sources
- `PlatformAlertService` — generates alerts based on thresholds
- `TelemetryDashboardService` — aggregates for dashboard
- `MetricsInterceptor` — NestJS interceptor for latency/error tracking

### 13.7 Migration Impact
- 3 new tables, 1 new module
- New permissions: `observability:read`, `observability:admin`
- Global interceptor registration

### 13.8 Risks & Assumptions
- High-volume metrics can bloat DB — implement retention/rollup
- Interceptor must be lightweight (<1ms overhead)

---

## MODULE 14: AUTONOMOUS PLATFORM OPTIMIZATION

### 14.1 Existing Implementation Review
- `DataGraphService.findPaths()` uses BFS — no query optimization
- `RiskScorer` is deterministic — no self-tuning
- No resource usage tracking or performance profiling exists

### 14.2 Upgrade Architecture

**Approach:** New `platform-optimization` module that analyzes performance and suggests optimizations.

### 14.3 Schema Changes

```prisma
model OptimizationRecommendation {
  id              String   @id @default(uuid())
  tenantId        String?  // null = platform-level
  category        String   // query_performance, resource_usage, risk_scoring, scan_efficiency, index_suggestion
  target          String
  description     String
  currentMetric   Json
  expectedImprovement Json
  implementation  Json     // { type, steps[], autoApplicable }
  priority        String   // critical, high, medium, low
  status          String   @default("proposed") // proposed, approved, applied, rejected, reverted
  appliedAt       DateTime?
  appliedBy       String?
  result          Json?
  createdAt       DateTime @default(now())

  @@index([tenantId, category])
  @@index([status, priority])
}

model PerformanceBaseline {
  id              String   @id @default(uuid())
  serviceName     String
  operationName   String
  baselineLatencyMs Float
  baselineThroughput Float
  baselineErrorRate Float
  sampleSize      Int
  calculatedAt    DateTime @default(now())
  validUntil      DateTime

  @@unique([serviceName, operationName])
}
```

### 14.4 APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/platform-optimization/analyze` | `platform:admin` | Run optimization analysis |
| GET | `/platform-optimization/recommendations` | `platform:read` | List recommendations |
| POST | `/platform-optimization/recommendations/:id/apply` | `platform:admin` | Apply recommendation |
| POST | `/platform-optimization/recommendations/:id/revert` | `platform:admin` | Revert recommendation |
| GET | `/platform-optimization/baselines` | `platform:read` | View baselines |
| GET | `/platform-optimization/health-report` | `platform:read` | Platform health report |

### 14.5 Services to Modify
- None — reads metrics from observability module

### 14.6 New Services Required
- `PlatformOptimizationModule` (new module)
- `OptimizationAnalyzer` — generates recommendations from performance data
- `QueryOptimizer` — identifies slow queries and suggests indexes
- `ResourceAnalyzer` — monitors memory, CPU, queue depths
- `RiskScoringOptimizer` — suggests weight adjustments
- `ScanEfficiencyAnalyzer` — identifies redundant scans

### 14.7 Migration Impact
- 2 new tables, 1 new module
- New permissions: `platform:read`, `platform:admin`
- Depends on Module 13 (Observability) for metric data

### 14.8 Risks & Assumptions
- Auto-optimization could degrade performance — approval required
- Index suggestions need DBA review
- Risk scoring weight changes affect all tenants

---

## CROSS-MODULE INTEGRATION MAP

```
Module Dependencies (→ = depends on):

1.  Co-Pilot          → DataGraph, DSPM, Lineage, IdentityAccess, AttackPaths, Compliance, Vendors
2.  Risk Intelligence  → DSPM (RiskScorer), DataGraph, ShadowData, AttackPaths
3.  Remediation Agent  → Remediation, DSPM, Workflow, AttackPaths
4.  Attack Simulation  → AttackPaths (Analyzer), DataGraph, IdentityAccess
5.  Threat Hunting     → IdentityAccess, ShadowData, Discovery, EventBus
6.  AI Governance Intel → AiGovernance (existing), DataGraph, Compliance
7.  Predictive Risk    → DSPM, ShadowData, Vendors, IdentityAccess
8.  Knowledge Graph    → DataGraph (existing), all entity-producing modules
9.  Compliance Advisor → Compliance (existing), DataGraph, Classification
10. Adaptive Policies  → DSPM, Remediation, Retention, IdentityAccess, EventBus
11. Incident Response  → Incidents (existing), DataGraph, Remediation, Compliance
12. Security Validation→ AttackPaths, IdentityAccess, Remediation, Discovery
13. Observability      → All services (via interceptor), Connectors
14. Platform Optimize  → Observability (Module 13), DataGraph, DSPM
```

## RECOMMENDED IMPLEMENTATION ORDER

```
Phase 1 — Foundation (Modules 13, 8):
  Module 13: Platform Observability & Telemetry
  Module 8:  Security Knowledge Graph Expansion

Phase 2 — Intelligence Core (Modules 2, 7, 6):
  Module 2:  AI Risk Intelligence Engine
  Module 7:  Predictive Data Risk Engine
  Module 6:  AI Governance Intelligence

Phase 3 — AI Services (Modules 1, 9, 5):
  Module 1:  AI Security Co-Pilot
  Module 9:  AI-Driven Compliance Advisor
  Module 5:  Data Exposure Threat Hunting Engine

Phase 4 — Autonomous Operations (Modules 3, 4, 10):
  Module 3:  Autonomous Remediation Agent
  Module 4:  AI Attack Simulation Engine
  Module 10: Adaptive Data Protection Policies

Phase 5 — Validation & Optimization (Modules 11, 12, 14):
  Module 11: AI-Driven Incident Response
  Module 12: Continuous Data Security Validation
  Module 14: Autonomous Platform Optimization
```

## AGGREGATE IMPACT SUMMARY

| Category | Count |
|----------|-------|
| New Prisma models | 22 |
| Modified Prisma models (new columns) | 4 (EntityRiskProfile, RemediationAction, AiSystem, Incident) |
| New modules | 6 (co-pilot, threat-hunting, adaptive-policies, security-validation, observability, platform-optimization) |
| Extended modules | 8 (dspm, attack-paths, remediation, ai-governance, compliance, incidents, data-graph, dashboard) |
| New services | ~35 |
| New API endpoints | ~65 |
| New permission pairs | 12 (read/admin) |
| Existing services modified | ~10 (additive methods only) |
| Breaking changes | 0 |

## NEW PERMISSIONS REGISTRY

| Module | Permissions |
|--------|------------|
| Co-Pilot | `copilot:query`, `copilot:read` |
| Threat Hunting | `threat-hunting:read`, `threat-hunting:admin` |
| Adaptive Policies | `policies:read`, `policies:admin` |
| Security Validation | `validation:read`, `validation:admin` |
| Observability | `observability:read`, `observability:admin` |
| Platform Optimization | `platform:read`, `platform:admin` |

Existing permissions (`dspm:read/admin`, `attack-paths:read/admin`, `remediation:read/admin`, `ai-governance:read/admin`, `compliance:read/admin`, `incidents:read/admin`, `data-graph:read/admin`) are reused for extended functionality in their respective modules.

## EVENT BUS ADDITIONS

New event types on NATS JetStream (`privacyops.{eventType}`):

| Event | Publisher | Consumers |
|-------|-----------|-----------|
| `risk.prediction.generated` | Risk Intelligence | Co-Pilot, Adaptive Policies |
| `risk.anomaly.detected` | Risk Intelligence | Threat Hunting, Incident Response |
| `remediation.plan.generated` | Remediation Agent | Dashboard, Adaptive Policies |
| `attack.simulation.completed` | Attack Simulation | Co-Pilot, Security Validation |
| `threat.indicator.detected` | Threat Hunting | Incident Response, Adaptive Policies |
| `policy.triggered` | Adaptive Policies | Observability, Audit |
| `policy.executed` | Adaptive Policies | Observability, Audit |
| `incident.classified` | Incident Response | Co-Pilot, Dashboard |
| `incident.playbook.generated` | Incident Response | Dashboard |
| `validation.run.completed` | Security Validation | Dashboard, Observability |
| `optimization.recommended` | Platform Optimization | Observability |
| `graph.enriched` | Knowledge Graph | Co-Pilot, Risk Intelligence |
| `compliance.advice.generated` | Compliance Advisor | Dashboard |
| `ai.risk.assessed` | AI Governance | Risk Intelligence, Compliance |
