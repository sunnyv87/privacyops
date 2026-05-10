# TechD PrivacyOps -- Temporal Workflow Setup

## Overview

PrivacyOps uses Temporal 1.23 as the workflow orchestration engine for all long-running privacy operations. The platform runs 8 task queues, each backed by dedicated workflow definitions and activity implementations.

### Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/core/workflow/temporal.client.ts` | Temporal client (API process) |
| `apps/api/src/workers/temporal-worker.ts` | Worker bootstrap (separate process) |
| `apps/api/src/core/workflow/workflow.service.ts` | Workflow start/signal/query API |
| `apps/api/src/core/workflow/workflows/*.ts` | Workflow definitions |
| `apps/api/src/core/workflow/activities/*.ts` | Activity interfaces |
| `apps/api/src/workers/activity-implementations/*.ts` | Activity implementations |

---

## 1. Infrastructure Setup

### Docker Compose (Development)

```yaml
# docker-compose.yml
temporal:
  image: temporalio/auto-setup:1.23
  ports:
    - '7233:7233'
  environment:
    - DB=postgresql
    - DB_PORT=5432
    - POSTGRES_USER=privacyops
    - POSTGRES_PWD=privacyops_dev
    - POSTGRES_SEEDS=postgres
  depends_on:
    postgres:
      condition: service_healthy

temporal-ui:
  image: temporalio/ui:2.26.2
  ports:
    - '8233:8080'
  environment:
    - TEMPORAL_ADDRESS=temporal:7233
```

### Kubernetes (Production)

Deploy Temporal using the official Helm chart:

```bash
helm repo add temporal https://temporalio.github.io/helm-charts
helm install temporal temporal/temporal \
  --namespace temporal \
  --set server.config.persistence.default.driver=sql \
  --set server.config.persistence.default.sql.driver=postgres \
  --set server.config.persistence.default.sql.host=pg-primary.db.svc \
  --set server.config.persistence.default.sql.port=5432 \
  --set server.config.persistence.default.sql.database=temporal \
  --set server.config.persistence.default.sql.user=temporal \
  --set server.config.persistence.visibility.driver=sql \
  --set server.config.persistence.visibility.sql.driver=postgres \
  --set server.config.persistence.visibility.sql.database=temporal_visibility
```

---

## 2. Task Queues

The worker process (`apps/api/src/workers/temporal-worker.ts`) registers workers for 8 task queues:

| Queue | Workflow | Activities Source | Purpose |
|-------|----------|-------------------|---------|
| `scan-queue` | `scanWorkflow` | Inline in `temporal-worker.ts` | Data discovery, classification, risk scoring |
| `dsar-queue` | `dsarWorkflow` | `dsar.activities.impl.ts` | Data subject access requests |
| `breach-queue` | `breachWorkflow` | `breach.activities.impl.ts` | Breach response and notification |
| `retention-queue` | `retentionWorkflow` | `retention.activities.impl.ts` + `approval.activities.impl.ts` | Data retention enforcement |
| `approval-queue` | `dpiaApprovalWorkflow` | `approval.activities.impl.ts` | DPIA multi-level approvals |
| `vendor-queue` | `vendorReviewWorkflow` | `vendor.activities.impl.ts` | Vendor risk assessment |
| `remediation-queue` | `remediationWorkflow` | `approval.activities.impl.ts` | Remediation action execution |
| `data-deletion-queue` | `dataDeletionWorkflow` | `retention.activities.impl.ts` + `approval.activities.impl.ts` | Certified data deletion |

---

## 3. Workflow Definitions

### Scan Workflow

`apps/api/src/core/workflow/workflows/scan.workflow.ts`

