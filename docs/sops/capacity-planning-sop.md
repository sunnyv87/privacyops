# SOP-010: Capacity Planning

**Document ID:** SOP-PRIVACYOPS-CP-010
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Infrastructure Lead

---

## 1. Purpose

Define the procedure for monitoring, analyzing, forecasting, and scaling the TechD PrivacyOps platform infrastructure. This covers Prometheus metrics review, PostgreSQL database growth projection, Redis memory management, NATS JetStream stream sizing, Temporal worker scaling, k6 load test baseline comparison, and proactive capacity adjustments to maintain SLA targets across the multi-tenant SaaS deployment.

## 2. Scope

Applies to all platform infrastructure components:
- **PostgreSQL**: Database size, connection pool, query performance, WAL volume, table bloat
- **Redis**: Memory usage, key count, eviction rate, session/cache distribution
- **NATS JetStream**: Stream size, message throughput, consumer lag, DLQ volume
- **Temporal**: Workflow execution throughput, task queue depth, worker utilization across 8 queues
- **Kubernetes**: Pod CPU/memory, node utilization, HPA configuration
- **API Application**: Request throughput, latency percentiles, error rates
- **Connector Workloads**: Scan throughput per connector type, API rate limit headroom
- **Web Frontend**: CDN bandwidth, WebSocket (Socket.IO) connection count
- **OpenTelemetry**: Trace volume, collector throughput, storage growth

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Infrastructure Lead | Owns capacity planning cycle, budget forecasting |
| Database Administrator | PostgreSQL growth analysis, query optimization |
| Platform Engineer | Application scaling, Temporal/NATS tuning |
| DevOps Engineer | Kubernetes scaling, monitoring infrastructure |
| Product Manager | Tenant growth forecasting, feature impact assessment |
| Finance | Budget approval for capacity increases |

## 4. Prerequisites

- Prometheus server collecting metrics from all platform components
- Grafana dashboards configured with PrivacyOps datasource
- k6 load testing scripts available in `test/load/`
- OpenTelemetry Collector operational with trace/metrics pipeline
- Access to Kubernetes cluster metrics (metrics-server, kube-state-metrics)
- Historical metrics retention: minimum 90 days for trend analysis
- Previous quarter's capacity report for comparison

## 5. Procedure

### 5.1 Prometheus Metrics Review

1. **Application Metrics Review**
   1.1. Review core API metrics (30/60/90-day trends):
        ```promql
        # Request rate trend
        rate(privacyops_http_requests_total[1h])

        # Error rate by status code
        rate(privacyops_http_errors_total{status=~"5.."}[1h])
        / rate(privacyops_http_requests_total[1h])

        # Request latency percentiles
        histogram_quantile(0.95, rate(privacyops_request_duration_seconds_bucket[5m]))
        histogram_quantile(0.99, rate(privacyops_request_duration_seconds_bucket[5m]))
        ```
   1.2. Review guard pipeline performance:
        ```promql
        # Guard rejection rate by guard type
        rate(privacyops_guard_rejection_total[1h])

        # Auth processing latency
        histogram_quantile(0.95, rate(privacyops_auth_duration_seconds_bucket[5m]))
        ```
   1.3. Review connector metrics:
        ```promql
        # Scan duration by connector type
        histogram_quantile(0.95, rate(privacyops_connector_scan_duration_seconds_bucket[5m]))

        # Connector error rates
        rate(privacyops_connector_errors_total[1h])
        ```
   1.4. Alert threshold review: Are current alert thresholds appropriate for observed traffic?

2. **Tenant Growth Metrics**
   2.1. Track tenant count and activity trends:
        ```sql
        -- Active tenants trend
        SELECT DATE_TRUNC('month', created_at) AS month,
               COUNT(*) AS new_tenants,
               SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) AS cumulative
        FROM tenants
        WHERE status IN ('active', 'trial')
        GROUP BY 1 ORDER BY 1;

        -- Active users per tenant
        SELECT t.name, COUNT(u.id) AS active_users
        FROM tenants t
        JOIN users u ON u.tenant_id = t.id
        WHERE u.status = 'active' AND u.deleted_at IS NULL
        GROUP BY t.name ORDER BY 2 DESC;
        ```
   2.2. Forecast tenant growth for next quarter based on sales pipeline
   2.3. Estimate per-tenant resource consumption (data sources, scans, DSARs)

### 5.2 PostgreSQL Capacity

