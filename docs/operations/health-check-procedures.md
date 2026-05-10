# TechD PrivacyOps + DSPM Platform -- Health Check Procedures

**Owner:** Platform Engineering Team
**Review Cycle:** Monthly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Overview

This document defines health check procedures for every layer of the TechD PrivacyOps platform. Health checks are used for Kubernetes readiness/liveness probes, automated monitoring, daily operations, and incident diagnostics.

---

## 2. API Health Endpoint

### 2.1 Primary Health Check

**Endpoint:** `GET /health`
**Authentication:** None (public endpoint for load balancer probes)
**Expected Response (200 OK):**

```json
{
  "status": "ok",
  "version": "2.14.3",
  "uptime": 345612,
  "timestamp": "2026-05-10T08:30:00.000Z",
  "subsystems": {
    "database": "ok",
    "redis": "ok",
    "nats": "ok",
    "temporal": "ok"
  }
}
```

**Degraded Response (200 with warnings):**

```json
{
  "status": "degraded",
  "version": "2.14.3",
  "uptime": 345612,
  "timestamp": "2026-05-10T08:30:00.000Z",
  "subsystems": {
    "database": "ok",
    "redis": "ok",
    "nats": "degraded",
    "temporal": "ok"
  },
  "warnings": ["NATS consumer lag exceeds threshold"]
}
```

**Failure Response (503 Service Unavailable):**
Returned when any critical subsystem (database, redis) is unreachable.

### 2.2 Deep Health Check

**Endpoint:** `GET /health/deep`
**Authentication:** Admin JWT required (passes through 7-layer auth guard)
**Purpose:** Full subsystem validation including write tests

```json
{
  "status": "ok",
  "checks": {
    "database_read": { "status": "ok", "latency_ms": 2 },
    "database_write": { "status": "ok", "latency_ms": 8 },
    "redis_read": { "status": "ok", "latency_ms": 1 },
    "redis_write": { "status": "ok", "latency_ms": 1 },
    "nats_publish": { "status": "ok", "latency_ms": 3 },
    "temporal_connection": { "status": "ok", "latency_ms": 12 },
    "prisma_pool": { "active": 5, "idle": 15, "max": 20 },
    "bullmq_connection": { "status": "ok" },
    "audit_chain": { "status": "ok", "last_verified": "2026-05-10T08:00:00Z" }
  }
}
```

**Warning:** Do not use `/health/deep` for high-frequency probes. It performs write operations and should be called at most once per minute.

---

## 3. Database Connectivity (PostgreSQL + Prisma)

### 3.1 Connection Test

```bash
# Basic connectivity
psql -h $DB_HOST -U $DB_USER -d privacyops -c "SELECT 1 AS health;"

# Prisma pool status (via admin API)
curl -sf https://api.privacyops.techd.io/admin/db/pool-status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 3.2 Connection Pool Monitoring

```sql
-- Active connections by application
SELECT application_name, state, count(*)
FROM pg_stat_activity
WHERE datname = 'privacyops'
GROUP BY application_name, state
ORDER BY count DESC;

-- Waiting queries (lock contention)
SELECT count(*) AS waiting_queries
FROM pg_stat_activity
WHERE wait_event_type = 'Lock' AND datname = 'privacyops';

-- Advisory lock status (used by audit hash chain)
SELECT classid, objid, granted, pid
FROM pg_locks
WHERE locktype = 'advisory';
```

### 3.3 Replication Health (if replicas configured)

```sql
-- On primary
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS replication_lag
FROM pg_stat_replication;
```

**Thresholds:**
- Replication lag: warn at 1MB, critical at 10MB
- Replica state must be `streaming`

### 3.4 RLS Policy Verification

```sql
-- Verify RLS is enabled on tenant-scoped tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('scans', 'dsar_requests', 'remediation_actions',
                     'audit_logs', 'legal_holds', 'connectors')
ORDER BY tablename;
```

All listed tables must show `rowsecurity = true`. Any table with `false` is a P1 security issue.

---

## 4. Redis Availability

### 4.1 Connection and Ping

```bash
# Basic connectivity
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD ping
# Expected: PONG

