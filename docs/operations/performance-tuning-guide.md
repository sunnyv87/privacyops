# TechD PrivacyOps + DSPM Platform -- Performance Tuning Guide

**Owner:** Platform Engineering Team
**Review Cycle:** Quarterly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Overview

This guide covers performance tuning for all layers of the TechD PrivacyOps platform. Tuning changes should be validated against k6 load test baselines before applying to production. Never tune in production without first testing in staging.

---

## 2. PostgreSQL Query Optimization

### 2.1 Identifying Slow Queries

```sql
-- Enable pg_stat_statements (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 queries by total execution time
SELECT
  substring(query, 1, 100) AS short_query,
  calls,
  total_exec_time::numeric(12,2) AS total_ms,
  mean_exec_time::numeric(12,2) AS mean_ms,
  max_exec_time::numeric(12,2) AS max_ms,
  rows
FROM pg_stat_statements
WHERE dbname = 'privacyops'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Queries with high mean execution time (potential index candidates)
SELECT
  substring(query, 1, 150) AS short_query,
  calls, mean_exec_time::numeric(12,2) AS mean_ms
FROM pg_stat_statements
WHERE dbname = 'privacyops' AND mean_exec_time > 100
ORDER BY mean_exec_time DESC;
```

### 2.2 Index Optimization for Common Patterns

The Prisma schema generates indexes, but these additional indexes optimize PrivacyOps-specific query patterns:

```sql
-- Optimize tenant-scoped queries (RLS policy evaluation)
CREATE INDEX CONCURRENTLY idx_scans_tenant_status ON scans(tenant_id, status) WHERE status != 'COMPLETED';
CREATE INDEX CONCURRENTLY idx_dsar_requests_tenant_created ON dsar_requests(tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_tenant_sequence ON audit_logs(tenant_id, sequence DESC);

-- Optimize hash chain verification (sequential scan pattern)
CREATE INDEX CONCURRENTLY idx_audit_logs_sequence_hash ON audit_logs(sequence, hash, previous_hash);

-- Optimize connector health queries
CREATE INDEX CONCURRENTLY idx_connectors_tenant_type_status ON connectors(tenant_id, connector_type, health_status);

-- Optimize remediation action lookups
CREATE INDEX CONCURRENTLY idx_remediation_actions_status_type ON remediation_actions(status, action_type) WHERE status = 'PENDING';
```

### 2.3 Query Plan Analysis

For any slow query identified via `pg_stat_statements`:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <query>;
```

**Red flags in query plans:**
- `Seq Scan` on large tables (> 100K rows) -- needs an index
- `Nested Loop` with high row estimates -- consider `Hash Join` via work_mem increase
- `Sort` with `external merge` -- increase `work_mem`
- `Bitmap Heap Scan` with high `lossy` blocks -- increase `effective_cache_size`

### 2.4 PostgreSQL Configuration Tuning

```ini
# postgresql.conf tuning for PrivacyOps workload
# Assuming 16GB RAM, 4 CPU cores dedicated to PostgreSQL

shared_buffers = 4GB                  # 25% of RAM
effective_cache_size = 12GB           # 75% of RAM
work_mem = 64MB                       # For complex DSAR aggregation queries
maintenance_work_mem = 1GB            # For VACUUM and index creation
wal_buffers = 64MB
max_connections = 200                 # Prisma pool (20) * API replicas (5) + overhead
random_page_cost = 1.1               # SSD storage
effective_io_concurrency = 200        # SSD storage
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

---

## 3. Connection Pooling (PgBouncer)

### 3.1 PgBouncer Configuration

PgBouncer sits between the NestJS API (Prisma) and PostgreSQL to manage connection pooling efficiently.

```ini
# pgbouncer.ini
[databases]
privacyops = host=postgres-primary port=5432 dbname=privacyops

[pgbouncer]
pool_mode = transaction           # Required for Prisma ORM compatibility
max_client_conn = 1000            # Total client connections accepted
default_pool_size = 25            # Connections per database per user
min_pool_size = 5                 # Minimum idle connections maintained
reserve_pool_size = 5             # Emergency connections
reserve_pool_timeout = 3          # Seconds before using reserve pool
server_idle_timeout = 300         # Close idle server connections after 5 min
server_lifetime = 3600            # Recycle connections every hour
query_timeout = 30                # Kill queries running > 30s
client_idle_timeout = 600         # Close idle clients after 10 min
```

### 3.2 Prisma Connection String for PgBouncer

```
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/privacyops?pgbouncer=true&connection_limit=20"
```

The `pgbouncer=true` flag tells Prisma to disable prepared statements (incompatible with transaction pooling mode). The `connection_limit=20` sets the Prisma-level pool size per API instance.

### 3.3 Monitoring PgBouncer

```bash
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "SHOW STATS;"
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "SHOW CLIENTS;" | grep -c active
```

---

## 4. Redis Memory Management

### 4.1 Memory Policy

```
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru      # Evict least recently used keys when full
```

### 4.2 Key Namespace Sizing