3. **Database Size Analysis**
   3.1. Measure current database size and growth:
        ```sql
        -- Total database size
        SELECT pg_size_pretty(pg_database_size('privacyops'));

        -- Table sizes (top 20)
        SELECT relname AS table_name,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               pg_size_pretty(pg_relation_size(relid)) AS data_size,
               pg_size_pretty(pg_indexes_size(relid)) AS index_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 20;

        -- Growth rate (compare with previous month)
        -- audit_logs typically is largest table due to hash chain retention
        SELECT COUNT(*) AS total_audit_entries,
               pg_size_pretty(pg_total_relation_size('audit_logs')) AS audit_size
        FROM audit_logs;
        ```
   3.2. Project storage needs for next 6 months:
        - Current monthly growth rate
        - Expected tenant additions impact
        - Audit log growth (linear with activity)
        - Scan result storage growth (proportional to connector count)

4. **Connection Pool Analysis**
   4.1. Review connection utilization:
        ```sql
        SELECT count(*) AS total_connections,
               count(*) FILTER (WHERE state = 'active') AS active,
               count(*) FILTER (WHERE state = 'idle') AS idle,
               count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx
        FROM pg_stat_activity
        WHERE datname = 'privacyops';
        ```
   4.2. Check Prisma connection pool settings vs. actual usage
   4.3. Review advisory lock usage (audit log hash chain):
        ```sql
        SELECT * FROM pg_locks WHERE locktype = 'advisory';
        ```
   4.4. Adjust `max_connections` and pool size if utilization >70%

5. **Query Performance**
   5.1. Review slow queries (>100ms):
        ```sql
        SELECT query, calls, mean_exec_time, total_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY total_exec_time DESC
        LIMIT 20;
        ```
   5.2. Check for missing indexes on tenant_id-filtered queries
   5.3. Review table bloat and schedule VACUUM if needed
   5.4. Assess need for read replicas based on query volume

### 5.3 Redis Capacity

6. **Memory Analysis**
   6.1. Review Redis memory usage:
        ```bash
        redis-cli INFO memory
        # Key metrics: used_memory, used_memory_peak, mem_fragmentation_ratio
        ```
   6.2. Analyze key distribution:
        ```bash
        redis-cli --bigkeys
        redis-cli INFO keyspace
        ```
   6.3. Session storage growth:
        - Estimate: active_users x avg_session_size
        - Current vs. allocated memory
   6.4. Rate limiting key volume:
        - Keys per tenant x active tenants
        - TTL distribution
   6.5. AI co-pilot circuit breaker state:
        - Circuit breaker keys per tenant
        - Feature gate cache entries

7. **Redis Scaling Decisions**
   7.1. If memory utilization >70%: Plan memory increase
   7.2. If eviction rate increasing: Review TTL policies, increase memory
   7.3. If connection count >80% of max: Scale horizontally (Redis Cluster)
   7.4. Cache hit ratio target: >90% for feature gate and session lookups

### 5.4 NATS JetStream Capacity

8. **Stream Sizing Review**
   8.1. Check stream metrics:
        ```bash
        nats stream info PRIVACYOPS
        # Key metrics: messages, bytes, consumer count, first/last sequence

        nats stream info PRIVACYOPS_DLQ
        ```
   8.2. Review message throughput:
        ```promql
        rate(nats_jetstream_server_total_messages[1h])
        ```
   8.3. Consumer lag analysis:
        ```bash
        nats consumer info PRIVACYOPS <consumer_name>
        # Check: num_pending, num_redelivered
        ```
   8.4. DLQ volume trend: Growing DLQ indicates processing issues

9. **NATS Scaling Decisions**
   9.1. If message backlog growing: Add consumer instances or increase worker throughput
   9.2. If stream size approaching `max_msgs` (1,000,000): Increase limit or reduce retention
   9.3. If idempotency cache (10-min TTL) causing memory pressure: Review EventBusService cache size
   9.4. Review HMAC computation overhead at high throughput

### 5.5 Temporal Worker Scaling