# Latency test (100 samples)
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD --latency-history -i 1 | head -5
```

### 4.2 Memory Health

```bash
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD info memory
```

**Key metrics to check:**
| Metric                  | Healthy          | Warning          | Critical         |
|-------------------------|------------------|------------------|------------------|
| used_memory_human       | < 70% max        | 70-85% max       | > 85% max        |
| mem_fragmentation_ratio | 1.0 - 1.5        | 1.5 - 2.0        | > 2.0            |
| evicted_keys            | 0                | > 0              | Increasing trend |

### 4.3 BullMQ Queue Health via Redis

```bash
# List all BullMQ queues
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD keys "bull:*:id" | sed 's/:id$//' | sort -u

# For each queue, check job counts
for queue in scan dsar breach retention remediation; do
  echo "=== $queue ==="
  redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD hgetall "bull:${queue}:meta"
  echo "Waiting: $(redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD llen "bull:${queue}:wait")"
  echo "Active: $(redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD llen "bull:${queue}:active")"
  echo "Failed: $(redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD zcard "bull:${queue}:failed")"
done
```

### 4.4 Socket.IO Adapter Health

```bash
# Check Socket.IO Redis adapter keys (used for WebSocket cluster coordination)
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD keys "socket.io*" | wc -l
```

If no keys exist when WebSocket connections are expected, the Socket.IO Redis adapter may be disconnected.

---

## 5. NATS Cluster Status

### 5.1 Server Health

```bash
# NATS server info
nats server info

# Check JetStream status
nats account info

# Cluster membership (if clustered)
nats server list
```

### 5.2 Stream Health

```bash
# List all streams
nats stream ls

# Detailed stream status
nats stream info PRIVACYOPS_EVENTS

# Key metrics:
# - Messages: total count
# - Bytes: storage usage
# - Lost: should be 0
# - Consumers: should match expected count
```

### 5.3 Consumer Health

```bash
# Check each consumer for all streams
nats consumer ls PRIVACYOPS_EVENTS

# Per-consumer detail
for consumer in scan-processor dsar-handler breach-notifier retention-enforcer vendor-sync remediation-executor approval-processor deletion-handler; do
  echo "=== $consumer ==="
  nats consumer info PRIVACYOPS_EVENTS $consumer 2>/dev/null || echo "NOT FOUND"
done
```

**Consumer health indicators:**
- `num_pending = 0` and `last_activity` recent: Healthy
- `num_pending > 0` and `last_activity` recent: Busy but processing
- `num_pending > 0` and `last_activity` stale (> 5 min): Possibly stuck
- Consumer not found: Worker registration failed, investigate pods

### 5.4 HMAC Signing Validation

```bash
# Verify HMAC signing is active on published events
nats sub "privacyops.events.>" --count=3 --headers-only
# Look for: x-hmac-sha256 header present on every message
```

---

## 6. Temporal Server Health

### 6.1 Cluster Health

```bash
# Temporal cluster health
tctl cluster health
# Expected: SERVING

# Temporal namespace status
tctl namespace describe privacyops
```

### 6.2 Task Queue Pollers

Verify that workers are actively polling all 8 task queues:

```bash
for queue in SCAN DSAR BREACH RETENTION APPROVAL VENDOR REMEDIATION DATA_DELETION; do
  echo "=== $queue ==="
  tctl taskqueue describe -tq $queue | grep -A5 "pollers"
done
```

Each queue must have at least 1 active poller. Zero pollers means no workers are registered for that queue.

### 6.3 Workflow Execution Metrics

```bash
# Count running workflows by type
tctl workflow list --status RUNNING -o json | jq 'group_by(.type.name) | .[] | {type: .[0].type.name, count: length}'

# Check for timed-out activities
tctl workflow list --status RUNNING --query "CloseTime = missing AND StartTime < '$(date -d '2 hours ago' -u +%FT%TZ)'" -o json | jq length
```

---

## 7. Connector Connectivity Validation

### 7.1 Batch Health Check

```bash
# Trigger health check for all 43 registered connectors
curl -sf -X POST https://api.privacyops.techd.io/admin/connectors/health-check \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 7.2 Individual Connector Check