```typescript
const { discoverAssets, classifyAsset, calculateRiskScore, notifyScanComplete } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 minutes',
    scheduleToCloseTimeout: '2 hours',
    heartbeatTimeout: '5 minutes',
    retry: { maximumAttempts: 3, backoffCoefficient: 2 },
  });

export async function scanWorkflow(input: ScanInput): Promise<ScanResult> {
  // 1. Discover assets from the data source
  const discoveredAssets = await discoverAssets(input);

  // 2. Classify and score in parallel batches (concurrency limit: 10)
  await parallelBatch(discoveredAssets, CONCURRENCY_LIMIT, async (assetId) => {
    await classifyAsset({ tenantId: input.tenantId, assetId });
    await calculateRiskScore({ tenantId: input.tenantId, assetId });
  });

  // 3. Notify completion
  await notifyScanComplete({ ... });
  return { assetsDiscovered: discoveredAssets.length, assetsClassified };
}
```

### DSAR Workflow

`apps/api/src/core/workflow/workflows/dsar.workflow.ts`

Steps: Identity verification -> Data collection from all sources -> Response generation -> SLA check -> Completion notification.

```typescript
const { verifyIdentity, collectData, generateResponse, notifyCompletion, notifyOverdue } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes',
    scheduleToCloseTimeout: '1 hour',
    heartbeatTimeout: '3 minutes',
    retry: { maximumAttempts: 3, backoffCoefficient: 2 },
  });
```

### Additional Workflows

| Workflow File | Key Steps |
|---------------|-----------|
| `breach.workflow.ts` | Detect -> Assess severity -> Notify DPA -> Notify subjects -> Generate report |
| `retention.workflow.ts` | Identify expired data -> Apply hold check -> Execute disposal -> Generate certificate |
| `dpia-approval.workflow.ts` | Submit assessment -> Route to approvers -> Await signal -> Record decision |
| `vendor-review.workflow.ts` | Questionnaire distribution -> Response collection -> Risk scoring -> Approval |
| `remediation.workflow.ts` | Plan -> Approve -> Execute actions -> Verify -> Close |
| `data-deletion.workflow.ts` | Verify no hold -> Approval gate -> Delete across sources -> Certify |

---

## 4. Worker Deployment

### Running the Worker

```bash
# Development
npx ts-node apps/api/src/workers/temporal-worker.ts

# Production (from built dist)
node dist/workers/temporal-worker.js
```

### Worker Architecture

The worker creates a NestJS application context (without HTTP server) to access all DI-injected services:

```typescript
// apps/api/src/workers/temporal-worker.ts
const app = await NestFactory.createApplicationContext(AppModule);
const discoveryService = app.get(DiscoveryService);
const classificationService = app.get(ClassificationService);
const dspmService = app.get(DspmService);
```

Activities are created using factory functions from `apps/api/src/workers/activity-implementations/`:

```typescript
const workerSpecs = [
  {
    taskQueue: 'dsar-queue',
    workflowsPath: require.resolve('../core/workflow/workflows/dsar.workflow'),
    activities: createDsarActivities(app),
  },
  // ... 6 more queues
];
```

### Worker Health Server

The worker exposes a minimal HTTP health server on `WORKER_HEALTH_PORT` (default 4001):

```
GET /health      -> 200 { "status": "ok", "worker": "temporal" }
GET /health/ready -> 200/503 based on whether all queue workers are initialized
```

This server starts before any Temporal connections, so Kubernetes can probe the pod during initialization.

### Isolated Failure Model

Each queue worker is created independently. If one fails, the others continue:

```typescript
for (const spec of workerSpecs) {
  try {
    const w = await Worker.create({ ... });
    extraWorkers.push(w);
  } catch (err) {
    logger.error(`Failed to register worker for ${spec.label}`);
    // Isolated failure -- continue with remaining workers.
  }
}
```

---

## 5. Activity Retry Policies

### Default Retry Configuration

```typescript
{
  maximumAttempts: 3,
  backoffCoefficient: 2,
  initialInterval: '1s',
  maximumInterval: '60s',
}
```

### Per-Activity Timeout Matrix

