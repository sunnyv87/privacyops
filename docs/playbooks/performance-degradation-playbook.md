# Performance Degradation Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-PERF-007
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / SRE Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `APILatencyP99High` -- NestJS API p99 latency exceeds 2 seconds for > 5 minutes
- Prometheus alert `APILatencyP50High` -- NestJS API p50 latency exceeds 500ms for > 10 minutes
- Prometheus alert `RedisMemoryPressure` -- Redis used_memory exceeds 80% of maxmemory
- Prometheus alert `PostgresSlowQueries` -- queries exceeding 5 seconds logged by pg_stat_statements
- Prometheus alert `NATSConsumerLag` -- JetStream consumer lag > 5,000 messages on any subject
- Prometheus alert `TemporalScheduleToStartLatency` -- activities waiting > 30 seconds before worker pickup
- OpenTelemetry trace duration anomaly detection -- spans exceeding 3x rolling p99
- BullMQ job processing time exceeding 2x baseline
- Socket.IO event delivery latency > 5 seconds (real-time updates delayed)
- k6 load test scenario regression -- throughput drops below baseline threshold

### Manual Detection
- Users report slow page loads or API timeouts
- DSAR processing times increasing beyond SLA thresholds
- Scan workflows taking significantly longer than historical averages

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | Platform-wide latency > 10x baseline; requests timing out; DSAR/Breach SLA breach imminent | Immediate |
| SEV-2 | Significant latency increase (3-10x); specific flows degraded (scans, DSAR, auth) | < 15 minutes |
| SEV-3 | Moderate latency increase (1.5-3x); single component degraded; no SLA impact | < 1 hour |
| SEV-4 | Minor latency increase; observed in monitoring but not customer-impacting | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Capture current performance baseline:**
   ```bash
   # Scrape current Prometheus metrics
   curl -s http://privacyops-api:9090/metrics | grep -E "http_request_duration|prisma_query_duration|nats_consumer_lag|bullmq_job_duration"

   # Check API response times
   for i in $(seq 1 5); do
     curl -o /dev/null -s -w "HTTP %{http_code} -- %{time_total}s\n" https://api.privacyops.techd.io/health
   done
   ```

2. **Identify the bottleneck layer:**
   ```bash
   # Check PostgreSQL query performance
   psql -h db-primary.internal -U privacyops_admin -c \
     "SELECT query, calls, mean_exec_time, max_exec_time, stddev_exec_time
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC LIMIT 20;"

   # Check Redis memory and latency
   redis-cli -h redis.internal INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation"
   redis-cli -h redis.internal --latency -i 1 --csv 2>&1 | head -5

   # Check NATS consumer lag
   nats consumer ls PRIVACYOPS_EVENTS --server nats://nats.internal:4222 2>&1

   # Check Temporal schedule-to-start latency
   for QUEUE in SCAN DSAR BREACH RETENTION APPROVAL VENDOR REMEDIATION DATA_DELETION; do
     echo "=== $QUEUE ==="
     tctl --ns privacyops-production task-queue describe -tq "$QUEUE" | grep -i "backlog\|rate"
   done
   ```

3. **Check infrastructure resource utilization:**
   ```bash
   # Pod CPU and memory
   kubectl top pods -l app=privacyops-api
   kubectl top pods -l app=privacyops-temporal-worker

   # Node resources
   kubectl top nodes
   ```

4. **Enable OpenTelemetry debug sampling** if trace data is insufficient:
   ```bash
   kubectl set env deployment/privacyops-api OTEL_TRACES_SAMPLER=parentbased_always_on
   # WARNING: Revert after investigation -- high sampling rate increases overhead
   ```

---

## 4. Investigation Steps

### Slow Query Identification (PostgreSQL)
```sql
-- Top slow queries with execution stats
SELECT
  queryid,
  LEFT(query, 200) AS query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(max_exec_time::numeric, 2) AS max_ms,
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'privacyops')
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check for sequential scans on large tables (missing indexes)
SELECT
  schemaname, relname, seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch,
  CASE WHEN seq_scan > 0 THEN seq_tup_read / seq_scan ELSE 0 END AS avg_seq_rows
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND schemaname = 'public'
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Check for lock contention (advisory locks used by hash chain audit)
SELECT
  pid, mode, locktype, relation::regclass, granted,
  query, state, wait_event_type, wait_event
FROM pg_locks l
JOIN pg_stat_activity a USING (pid)
WHERE NOT granted
ORDER BY a.query_start;

-- Check for bloated tables (dead tuples)
SELECT
  schemaname, relname,
  n_live_tup, n_dead_tup,
  ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) AS dead_pct,
  last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

### Prisma ORM Performance
```bash
# Check Prisma query logging for N+1 patterns
kubectl logs -l app=privacyops-api --since=10m | grep -i "prisma:query" | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# Check Prisma connection pool utilization
curl -s http://privacyops-api:9090/metrics | grep prisma_pool
```

### Redis Memory Pressure
```bash
# Detailed memory analysis
redis-cli -h redis.internal MEMORY DOCTOR

# Check key distribution by type
redis-cli -h redis.internal --bigkeys 2>&1 | tail -30

# Check BullMQ queue sizes (BullMQ stores jobs in Redis)
redis-cli -h redis.internal KEYS "bull:*" | while read key; do
  TYPE=$(redis-cli -h redis.internal TYPE "$key" | awk '{print $NF}')
  case $TYPE in
    list) SIZE=$(redis-cli -h redis.internal LLEN "$key") ;;
    set) SIZE=$(redis-cli -h redis.internal SCARD "$key") ;;
    zset) SIZE=$(redis-cli -h redis.internal ZCARD "$key") ;;
    hash) SIZE=$(redis-cli -h redis.internal HLEN "$key") ;;
    *) SIZE="N/A" ;;
  esac
  echo "$key ($TYPE): $SIZE"
