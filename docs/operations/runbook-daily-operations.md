# TechD PrivacyOps + DSPM Platform -- Daily Operations Runbook

**Owner:** Platform Operations Team
**Review Cycle:** Monthly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Overview

This runbook defines the daily operational procedures for the TechD PrivacyOps platform. All checks should be completed by the on-call engineer within the first 90 minutes of the operational day (08:00 UTC). Any anomalies must be logged in the operations Slack channel (`#privacyops-platform-ops`) and escalated per the escalation matrix.

---

## 2. Morning Health Check Sequence

Execute checks in this order. Each step depends on the prior step confirming baseline health.

### 2.1 Platform Heartbeat

```bash
# Verify the NestJS API is responding
curl -sf https://api.privacyops.techd.io/health | jq .

# Expected response:
# { "status": "ok", "version": "x.y.z", "uptime": <seconds>, "timestamp": "<ISO>" }
```

Confirm `status` is `ok`. If degraded, check individual subsystem health before proceeding.

### 2.2 Database Connection Pool (PostgreSQL + Prisma)

```sql
-- Connect to the primary PostgreSQL instance
-- Check active connections vs. pool limit (default: 20 per Prisma pool)
SELECT count(*) AS active, max_conn
FROM pg_stat_activity,
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') mc
WHERE datname = 'privacyops'
GROUP BY max_conn;
```

**Thresholds:**
- Healthy: active < 60% of max_connections
- Warning: active between 60-80%
- Critical: active > 80% -- escalate immediately

Check for long-running queries that may indicate stuck Temporal activities:

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
  AND state != 'idle'
ORDER BY duration DESC;
```

### 2.3 Redis Memory and Key Metrics

```bash
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD info memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD info clients | grep connected_clients
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD dbsize
```

**Thresholds:**
- Memory usage: warn at 70%, critical at 85% of maxmemory
- Fragmentation ratio: warn if > 1.5, critical if > 2.0
- Connected clients: warn if > 500 (may indicate connection leak from BullMQ workers)

### 2.4 NATS JetStream Consumer Lag

```bash
# Check all stream consumer lag via nats CLI
nats consumer ls PRIVACYOPS_EVENTS -n
nats consumer info PRIVACYOPS_EVENTS scan-processor
nats consumer info PRIVACYOPS_EVENTS dsar-handler
nats consumer info PRIVACYOPS_EVENTS breach-notifier
nats consumer info PRIVACYOPS_EVENTS retention-enforcer
```

**Review for each consumer:**
- `num_pending`: messages waiting to be delivered. Warn if > 1000, critical if > 5000.
- `num_redelivered`: high values indicate processing failures. Investigate if > 50 in 24h.
- `last_activity`: stale consumers (no activity > 15 min) may indicate crashed workers.

**HMAC Signing Verification:**
Spot-check that event HMAC signatures are valid by sampling recent messages:

```bash
nats sub "privacyops.events.>" --count=5 | jq '.headers["x-hmac-sha256"]'
```

### 2.5 Dead Letter Queue (DLQ) Processing

```bash
# Check DLQ depth across all streams
nats stream info PRIVACYOPS_DLQ
```

**Daily DLQ procedure:**
1. If DLQ has messages, export the first 20 for review:
   ```bash
   nats consumer next PRIVACYOPS_DLQ dlq-reviewer --count=20 --no-ack | tee /tmp/dlq-review-$(date +%F).json
   ```
2. Categorize failures: transient (retry) vs. permanent (requires code fix)
3. For transient failures, republish to the source stream after verifying idempotency keys
4. For permanent failures, create a Jira ticket and archive the message
5. Log DLQ depth in the daily ops report

### 2.6 Temporal Workflow Status

```bash
# Check Temporal cluster health
tctl cluster health

# Review workflow execution counts per task queue
tctl workflow list --status RUNNING --query "TaskQueue='SCAN'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='DSAR'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='BREACH'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='RETENTION'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='APPROVAL'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='VENDOR'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='REMEDIATION'" | wc -l
tctl workflow list --status RUNNING --query "TaskQueue='DATA_DELETION'" | wc -l
```

**Thresholds per queue:**
| Queue          | Normal   | Warning  | Critical |
|----------------|----------|----------|----------|
| SCAN           | < 50     | 50-200   | > 200    |
| DSAR           | < 20     | 20-100   | > 100    |
| BREACH         | < 5      | 5-20     | > 20     |
| RETENTION      | < 30     | 30-100   | > 100    |
| APPROVAL       | < 15     | 15-50    | > 50     |
| VENDOR         | < 10     | 10-40    | > 40     |
| REMEDIATION    | < 25     | 25-80    | > 80     |
| DATA_DELETION  | < 10     | 10-30    | > 30     |

Check for failed workflows in the last 24 hours:

```bash
tctl workflow list --status FAILED --earliest_time "$(date -d '24 hours ago' -u +%FT%TZ)" -o json | jq '[.[] | {id: .execution.workflowId, type: .type.name, queue: .taskQueue, closeTime: .closeTime}]'
```

### 2.7 BullMQ Job Queue Health

```bash
# Via the BullMQ admin API or redis-cli
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD keys "bull:*:failed" | while read key; do
  echo "$key: $(redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD llen $key)"
