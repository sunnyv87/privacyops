# TechD PrivacyOps + DSPM Platform -- Log Analysis Guide

**Owner:** Platform Engineering Team
**Review Cycle:** Monthly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Overview

The TechD PrivacyOps platform uses structured JSON logging across all NestJS services with OpenTelemetry trace correlation. This guide covers log structure, common analysis patterns, audit log hash chain verification, and troubleshooting queries.

---

## 2. Log Format and Structure

### 2.1 Standard Log Entry

All application logs follow this structured JSON format:

```json
{
  "timestamp": "2026-05-10T08:30:15.234Z",
  "level": "info",
  "message": "Scan workflow completed",
  "service": "privacyops-api",
  "module": "ScanService",
  "traceId": "abc123def456789",
  "spanId": "span789012",
  "tenantId": "tenant_uuid",
  "userId": "user_uuid",
  "correlationId": "req_uuid",
  "metadata": {
    "connectorId": "connector_uuid",
    "connectorType": "salesforce",
    "scanId": "scan_uuid",
    "recordCount": 15234,
    "durationMs": 45200
  }
}
```

### 2.2 Structured Logging Fields

| Field           | Type     | Description                                      | Always Present |
|-----------------|----------|--------------------------------------------------|----------------|
| timestamp       | ISO 8601 | UTC timestamp of log event                       | Yes            |
| level           | string   | Log level: error, warn, info, debug, verbose     | Yes            |
| message         | string   | Human-readable log message                       | Yes            |
| service         | string   | Service name (e.g., privacyops-api)              | Yes            |
| module          | string   | NestJS module or service class name              | Yes            |
| traceId         | string   | OpenTelemetry trace ID (32 hex chars)            | Yes (if traced)|
| spanId          | string   | OpenTelemetry span ID (16 hex chars)             | Yes (if traced)|
| tenantId        | string   | Tenant UUID for multi-tenant context             | When available |
| userId          | string   | Authenticated user UUID                          | When available |
| correlationId   | string   | Request-scoped correlation ID                    | Per request    |
| metadata        | object   | Domain-specific structured data                  | Varies         |

### 2.3 Log Levels and Usage

| Level    | Usage                                                              | Volume    |
|----------|--------------------------------------------------------------------|-----------|
| error    | Unrecoverable failures, exceptions, circuit breaker trips          | Low       |
| warn     | Recoverable issues, retries, threshold approaches                  | Low-Med   |
| info     | Business events, workflow transitions, API requests                | Medium    |
| debug    | Detailed execution flow, query plans, connector interactions       | High      |
| verbose  | Wire-level data (sanitized), step-by-step processing               | Very High |

**Production default:** `info` level. Debug/verbose enabled per-module via environment variable `LOG_LEVEL_<MODULE>=debug`.

---

## 3. Trace Correlation via OpenTelemetry

### 3.1 Trace ID Propagation

Every inbound HTTP request generates an OpenTelemetry trace. The trace ID propagates through:

```
HTTP Request (traceId generated)
  -> 7-layer Auth Guard (spans per guard layer)
    -> NestJS Controller (span)
      -> Service Layer (span)
        -> Prisma Query (span)
        -> NATS Publish (traceId in message headers)
          -> NATS Consumer (continues trace)
            -> Temporal Workflow Start (traceId in workflow metadata)
              -> Temporal Activity (span)
                -> Connector IConnector call (span)
```

### 3.2 Cross-Service Trace Lookup

To follow a request across the entire platform:

```bash
# Find all logs for a specific trace
# In Kibana:
traceId: "abc123def456789"

# In Grafana Loki:
{service="privacyops-api"} | json | traceId="abc123def456789"

# In Jaeger UI:
# Search by trace ID directly in the Jaeger search bar
```

### 3.3 Linking Temporal Workflows to Traces

Temporal workflows store the originating trace ID in search attributes:

```bash
# Find the trace ID for a workflow
tctl workflow describe -w <workflow-id> -o json | jq '.searchAttributes.indexedFields.traceId'

# Then search logs by that trace ID
```

### 3.4 NATS Event Trace Headers

NATS messages carry trace context in headers:

```
x-trace-id: abc123def456789
x-span-id: span789012
x-hmac-sha256: <signature>
x-idempotency-key: <uuid>
x-tenant-id: <tenant-uuid>
```

---

## 4. Common Log Patterns

### 4.1 Successful Scan Lifecycle

```
INFO  [ScanService] Scan initiated | scanId=X tenantId=T connectorType=salesforce
INFO  [TemporalClient] Workflow started | workflowId=scan-X taskQueue=SCAN
INFO  [ScanWorker] Activity started: discoverSchema | scanId=X
INFO  [ScanWorker] Activity started: extractRecords | scanId=X
INFO  [ScanWorker] Activity started: classifyData | scanId=X
INFO  [ScanWorker] Activity started: persistResults | scanId=X
INFO  [NATSPublisher] Event published | subject=privacyops.events.scan.completed scanId=X
INFO  [ScanService] Scan workflow completed | scanId=X recordCount=15234 durationMs=45200
```