```bash
# Check a specific connector by ID
curl -sf https://api.privacyops.techd.io/admin/connectors/{connector_id}/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Connector health response:**

```json
{
  "connectorId": "uuid",
  "connectorType": "salesforce",
  "status": "healthy",
  "lastChecked": "2026-05-10T08:30:00Z",
  "authStatus": "valid",
  "tokenExpiry": "2026-06-10T00:00:00Z",
  "capabilities": ["scan", "remediate", "delete"],
  "latency_ms": 145
}
```

### 7.3 Connector Health Statuses

| Status       | Meaning                              | Action Required          |
|--------------|--------------------------------------|--------------------------|
| healthy      | Connectivity and auth working        | None                     |
| auth_expired | OAuth token or API key expired       | Re-authorize via UI      |
| unreachable  | Network connectivity failure         | Check DNS, firewall      |
| rate_limited | Provider rate limit hit              | Wait or request increase |
| degraded     | Partial functionality available      | Monitor, investigate     |
| disabled     | Manually disabled by admin           | Re-enable when ready     |

---

## 8. Automated Monitoring Setup

### 8.1 Kubernetes Probes

```yaml
# NestJS API deployment probe configuration
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 2
```

### 8.2 Prometheus Alert Rules

```yaml
groups:
  - name: privacyops-health
    rules:
      - alert: APIHealthCheckFailing
        expr: probe_success{job="privacyops-api"} == 0
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "PrivacyOps API health check failing"

      - alert: DatabaseConnectionPoolExhausted
        expr: privacyops_prisma_pool_active / privacyops_prisma_pool_max > 0.8
        for: 5m
        labels:
          severity: warning

      - alert: RedisMemoryCritical
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
        for: 5m
        labels:
          severity: critical

      - alert: NATSConsumerLagHigh
        expr: nats_consumer_num_pending > 5000
        for: 10m
        labels:
          severity: warning

      - alert: TemporalQueueNoPollers
        expr: temporal_task_queue_pollers == 0
        for: 5m
        labels:
          severity: critical

      - alert: AICopilotCircuitBreakerOpen
        expr: privacyops_ai_circuit_breaker_state == 2
        for: 1m
        labels:
          severity: warning

      - alert: AuditHashChainBroken
        expr: privacyops_audit_chain_verified == 0
        for: 0m
        labels:
          severity: critical

      - alert: BullMQFailedJobsHigh
        expr: privacyops_bullmq_failed_total > 50
        for: 15m
        labels:
          severity: warning

      - alert: ConnectorUnhealthyCount
        expr: privacyops_connectors_unhealthy > 5
        for: 10m
        labels:
          severity: warning
```

### 8.3 OpenTelemetry Health Signals

The platform exports traces via OTLP HTTP exporter. Verify the exporter is functioning:

```bash
# Check OpenTelemetry collector health
curl -sf http://otel-collector:13133/health | jq .

# Verify traces are being received
curl -sf http://jaeger:16686/api/services | jq '.data | length'
# Should include "privacyops-api" service
```

### 8.4 Grafana Dashboard Checklist

Ensure the following dashboards are operational:

| Dashboard               | Panels to Verify                                    |
|-------------------------|-----------------------------------------------------|
| Platform Overview       | Uptime, request rate, error rate, active tenants     |
| Database Health         | Connection pool, query latency, replication lag      |
| Redis Metrics           | Memory, connections, command rate, evictions          |
| NATS JetStream          | Consumer lag, message rate, DLQ depth                |
| Temporal Workflows      | Queue depth per task queue, workflow duration, failures|
| Auth Guard              | Rejection rate per layer, latency per guard          |
| Connector Status        | Health status matrix (43 connectors), auth expiry    |
| DSAR Pipeline           | Processing time, completion rate, SLA compliance     |
| AI Co-Pilot             | Circuit breaker state, redaction latency, failure rate|

---

## 9. Health Check Runbook Quick Reference

| Component          | Check Command                             | Healthy Response        | Frequency  |
|--------------------|-------------------------------------------|-------------------------|------------|
| API                | `GET /health`                             | `status: ok`            | 60s        |
| PostgreSQL         | `SELECT 1`                                | Returns 1               | 30s        |
| Redis              | `PING`                                    | `PONG`                  | 15s        |
| NATS               | `nats server info`                        | Connected               | 60s        |
| Temporal           | `tctl cluster health`                     | `SERVING`               | 60s        |
| BullMQ             | Check failed queue length                 | `failed < 10`           | 5 min      |
| Connectors         | `POST /admin/connectors/health-check`     | All healthy             | 15 min     |
| Audit chain        | `POST /admin/audit/verify-chain`          | Chain intact            | 1 hour     |
| AI co-pilot        | `GET /admin/ai-copilot/status`            | Breaker CLOSED          | 60s        |
| OTel collector     | `GET :13133/health`                       | Status OK               | 60s        |