10. **Task Queue Analysis**
    10.1. Review each of the 8 task queues:

    | Queue | Metrics to Review |
    |-------|------------------|
    | SCAN | Pending tasks, avg scan duration, worker count |
    | DSAR | Pending requests, SLA compliance rate, workflow duration |
    | BREACH | Active workflows, notification latency |
    | RETENTION | Pending retention jobs, execution rate |
    | APPROVAL | Pending approvals, response time |
    | VENDOR | Active vendor reviews, processing time |
    | REMEDIATION | Pending remediations, action execution rate |
    | DATA_DELETION | Pending deletions, verification completion rate |

    10.2. Check worker utilization:
          ```bash
          tctl taskqueue describe --tq SCAN
          tctl taskqueue describe --tq DSAR
          # Check: pollers count, backlog count
          ```
    10.3. Activity timeout analysis:
          - `startToCloseTimeout`: 10-15 minutes per activity (configured in workflows)
          - `heartbeatTimeout`: 3-5 minutes (configured in workflows)
          - Review timeout violations in last 30 days

11. **Temporal Scaling Decisions**
    11.1. If task queue backlog >100 for any queue: Scale worker replicas
    11.2. If activity timeout rate >1%: Investigate root cause or increase timeout
    11.3. Worker scaling formula: `workers_needed = peak_hourly_tasks / (tasks_per_worker_per_hour * 0.7)`
    11.4. Plan for DSAR deadline spikes (regulatory due dates cluster)

### 5.6 k6 Load Test Baseline

12. **Baseline Comparison**
    12.1. Run standard k6 load test suite monthly:
          ```bash
          k6 run test/load/baseline.k6.js \
            --env TARGET=staging \
            --out json=results/baseline-$(date +%Y%m%d).json
          ```
    12.2. Compare against previous baseline:
          - Request throughput (requests/sec)
          - Response time (p50, p95, p99)
          - Error rate under load
          - Concurrent user capacity
    12.3. If p95 latency regressed >10%: Investigate before next release
    12.4. If throughput dropped >5%: Profile application for bottlenecks

### 5.7 Capacity Forecasting & Action

13. **Quarterly Forecast**
    13.1. Compile capacity report with:
          - Current utilization per component
          - 3-month growth projection
          - 6-month growth projection
          - Scaling recommendations with cost estimates
    13.2. Identify capacity risks:
          - Components approaching threshold (>70% utilization)
          - Bottlenecks in the pipeline (connector scan throughput, DSAR processing)
          - Infrastructure costs trajectory
    13.3. Submit scaling requests with budget to Finance

14. **Scaling Actions**
    14.1. Horizontal scaling (preferred):
          - Kubernetes HPA tuning for API pods
          - Temporal worker replica adjustment
          - NATS consumer scaling
          - Redis Cluster node addition
    14.2. Vertical scaling:
          - PostgreSQL instance upgrade (CPU, memory, IOPS)
          - Redis memory increase
          - Temporal server resource upgrade
    14.3. All scaling changes follow SOP-005 (Change Management)

## 6. Verification

- [ ] Prometheus metrics reviewed for all components (30/60/90-day trends)
- [ ] PostgreSQL size, connections, and query performance analyzed
- [ ] Redis memory utilization and key distribution reviewed
- [ ] NATS stream size, throughput, and consumer lag assessed
- [ ] All 8 Temporal task queues reviewed for backlog and worker health
- [ ] k6 baseline comparison completed (no regression)
- [ ] Growth forecast documented for next 3-6 months
- [ ] Scaling recommendations submitted with budget estimates
- [ ] Capacity report published to stakeholders

## 7. Rollback

If a scaling action causes issues:
1. Kubernetes HPA: Revert to previous min/max replica count
2. PostgreSQL: Rollback instance type via Terraform
3. Redis: Reduce memory allocation (if no data loss risk)
4. Temporal workers: Scale down to previous replica count
5. NATS: Restore previous stream configuration from backup
6. All rollbacks follow change management process

## 8. Frequency

- **Prometheus metrics review**: Weekly (automated dashboards), monthly (deep analysis)
- **PostgreSQL capacity analysis**: Monthly
- **Redis memory review**: Monthly
- **NATS stream sizing review**: Monthly
- **Temporal queue analysis**: Bi-weekly
- **k6 baseline test**: Monthly (on staging)
- **Full capacity forecast**: Quarterly
- **Budget review**: Quarterly

## 9. References

- SOP-005: Change Management (for scaling changes)
- SOP-006: Backup & Recovery (for RTO/RPO alignment with capacity)
- SOP-009: Release Management (for performance validation)
- Architecture Doc: `docs/architecture/05-system-architecture.md`
- Infrastructure: `infra/prometheus/`, `infra/grafana/dashboards/`
- Load Tests: `apps/api/test/load/`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Infrastructure Lead | Initial version |
| | | | |
| | | | |