| Namespace           | Purpose                           | Expected Size | TTL     |
|---------------------|-----------------------------------|---------------|---------|
| `cache:*`           | API response caching              | 500MB         | 15 min  |
| `bull:*`            | BullMQ job queues and data        | 1GB           | Varies  |
| `socket.io:*`       | Socket.IO adapter state           | 100MB         | Session |
| `idempotency:*`     | NATS event deduplication          | 500MB         | 72 hrs  |
| `session:*`         | User session data                 | 200MB         | 24 hrs  |
| `ratelimit:*`       | API rate limiting counters        | 50MB          | 1 min   |

### 4.3 Memory Optimization Commands

```bash
# Analyze key distribution by namespace
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD --bigkeys

# Find large keys consuming disproportionate memory
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD --memkeys

# Check for keys without TTL (potential memory leak)
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD eval "
local cursor = '0'
local count = 0
repeat
  local result = redis.call('SCAN', cursor, 'COUNT', 1000)
  cursor = result[1]
  for _, key in ipairs(result[2]) do
    if redis.call('TTL', key) == -1 then
      count = count + 1
    end
  end
until cursor == '0'
return count
" 0
```

### 4.4 BullMQ Memory Optimization

```typescript
// Reduce BullMQ job data retention
const queueOptions = {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 1000 },  // Keep completed jobs 1hr or 1000 max
    removeOnFail: { age: 86400, count: 5000 },      // Keep failed jobs 24hr or 5000 max
  },
};
```

---

## 5. NATS JetStream Stream Tuning

### 5.1 Stream Configuration

```bash
# Optimize the main event stream
nats stream edit PRIVACYOPS_EVENTS \
  --max-msgs=10000000 \
  --max-bytes=10GB \
  --max-age=168h \
  --max-msg-size=1MB \
  --storage=file \
  --replicas=3 \
  --retention=limits \
  --discard=old \
  --dupe-window=72h
```

### 5.2 Consumer Tuning

```bash
# Optimize consumer batch size and acknowledgment
nats consumer edit PRIVACYOPS_EVENTS scan-processor \
  --max-pending=1000 \
  --max-deliver=5 \
  --ack-wait=30s \
  --filter="privacyops.events.scan.>"

# For high-throughput consumers (e.g., audit events)
nats consumer edit PRIVACYOPS_EVENTS audit-writer \
  --max-pending=5000 \
  --ack-wait=10s \
  --max-deliver=3
```

### 5.3 NATS Server Tuning

```
# nats-server.conf
max_payload: 1048576          # 1MB max message size
max_pending: 67108864         # 64MB max pending bytes per client
write_deadline: "10s"
jetstream {
  max_mem: 2G
  max_file: 50G
  store_dir: "/data/jetstream"
}
```

---

## 6. Temporal Worker Concurrency

### 6.1 Worker Configuration per Task Queue

```typescript
// Recommended worker concurrency settings per task queue
const workerConfigs = {
  SCAN: {
    maxConcurrentActivityExecutions: 10,    // CPU-bound: schema discovery, classification
    maxConcurrentWorkflowExecutions: 50,    // IO-bound: orchestration
    maxConcurrentLocalActivityExecutions: 5,
    stickyScheduleToStartTimeout: '10s',
  },
  DSAR: {
    maxConcurrentActivityExecutions: 5,     // Lower: PII redaction is memory-intensive
    maxConcurrentWorkflowExecutions: 20,
    maxConcurrentLocalActivityExecutions: 3,
  },
  BREACH: {
    maxConcurrentActivityExecutions: 3,     // Low volume, high priority
    maxConcurrentWorkflowExecutions: 10,
  },
  RETENTION: {
    maxConcurrentActivityExecutions: 15,    // Batch processing, IO-bound
    maxConcurrentWorkflowExecutions: 100,
  },
  APPROVAL: {
    maxConcurrentActivityExecutions: 5,     // Human-in-the-loop, low throughput
    maxConcurrentWorkflowExecutions: 50,
  },
  VENDOR: {
    maxConcurrentActivityExecutions: 8,     // External API calls, IO-bound
    maxConcurrentWorkflowExecutions: 30,
  },
  REMEDIATION: {
    maxConcurrentActivityExecutions: 8,     // 12 action types, mixed workload
    maxConcurrentWorkflowExecutions: 40,
  },
  DATA_DELETION: {
    maxConcurrentActivityExecutions: 3,     // Destructive: low concurrency for safety
    maxConcurrentWorkflowExecutions: 10,
  },
};
```

### 6.2 Scaling Workers

```bash
# Scale worker replicas per queue based on load
kubectl scale deployment temporal-worker-scan -n privacyops --replicas=3
kubectl scale deployment temporal-worker-dsar -n privacyops --replicas=2
kubectl scale deployment temporal-worker-remediation -n privacyops --replicas=2
```

**Horizontal scaling guidelines:**
- Scale workers before increasing per-worker concurrency
- Each worker replica should have dedicated CPU/memory resources
- Monitor Temporal's `schedule_to_start_latency` -- if increasing, add workers

---

## 7. BullMQ Concurrency Settings

### 7.1 Queue Worker Configuration