done | sort -t: -k3 -rn | head -20

# Check for IORedis connection count
redis-cli -h redis.internal CLIENT LIST | wc -l
```

### NATS Consumer Lag Analysis
```bash
# Check per-consumer lag
nats consumer ls PRIVACYOPS_EVENTS --json --server nats://nats.internal:4222 | \
  jq '.[] | {name: .name, num_pending: .num_pending, num_ack_pending: .num_ack_pending}'

# Check stream message rate
nats stream info PRIVACYOPS_EVENTS --json | jq '{messages: .state.messages, bytes: .state.bytes, consumer_count: .state.consumer_count}'

# Check if HMAC signature verification is adding latency
kubectl logs -l app=privacyops-api --since=10m | grep -c "hmac.*verify"
```

### k6 Load Test Regression Analysis
```bash
# Run the k6 load test suite against staging to establish current baseline
# 5 scenarios are configured
k6 run --out json=k6_results.json /path/to/k6/load-tests.js

# Compare against stored baseline
# Look for:
# - http_req_duration p95 regression
# - http_req_failed rate increase
# - iterations rate decrease
# - vus_max threshold breaches
```

---

## 5. Resolution Steps

### Slow Query Resolution
1. **Add missing indexes:**
   ```sql
   -- Example: if tenant_id scans are slow on large tables
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_timestamp
     ON audit_logs (tenant_id, timestamp DESC);
   -- Use CONCURRENTLY to avoid locking the table
   ```
2. **Optimize Prisma queries** -- check for N+1 patterns and add `include`/`select` clauses.
3. **Run VACUUM on bloated tables:**
   ```sql
   VACUUM (VERBOSE, ANALYZE) audit_logs;
   ```
4. **Clear advisory lock contention** -- if hash chain audit writes are blocking:
   ```sql
   -- Identify and terminate long-held advisory locks
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes';
   ```

### Redis Memory Relief
1. **Evict expired BullMQ jobs:**
   ```bash
   # Clean completed/failed jobs older than 24 hours
   redis-cli -h redis.internal KEYS "bull:*:completed" | xargs -I{} redis-cli -h redis.internal ZREMRANGEBYSCORE {} 0 $(date -d '24 hours ago' +%s000)
   ```
2. **Increase maxmemory** if safe to do so.
3. **Review IORedis connection pooling** -- reduce connections per API pod if excessive.

### NATS Consumer Lag Recovery
1. **Scale consumers** for the lagging subject.
2. **Check for poison messages** in the DLQ causing redelivery loops.
3. **Restart consumers** with backoff if HMAC verification is causing CPU load.

### Temporal Worker Scaling
```bash
# Scale workers for backlogged queues
kubectl scale deployment/privacyops-temporal-worker --replicas=CURRENT+2

# If queue-specific, scale the dedicated worker pool
kubectl scale deployment/privacyops-temporal-worker-scan --replicas=CURRENT+2
```

### Emergency Traffic Shedding
- Enable rate limiting at the API gateway level for non-critical endpoints
- Pause scheduled scan workflows on the SCAN queue to reduce load
- Disable non-essential Socket.IO real-time updates to reduce WebSocket overhead
- Temporarily increase Temporal activity timeouts to prevent unnecessary retries

---

## 6. Communication Template

### Internal
```
PERFORMANCE DEGRADATION: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Impact: API p99 latency at [X]ms (baseline: [Y]ms) -- [Z]x increase
Bottleneck: [PostgreSQL / Redis / NATS / Temporal / Network / CPU]
Affected Flows: [Auth / Scans / DSAR / Breach / All]
Tenant Impact: [All tenants / Specific tenants / Internal only]
Status: [Investigating / Mitigating / Resolved]
IC: [Name]
```

### External
```
You may experience slower than usual response times on the PrivacyOps platform.
Our team has identified the cause and is implementing a fix.
Data processing jobs (scans, DSAR requests) may take longer to complete.
We expect normal performance to resume by [ESTIMATE].
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer begins performance investigation |
| 15 min | SRE team lead if bottleneck not identified |
| 30 min | Database team for PostgreSQL issues; Platform team for infrastructure |
| 1 hour | VP Engineering for SEV-1; Customer Success for tenant notifications |
| 2 hours | Cloud provider support for infrastructure-level issues |

---

## 8. Post-Incident Review

- Document the bottleneck with Prometheus/OTel evidence
- Review pg_stat_statements for query patterns that led to degradation
- Assess whether Prisma query patterns need optimization
- Review Redis memory management and eviction policies
- Evaluate NATS JetStream consumer scaling strategy
- Run k6 load tests against staging to verify fix resolves regression
- Update Prometheus alert thresholds based on new baselines
- Review auto-scaling policies for workers and API pods
- Assess whether advisory lock contention (hash chain audit) needs architectural changes
- Document capacity limits identified during the incident

---

## 9. Related Runbooks

- [System Outage Playbook](./system-outage-playbook.md)
- [Database Failover Playbook](./database-failover-playbook.md)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md)
- [Connector Failure Playbook](./connector-failure-playbook.md)
- [AI Copilot Failure Playbook](./ai-copilot-failure-playbook.md)