done
```

Review failed jobs. Common failure patterns:
- Connector timeout (increase connector-specific timeout in config)
- PII redaction circuit breaker tripped (check AI co-pilot health)
- Tenant-scoped RLS violation (mismatched tenant context propagation)

### 2.8 Connector Health Sweep

```bash
# Trigger connector health validation for all 43 registered connectors
curl -sf -X POST https://api.privacyops.techd.io/admin/connectors/health-check \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.results[] | select(.status != "healthy")'
```

Log any unhealthy connectors. Common causes:
- Expired OAuth tokens (re-authorize via connector management UI)
- Rate limiting by upstream provider
- Network policy changes blocking egress

---

## 3. AI Co-Pilot Health

```bash
# Check circuit breaker state
curl -sf https://api.privacyops.techd.io/admin/ai-copilot/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Circuit breaker states:**
- `CLOSED`: Normal operation. PII redaction active.
- `OPEN`: Breaker tripped (5 failures in 60s). All AI requests fail-closed (blocked). Investigate immediately.
- `HALF_OPEN`: Recovery probe active. Monitor for stability.

If circuit breaker is OPEN, verify the upstream LLM provider is reachable and the PII redaction pipeline is functional. The fail-closed design means no data leaks during outage, but user-facing AI features are unavailable.

---

## 4. Billing Subsystem Check

```bash
# Verify Stripe webhook connectivity
curl -sf https://api.privacyops.techd.io/admin/billing/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Critical:** Confirm that the `NullBillingProvider` production guard is active. The system must reject `NullBillingProvider` in production environments. If you see `provider: "null"` in production, escalate as P1 immediately.

---

## 5. Audit Log Integrity

```bash
# Verify hash chain integrity for the last 24 hours
curl -sf https://api.privacyops.techd.io/admin/audit/verify-chain \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"since": "'$(date -d '24 hours ago' -u +%FT%TZ)'"}' | jq .
```

Any broken hash chain links indicate potential log tampering. Escalate as P1 security incident.

---

## 6. Prometheus Metrics Review

Open Grafana dashboards and review:
- `privacyops_http_request_duration_seconds` -- P99 latency should be < 500ms
- `privacyops_active_scans_total` -- should be within expected range
- `privacyops_dsar_processing_duration_seconds` -- compare to SLA targets
- `privacyops_nats_consumer_lag` -- correlate with NATS checks above
- `privacyops_auth_guard_rejections_total` -- spike indicates attack or misconfiguration across the 7-layer auth stack

---

## 7. Daily Operations Report

Complete the daily report template in Confluence with:
- [ ] All subsystem health statuses (green/yellow/red)
- [ ] DLQ depth and actions taken
- [ ] Failed workflow count and categorization
- [ ] Any connector health issues
- [ ] Audit log chain verification result
- [ ] Action items for the engineering team
- [ ] Comparison against SLA targets

Post the summary to `#privacyops-platform-ops` by 10:00 UTC.

---

## 8. Weekly Extended Checks (Every Monday)

- Run full connector re-authorization sweep
- Review Temporal workflow history retention (default 30 days)
- Analyze k6 load test results from the weekend run (5 scenarios: smoke, concurrent-scans, dsar-load, event-pipeline, api-burst)
- Review PostgreSQL `pg_stat_statements` for query regression
- Check Kubernetes PVC utilization for Postgres and Redis volumes
- Review OpenTelemetry trace sampling rate and adjust if needed

---

## 9. Appendix: Quick Reference Commands

| Check                     | Command / Endpoint                                      |
|---------------------------|---------------------------------------------------------|
| API health                | `GET /health`                                           |
| DB connections            | `pg_stat_activity` query                                |
| Redis memory              | `redis-cli info memory`                                 |
| NATS consumer lag         | `nats consumer info <stream> <consumer>`                |
| DLQ depth                 | `nats stream info PRIVACYOPS_DLQ`                       |
| Temporal queue depth      | `tctl workflow list --status RUNNING`                   |
| BullMQ failures           | `redis-cli llen bull:<queue>:failed`                    |
| Connector health          | `POST /admin/connectors/health-check`                   |
| AI circuit breaker        | `GET /admin/ai-copilot/status`                          |
| Audit chain integrity     | `POST /admin/audit/verify-chain`                        |
| Billing provider check    | `GET /admin/billing/status`                             |
