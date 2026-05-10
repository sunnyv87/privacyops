# TechD PrivacyOps -- NATS Event Bus Setup

## Overview

PrivacyOps uses NATS JetStream as the event bus for asynchronous inter-service communication. The implementation is in `apps/api/src/core/events/event-bus.service.ts` with consumers in `apps/api/src/core/events/event-consumers.service.ts`.

Key features:
- HMAC-SHA256 event signing for integrity verification
- Dead-letter queue (DLQ) with PII redaction
- Idempotency guard with 10-minute TTL
- Retry with exponential backoff (1s, 2s, 4s)
- Prometheus metrics for published, consumed, failed, and DLQ events

---

## 1. Infrastructure Setup

### Docker Compose (Development)

```yaml
# docker-compose.yml
nats:
  image: nats:2.10-alpine
  ports:
    - '4222:4222'   # Client connections
    - '8222:8222'   # HTTP monitoring
  command: -js -m 8222
```

The `-js` flag enables JetStream, and `-m 8222` enables the HTTP monitoring endpoint.

### Production NATS Cluster

```bash
# Deploy NATS with Helm
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm install nats nats/nats \
  --namespace messaging \
  --set nats.jetstream.enabled=true \
  --set nats.jetstream.memStorage.size=1Gi \
  --set nats.jetstream.fileStorage.size=10Gi \
  --set cluster.enabled=true \
  --set cluster.replicas=3 \
  --set auth.enabled=true \
  --set auth.token="<nats-auth-token>"
```

---

## 2. JetStream Stream Configuration

The `EventBusService` creates two streams on startup (`apps/api/src/core/events/event-bus.service.ts`):

### Primary Stream: PRIVACYOPS

```typescript
await jsm.streams.add({
  name: 'PRIVACYOPS',
  subjects: ['privacyops.>'],
  retention: 'limits',
  max_msgs: 1000000,
  max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
});
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| Retention | Limits | Drop oldest when limits hit |
| Max messages | 1,000,000 | Prevents unbounded growth |
| Max age | 7 days | Compliance window for event replay |
| Subjects | `privacyops.>` | Wildcard captures all platform events |

### Dead-Letter Queue Stream: PRIVACYOPS_DLQ

```typescript
await jsm.streams.add({
  name: 'PRIVACYOPS_DLQ',
  subjects: ['privacyops-dlq.>'],
  retention: 'limits',
  max_msgs: 100000,
  max_age: 30 * 24 * 60 * 60 * 1000000000, // 30 days in nanoseconds
});
```

DLQ events are retained for 30 days for forensic analysis.

---

## 3. Subject Hierarchy

All events follow the pattern `privacyops.<domain>.<action>`:

```
privacyops.scan.queued
privacyops.scan.completed
privacyops.scan.failed
privacyops.dsar.submitted
privacyops.dsar.completed
privacyops.dsar.overdue
privacyops.breach.detected
privacyops.breach.notified
privacyops.retention.expired
privacyops.retention.disposed
privacyops.vendor.assessment.completed
privacyops.compliance.gap.detected
privacyops.security.login_success
privacyops.security.login_failure
privacyops.security.unauthorized_access
privacyops.security.suspicious_activity
privacyops.security.rate_limit_exceeded
privacyops.security.bulk_deletion
privacyops.billing.subscription.created
privacyops.billing.usage.recorded
privacyops.connector.health.changed
privacyops.classification.completed
privacyops.remediation.executed
```

DLQ subjects mirror the primary subject:

```
privacyops-dlq.scan.completed
privacyops-dlq.dsar.submitted
```

---

## 4. Event Publishing

### PlatformEvent Interface

```typescript
export interface PlatformEvent {
  type: string;         // e.g., 'scan.completed'
  tenantId: string;     // REQUIRED -- validated before publish
  data: any;            // Event payload
  timestamp: Date;
  correlationId?: string;  // Auto-populated from request context
  eventId?: string;        // Auto-assigned UUID for idempotency
}
```

### Publishing an Event

```typescript
// Example from any NestJS service
@Injectable()
export class ScanService {
  constructor(private readonly eventBus: EventBusService) {}

  async completeScan(tenantId: string, scanJobId: string) {
    await this.eventBus.publish({
      type: 'scan.completed',
      tenantId,
      data: { scanJobId, assetsDiscovered: 150 },
      timestamp: new Date(),
    });
  }
}
```

### Validation Rules

The `publish()` method enforces:
1. **tenantId is required**: Missing or empty tenantId logs an error and drops the event
2. **eventId auto-generation**: If not provided, a UUID is generated for idempotency tracking
3. **correlationId propagation**: Auto-populated from `CorrelationIdMiddleware` for distributed tracing

---

## 5. HMAC Signing

When `EVENT_HMAC_SECRET` is set, every published event includes an `_hmac` field:

```typescript
// Publishing side
payload._hmac = createHmac('sha256', this.hmacSecret)
  .update(JSON.stringify({
    type: event.type,
    tenantId: event.tenantId,
    eventId: event.eventId,
  }))
  .digest('hex');

// Consumer side -- verify before processing
const expected = createHmac('sha256', this.hmacSecret)
  .update(JSON.stringify({
    type: event.type,
    tenantId: event.tenantId,
    eventId: event.eventId,
  }))
  .digest('hex');