### 4.2 DSAR Processing Lifecycle

```
INFO  [DSARService] DSAR request received | dsarId=D tenantId=T subjectEmail=REDACTED
INFO  [TemporalClient] Workflow started | workflowId=dsar-D taskQueue=DSAR
INFO  [DSARWorker] Activity: identifyDataSources | dsarId=D connectorCount=12
INFO  [DSARWorker] Activity: extractSubjectData | dsarId=D connector=salesforce
INFO  [DSARWorker] Activity: extractSubjectData | dsarId=D connector=hubspot
...
INFO  [DSARWorker] Activity: applyPIIRedaction | dsarId=D
INFO  [AICoPliot] PII redaction completed | dsarId=D redactedFields=47
INFO  [DSARWorker] Activity: assembleResponse | dsarId=D
INFO  [DSARService] DSAR response ready for review | dsarId=D durationMs=86400000
```

### 4.3 Auth Guard Rejection

```
WARN  [AuthGuard:CSRF] CSRF token validation failed | ip=1.2.3.4
WARN  [AuthGuard:JWT] Token expired | userId=U tokenExp=2026-05-09T23:59:59Z
WARN  [AuthGuard:Tenant] Tenant mismatch | userId=U requestTenant=T1 userTenant=T2
WARN  [AuthGuard:Permissions] Insufficient permissions | userId=U required=scan:write has=scan:read
WARN  [AuthGuard:FeatureGate] Feature disabled | tenantId=T feature=advanced_remediation
WARN  [AuthGuard:ABAC] Policy evaluation denied | userId=U resource=connector action=delete
WARN  [AuthGuard:Approval] Pending approval required | userId=U action=data_deletion
```

### 4.4 Circuit Breaker State Transitions

```
WARN  [AICoPliot] Failure count increased | count=3 threshold=5 window=60s
ERROR [AICoPliot] Failure count increased | count=5 threshold=5 window=60s
ERROR [AICoPliot] Circuit breaker OPENED | reason="5 failures in 60s" failClosedActive=true
WARN  [AICoPliot] Circuit breaker HALF_OPEN | probing upstream
INFO  [AICoPliot] Circuit breaker CLOSED | upstream recovered
```

### 4.5 NATS DLQ Entry

```
ERROR [NATSConsumer] Message processing failed, sending to DLQ | subject=privacyops.events.scan.completed messageId=M error="Connector timeout" retryCount=3
WARN  [NATSConsumer] DLQ message published | dlqSubject=privacyops.dlq.scan.completed originalSubject=privacyops.events.scan.completed idempotencyKey=IK
```

---

## 5. Error Categorization

### 5.1 Error Taxonomy

| Category            | Log Pattern                                    | Severity | Typical Cause                    |
|---------------------|------------------------------------------------|----------|----------------------------------|
| AUTH_FAILURE         | `AuthGuard:*` rejection                       | Warn     | Expired tokens, misconfiguration |
| CONNECTOR_ERROR      | `IConnector.*error`                           | Error    | Upstream provider issue          |
| DB_ERROR             | `PrismaClientKnownRequestError`               | Error    | Constraint violation, timeout    |
| WORKFLOW_FAILURE     | `TemporalWorker.*failed`                      | Error    | Activity timeout, logic error    |
| NATS_ERROR           | `NATSConsumer.*failed`                        | Error    | Message processing failure       |
| REDACTION_ERROR      | `AICoPliot.*redaction.*failed`                | Critical | PII redaction pipeline broken    |
| RLS_VIOLATION        | `RLS policy violation`                        | Critical | Tenant isolation breach attempt  |
| HASH_CHAIN_ERROR     | `AuditService.*chain.*broken`                 | Critical | Audit log integrity failure      |
| BILLING_ERROR        | `BillingService.*NullBillingProvider`          | Critical | Production guard failure         |
| HMAC_ERROR           | `HMAC_VALIDATION_FAILED`                      | Error    | Event tampering or key mismatch  |
| REMEDIATION_ERROR    | `RemediationExecutor.*failed`                 | Error    | Action execution failure         |
| WEBSOCKET_ERROR      | `SocketIOAdapter.*disconnect`                 | Warn     | Client disconnect or Redis issue |

### 5.2 Critical Error Auto-Escalation

These log patterns trigger automatic PagerDuty alerts:

```
# In Prometheus alerting rules:
- pattern: "RLS policy violation" -> P1 alert
- pattern: "chain.*broken" -> P1 alert
- pattern: "NullBillingProvider.*production" -> P1 alert
- pattern: "redaction.*bypass" -> P1 alert
- pattern: "HMAC_VALIDATION_FAILED" (>10 in 5min) -> P2 alert
```

---

## 6. Log Search Queries for Common Issues

### 6.1 Kibana / Elasticsearch Queries