| Activity Type | Start-to-Close | Schedule-to-Close | Heartbeat |
|---------------|---------------|-------------------|-----------|
| Scan activities | 30 min | 2 hours | 5 min |
| DSAR activities | 10 min | 1 hour | 3 min |
| Breach activities | 10 min | 1 hour | 3 min |
| Approval activities | 5 min | 72 hours | -- |
| Retention activities | 15 min | 2 hours | 5 min |
| Vendor activities | 10 min | 1 hour | 3 min |

---

## 6. Signal Handling

Signals allow external input to influence running workflows. Defined in `apps/api/src/core/workflow/signals.ts`:

```typescript
// Example: DPIA approval signal
import { defineSignal } from '@temporalio/workflow';

export const approvalDecisionSignal = defineSignal<[{
  decision: 'approved' | 'rejected';
  approvedBy: string;
  comments?: string;
}]>('approvalDecision');
```

Signals are sent via `WorkflowService` from the API:

```typescript
// apps/api/src/core/workflow/workflow.service.ts
async sendApprovalDecision(workflowId: string, decision: ApprovalDecision) {
  const handle = this.temporal.client.workflow.getHandle(workflowId);
  await handle.signal(approvalDecisionSignal, decision);
}
```

The workflow uses `condition()` to wait for signals with a timeout:

```typescript
// In the workflow
const received = await condition(
  () => approvalResult !== undefined,
  '72h', // 72-hour approval SLA
);
if (!received) {
  // Auto-escalate on timeout
}
```

---

## 7. Workflow Versioning

Use Temporal's `patched()` API for backward-compatible changes:

```typescript
import { patched } from '@temporalio/workflow';

export async function scanWorkflow(input: ScanInput) {
  if (patched('v2-parallel-classify')) {
    // New behavior: parallel classification
    await parallelBatch(assets, CONCURRENCY_LIMIT, classifyAsset);
  } else {
    // Legacy: sequential classification
    for (const asset of assets) {
      await classifyAsset(asset);
    }
  }
}
```

### Search Attributes

Register custom search attributes for workflow queries:

```bash
# Register search attributes in the Temporal namespace
tctl --namespace privacyops search-attribute create \
  --name TenantId --type Keyword \
  --name WorkflowType --type Keyword \
  --name Priority --type Int \
  --name DueDate --type Datetime
```

Use in workflows:

```typescript
import { upsertSearchAttributes } from '@temporalio/workflow';

upsertSearchAttributes({
  TenantId: [input.tenantId],
  WorkflowType: ['scan'],
  Priority: [1],
});
```

Query workflows by tenant:

```bash
tctl --namespace privacyops workflow list \
  --query 'TenantId = "tenant-uuid" AND WorkflowType = "dsar"'
```

---

## 8. Real-Time Updates via WebSocket

The `WorkflowGateway` (`apps/api/src/core/workflow/workflow.gateway.ts`) uses Socket.IO to push workflow state changes to the frontend:

```
workflow.status.updated -> { workflowId, status, progress }
scan.progress           -> { scanJobId, assetsProcessed, total }
dsar.status.changed     -> { requestId, status }
```

---

## 9. Kubernetes Deployment

The worker runs as a separate Deployment (`infra/helm/privacyops/templates/worker-deployment.yaml`):

```yaml
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: worker
          image: ghcr.io/techd/privacyops-api:latest
          command: ["node", "dist/workers/temporal-worker.js"]
          env:
            - name: TEMPORAL_ADDRESS
              value: temporal-frontend.workflow.svc:7233
            - name: TEMPORAL_NAMESPACE
              value: privacyops
            - name: WORKER_HEALTH_PORT
              value: "4001"
          ports:
            - containerPort: 4001
              name: health
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4001
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 4001
            initialDelaySeconds: 20
            periodSeconds: 20
```

### Monitoring

Workflow metrics are exposed via Prometheus:

```
workflow_execution_duration_seconds{workflow_type="scan"}
workflow_errors_total{workflow_type="breach"}
workflow_active_count{workflow_type="dsar"}
```

Alert rules fire on:
- Workflow stuck beyond 24h SLA
- Breach workflow failure (critical -- regulatory SLA at risk)
- Error rate exceeding 5 failures per hour