if (payload._hmac !== expected) {
  logger.warn(`HMAC verification failed for event ${event.eventId}`);
  msg.ack();  // Ack to prevent infinite redelivery
  continue;   // Skip processing
}
```

The HMAC covers the event identity (type, tenant, ID) -- not the full payload -- to keep verification fast while preventing event spoofing.

---

## 6. Idempotency

The `EventBusService` maintains an in-memory idempotency cache:

```typescript
private processedEvents = new Map<string, number>();
private static readonly IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
```

Before processing, every consumer checks:

```typescript
isAlreadyProcessed(event: PlatformEvent): boolean {
  const eventId = event.eventId;
  if (!eventId) return false;
  if (this.processedEvents.has(eventId)) return true;
  this.processedEvents.set(eventId, Date.now());
  return false;
}
```

A cleanup timer runs every 60 seconds to purge expired entries:

```typescript
this.idempotencyCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - EventBusService.IDEMPOTENCY_TTL_MS;
  for (const [id, ts] of this.processedEvents) {
    if (ts < cutoff) this.processedEvents.delete(id);
  }
}, 60_000);
```

---

## 7. Retry with Exponential Backoff

Failed event handlers are retried up to 3 times with backoff delays of 1s, 2s, and 4s:

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

private async executeWithRetry(
  subject: string,
  handler: (event: PlatformEvent) => Promise<void>,
  event: PlatformEvent,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await handler(event);
      return;
    } catch (error) {
      if (attempt === MAX_RETRY_ATTEMPTS) throw error;
      const backoff = RETRY_BACKOFF_MS[attempt] ?? 4000;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}
```

After all retries are exhausted, the event is:
1. Acknowledged (to prevent infinite NATS redelivery)
2. Published to the DLQ stream
3. Counted in `event_failed_total` and `event_dlq_total` Prometheus metrics

---

## 8. Dead-Letter Queue

### DLQ Payload Structure

```json
{
  "originalSubject": "scan.completed",
  "event": {
    "type": "scan.completed",
    "tenantId": "uuid",
    "data": {
      "scanJobId": "uuid",
      "password": "[REDACTED]",
      "apiKey": "[REDACTED]"
    },
    "eventId": "uuid"
  },
  "error": "Connection timeout after 30000ms",
  "failedAt": "2026-05-10T14:30:00.000Z"
}
```

### PII Redaction in DLQ

Before publishing to the DLQ, sensitive fields are redacted:

```typescript
private static readonly DLQ_SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'apikey', 'api_key', 'credential',
  'ssn', 'credit_card', 'creditcard', 'accesstoken', 'access_token',
  'refreshtoken', 'refresh_token', 'privatekey', 'private_key',
]);
```

### Monitoring DLQ

```bash
# List DLQ stream info
nats stream info PRIVACYOPS_DLQ

# View DLQ messages
nats consumer sub PRIVACYOPS_DLQ dlq-inspector --last=10

# Count pending DLQ events
nats stream state PRIVACYOPS_DLQ
```

---

## 9. Consumer Groups (Durable Subscriptions)

Subscriptions use NATS durable consumers for load balancing:

```typescript
await this.js.subscribe(`privacyops.${subject}`, {
  durable_name: durableName,
});
```

Each consumer group processes events once, regardless of how many worker instances are running. Examples:

| Subject Pattern | Durable Name | Consumer |
|----------------|--------------|----------|
| `scan.completed` | `scan-classifier` | ClassificationService |
| `scan.queued` | `scan-worker` | ScanWorker |
| `security.*` | `security-auditor` | SecurityEventsService |
| `billing.*` | `usage-aggregator` | UsageEventConsumer |

---

## 10. Prometheus Metrics

The event bus publishes these metrics via `apps/api/src/core/telemetry/prometheus.service.ts`:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `event_published_total` | Counter | `event_type` | Total events published |
| `event_consumed_total` | Counter | `event_type` | Total events successfully consumed |
| `event_failed_total` | Counter | `event_type` | Events that failed all retries |
| `event_dlq_total` | Counter | `event_type` | Events sent to DLQ |
| `event_processing_duration_seconds` | Histogram | `event_type` | Event processing latency |

### Alert Rules

From `infra/helm/privacyops/templates/prometheus-rules.yaml`:

```yaml
- alert: EventConsumerFailure
  expr: increase(event_failed_total[10m]) > 5
  for: 1m
  labels:
    severity: warning

- alert: HighDeadLetterQueueCount
  expr: increase(event_dlq_total[30m]) > 10
  for: 1m
  labels:
    severity: critical
```

---

## 11. NATS Authentication

### Token Auth (Simple)

```bash
# Set in .env
NATS_TOKEN=<secure-token>
```

### User/Password Auth

```bash
NATS_USER=privacyops
NATS_PASS=<secure-password>
```

The `EventBusService` handles both modes:

```typescript
const connectOpts: any = { servers: natsUrl };
if (natsToken) {
  connectOpts.token = natsToken;
} else if (natsUser && natsPass) {
  connectOpts.user = natsUser;
  connectOpts.pass = natsPass;
}
this.connection = await connect(connectOpts);
```

### Graceful Shutdown

On module destroy, the NATS connection is closed and the idempotency cleanup timer is cleared:

```typescript
async onModuleDestroy() {
  if (this.idempotencyCleanupTimer) clearInterval(this.idempotencyCleanupTimer);
  await this.connection?.close();
}
```

---

## 12. NATS Monitoring

```bash
# Check NATS server health
curl http://localhost:8222/healthz

# View JetStream info
curl http://localhost:8222/jsz

# View stream details
curl http://localhost:8222/jsz?streams=true

# Prometheus scraping (configured in infra/prometheus/prometheus.yml)
# job_name: 'nats'
# metrics_path: /metrics
# targets: ['nats:8222']
```