```typescript
// Per-queue concurrency (distinct from Temporal workers)
const bullWorkerConfigs = {
  'connector-sync': { concurrency: 10, limiter: { max: 50, duration: 60000 } },
  'email-notification': { concurrency: 5 },
  'report-generation': { concurrency: 3, limiter: { max: 10, duration: 60000 } },
  'webhook-delivery': { concurrency: 15, limiter: { max: 100, duration: 60000 } },
};
```

### 7.2 Rate Limiting

```typescript
// Global rate limiter to prevent overwhelming connectors
const rateLimiter = {
  max: 100,           // Max jobs processed
  duration: 60000,    // Per 60 seconds
};
```

---

## 8. Node.js Memory Limits

### 8.1 Kubernetes Resource Configuration

```yaml
# API service (NestJS)
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"

# Temporal workers (memory-intensive for DSAR/scan)
resources:
  requests:
    memory: "1Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "4000m"
```

### 8.2 Node.js Heap Configuration

```bash
# Set via environment variable in Kubernetes deployment
NODE_OPTIONS="--max-old-space-size=3584"  # 3.5GB for 4GB limit (leave room for non-heap)
```

### 8.3 Memory Leak Detection

```bash
# Generate heap snapshot (do NOT run in production without coordination)
kill -USR2 <pid>  # Triggers heapdump if node-heapdump is installed

# Monitor memory via Prometheus
# Alert rule: privacyops_nodejs_heap_used_bytes / privacyops_nodejs_heap_max_bytes > 0.9
```

**Common memory leak sources in PrivacyOps:**
- Unbounded event listeners on NATS subscriptions
- Large scan result sets held in memory during classification
- Socket.IO room accumulation without cleanup
- Prisma client instances not properly closed in Temporal activities

---

## 9. k6 Load Test Baseline Comparison

### 9.1 Running Baseline Tests

```bash
# Run all 5 scenarios
k6 run --out json=results/smoke-$(date +%F).json tests/k6/smoke.js
k6 run --out json=results/concurrent-scans-$(date +%F).json tests/k6/concurrent-scans.js
k6 run --out json=results/dsar-load-$(date +%F).json tests/k6/dsar-load.js
k6 run --out json=results/event-pipeline-$(date +%F).json tests/k6/event-pipeline.js
k6 run --out json=results/api-burst-$(date +%F).json tests/k6/api-burst.js
```

### 9.2 Baseline Thresholds

| Scenario          | Metric              | Baseline   | Warning (>15%) | Critical (>25%) |
|-------------------|---------------------|------------|----------------|-----------------|
| smoke             | http_req_duration P95| 200ms     | 230ms          | 250ms           |
| concurrent-scans  | scan_completion P95  | 45s       | 51.75s         | 56.25s          |
| dsar-load         | dsar_processing P95  | 120s      | 138s           | 150s            |
| event-pipeline    | event_throughput     | 5000/s    | 4250/s         | 3750/s          |
| api-burst         | http_req_failed      | < 0.1%    | > 0.5%         | > 1%            |

### 9.3 Comparison Script

```bash
# Compare current results against baseline
python3 scripts/k6-compare.py \
  --baseline results/baseline.json \
  --current results/smoke-$(date +%F).json \
  --threshold 15
```

### 9.4 Tuning Validation Workflow

1. Establish baseline with current configuration
2. Apply tuning change in staging
3. Run all 5 k6 scenarios
4. Compare against baseline
5. If all metrics within 15% improvement or no regression: proceed
6. If any metric degrades > 10%: investigate before proceeding
7. Apply to production during maintenance window
8. Run smoke test against production to confirm

---

## 10. OpenTelemetry Tracing Performance

### 10.1 Sampling Configuration

```typescript
// Reduce trace volume in production without losing visibility
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBased(0.1),  // Sample 10% of traces
});
```

### 10.2 OTLP Exporter Tuning

```typescript
const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: {},
  concurrencyLimit: 10,           // Max concurrent export requests
  timeoutMillis: 10000,           // 10s export timeout
});

const batchProcessor = new BatchSpanProcessor(exporter, {
  maxQueueSize: 2048,             // Max spans queued before dropping
  maxExportBatchSize: 512,        // Spans per export request
  scheduledDelayMillis: 5000,     // Export every 5s
  exportTimeoutMillis: 30000,     // 30s batch export timeout
});
```

High trace volume can degrade API performance. Monitor `privacyops_otel_spans_dropped` for evidence of backpressure.

---

## 11. Tuning Change Log

Maintain a record of all performance tuning changes:

| Date       | Component    | Change                         | Result           | Rollback Plan |
|------------|--------------|--------------------------------|------------------|----------------|
| YYYY-MM-DD | PostgreSQL   | Increased work_mem to 64MB     | P95 query -20ms  | Set to 32MB    |
| YYYY-MM-DD | SCAN workers | Scaled to 3 replicas           | Queue depth -40% | Scale to 2     |
| YYYY-MM-DD | Redis        | maxmemory to 4GB               | No evictions     | Set to 2GB     |

Always record the rollback procedure before applying a tuning change.