**Find all errors for a specific tenant in the last hour:**
```
level: "error" AND tenantId: "tenant_uuid" AND @timestamp >= now-1h
```

**Find failed scans by connector type:**
```
module: "ScanWorker" AND level: "error" AND metadata.connectorType: "salesforce"
```

**Find DSAR processing that exceeded SLA:**
```
module: "DSARService" AND message: "DSAR response ready" AND metadata.durationMs > 172800000
```

**Find auth guard rejections by guard layer:**
```
module: "AuthGuard:*" AND level: "warn" | stats count by module
```

**Find DLQ entries by source subject:**
```
module: "NATSConsumer" AND message: "DLQ message published" | stats count by metadata.originalSubject
```

**Find remediation failures by action type:**
```
module: "RemediationExecutor" AND level: "error" | stats count by metadata.actionType
```

### 6.2 Grafana Loki / LogQL Queries

**Error rate by module (last 15 min):**
```logql
sum by (module) (rate({service="privacyops-api"} | json | level="error" [15m]))
```

**DSAR processing duration distribution:**
```logql
{service="privacyops-api"} | json | module="DSARService" | message="DSAR response ready" | unwrap metadata_durationMs
```

**Auth guard rejection trend:**
```logql
sum by (module) (count_over_time({service="privacyops-api"} | json | module=~"AuthGuard:.*" | level="warn" [5m]))
```

---

## 7. Audit Log Hash Chain Verification

### 7.1 How the Hash Chain Works

Each audit log entry contains:
- `hash`: SHA256 hash of (previous_hash + entry_data)
- `previous_hash`: hash of the preceding entry
- `sequence`: monotonically increasing sequence number
- PostgreSQL advisory locks prevent concurrent writes that could break the chain

### 7.2 Automated Verification

```bash
# Via admin API
curl -sf -X POST https://api.privacyops.techd.io/admin/audit/verify-chain \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"since": "2026-05-09T00:00:00Z", "until": "2026-05-10T00:00:00Z"}' | jq .
```

**Successful response:**
```json
{
  "status": "valid",
  "entriesVerified": 48523,
  "firstEntry": { "sequence": 1000001, "timestamp": "2026-05-09T00:00:01Z" },
  "lastEntry": { "sequence": 1048523, "timestamp": "2026-05-09T23:59:58Z" },
  "verificationDurationMs": 12450
}
```

### 7.3 Manual Hash Chain Verification

```sql
-- Find broken chain links
WITH chain AS (
  SELECT
    id, sequence, hash, previous_hash,
    LAG(hash) OVER (ORDER BY sequence) AS expected_previous_hash
  FROM audit_logs
  WHERE created_at >= '2026-05-09' AND created_at < '2026-05-10'
  ORDER BY sequence
)
SELECT id, sequence, hash, previous_hash, expected_previous_hash
FROM chain
WHERE previous_hash != expected_previous_hash
  AND sequence > (SELECT MIN(sequence) FROM chain);
```

If this query returns rows, the hash chain is broken. Follow the P1 escalation procedure in the escalation matrix.

### 7.4 Advisory Lock Monitoring

```sql
-- Check if audit log advisory locks are functioning
SELECT * FROM pg_locks WHERE locktype = 'advisory' AND granted = true;

-- Check for advisory lock waits (potential contention)
SELECT * FROM pg_locks WHERE locktype = 'advisory' AND granted = false;
```

Advisory lock contention may cause audit log writes to queue, but should never cause chain breaks. If you see both lock contention and chain breaks, suspect a code-level concurrency bug.

---

## 8. Log Retention and Archival

| Log Type           | Hot Storage (Elasticsearch) | Warm Storage (S3) | Total Retention |
|--------------------|-----------------------------|--------------------|-----------------|
| Application logs   | 30 days                     | 90 days            | 120 days        |
| Audit logs         | 90 days                     | 7 years            | 7 years         |
| Security logs      | 90 days                     | 3 years            | 3 years         |
| Access logs        | 14 days                     | 90 days            | 104 days        |
| Debug/verbose logs | 7 days                      | Not archived       | 7 days          |

Audit logs are retained for 7 years to meet regulatory requirements (GDPR, SOX, HIPAA). Hash chain integrity must be maintained across the full retention period.

---

## 9. Sensitive Data in Logs

### 9.1 PII Redaction in Logs

The logging pipeline automatically redacts PII before writing:
- Email addresses are replaced with `REDACTED_EMAIL`
- IP addresses are hashed in non-security logs
- Request bodies containing PII fields are sanitized
- DSAR subject identifiers are always redacted

### 9.2 Fields That Must Never Appear in Logs

- `JWT_SECRET` or any signing keys
- `STRIPE_SECRET_KEY` or payment tokens
- Connector OAuth refresh tokens
- Database passwords
- NATS auth credentials
- Raw PII from data subjects

If you find any of these in logs, treat it as a P1 security incident and follow the secrets rotation procedure.
