# Database Failover Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-DB-002
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / Database Reliability Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `PostgresReplicationLagCritical` -- replication lag exceeds 30 seconds
- Prometheus alert `PostgresConnectionPoolExhausted` -- Prisma connection pool at 100% utilization
- Prisma client throws `P1001` (cannot reach database) or `P1017` (server closed connection)
- PostgreSQL `pg_stat_replication` shows standby disconnected for > 60 seconds
- Hash chain audit log writes failing -- SHA256 chain broken or advisory lock contention timeout
- RLS policy evaluation errors appearing in PostgreSQL logs
- BullMQ jobs failing with database connection errors
- Temporal activities failing on database operations across multiple task queues

### Manual Detection
- Application logs showing repeated `ECONNREFUSED` or `connection terminated unexpectedly`
- DSAR workflows stuck in data retrieval phase
- Multi-tenant queries returning empty results (potential RLS misconfiguration post-failover)

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | Primary database unreachable; no automatic failover occurred | Immediate |
| SEV-2 | Automatic failover occurred but application not reconnected; RLS issues | < 15 minutes |
| SEV-3 | Replication lag causing stale reads; standby promotion needed | < 30 minutes |
| SEV-4 | Scheduled maintenance failover with planned window | Per change calendar |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Confirm database state:**
   ```bash
   # Check primary status
   psql -h db-primary.internal -U privacyops_admin -c "SELECT pg_is_in_recovery();"
   # Returns 'f' if primary, 't' if replica

   # Check replication status
   psql -h db-primary.internal -U privacyops_admin -c \
     "SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn FROM pg_stat_replication;"

   # Check active connections
   psql -h db-primary.internal -U privacyops_admin -c \
     "SELECT count(*), state FROM pg_stat_activity WHERE datname='privacyops' GROUP BY state;"
   ```

2. **Assess Prisma connection pool state:**
   ```bash
   # Check current pool metrics via Prometheus
   curl -s http://privacyops-api:9090/metrics | grep prisma_pool

   # Check for Prisma connection errors in application logs
   kubectl logs -l app=privacyops-api --since=5m | grep -i "prisma\|P1001\|P1017\|ECONNREFUSED"
   ```

3. **Pause non-critical Temporal workflows** to reduce database load:
   ```bash
   # Pause SCAN and RETENTION queues (non-time-sensitive)
   tctl --ns privacyops-production task-queue describe -tq SCAN
   tctl --ns privacyops-production task-queue describe -tq RETENTION
   ```

4. **Notify on-call DBA** and join `#incident-response` channel.

5. **Check if NullBillingProvider guard was triggered** -- if the API restarted during the database event, verify BILLING_PROVIDER=stripe is still set to prevent the production startup guard from throwing.

---

## 4. Investigation Steps

### Determine Failover Type

**Automatic Failover (Managed PostgreSQL)**
- Verify the cloud provider's failover event in the management console
- Check DNS propagation for the database endpoint
- Confirm new primary is accepting writes

**Manual Failover Required**
- If automatic failover did not trigger, assess why:
  - Check patroni/repmgr cluster state (depending on HA solution)
  - Verify standby is in streaming replication state
  - Check WAL archiving status

### Connection Pool Analysis
```bash
# Check Prisma connection pool configuration
kubectl get deployment privacyops-api -o jsonpath='{.spec.template.spec.containers[0].env}' | \
  jq '.[] | select(.name | startswith("DATABASE"))'

# Prisma pool settings to verify:
# - connection_limit (should match expected concurrent load)
# - pool_timeout (default 10s, may need increase during failover)
# - connect_timeout (should be > failover detection time)
```

### Advisory Lock Contention
```sql
-- Check for blocked advisory locks (used by hash chain audit logging)
SELECT pid, pg_blocking_pids(pid) AS blocked_by, query, state, wait_event_type
FROM pg_stat_activity
WHERE wait_event_type = 'Lock' AND datname = 'privacyops';

-- Check advisory lock status
SELECT classid, objid, objsubid, pid, mode, granted
FROM pg_locks
WHERE locktype = 'advisory';
```

### RLS Policy Verification
```sql
-- List all RLS policies (critical for multi-tenant isolation)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify tenant_id filtering is enforced
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Test RLS with a specific tenant context
SET app.current_tenant_id = 'test-tenant-uuid';
SELECT count(*) FROM data_assets; -- Should return only tenant's assets
RESET app.current_tenant_id;
```

---

## 5. Resolution Steps

### Step 1: Execute Failover (if not automatic)
```bash
# Promote standby to primary (patroni example)
patronictl -c /etc/patroni/patroni.yml switchover --master db-primary --candidate db-standby --force

# OR manual PostgreSQL promotion
psql -h db-standby.internal -U privacyops_admin -c "SELECT pg_promote();"
```

### Step 2: Drain Prisma Connection Pool
```bash
# Rolling restart of API pods to reset Prisma connection pools
kubectl rollout restart deployment/privacyops-api

# Monitor new connections establishing
kubectl logs -l app=privacyops-api -f | grep -i "prisma.*connected"
```

### Step 3: Update Connection Strings (if endpoint changed)
```bash
# Update DATABASE_URL secret if the endpoint changed
kubectl create secret generic privacyops-db-credentials \
  --from-literal=DATABASE_URL="postgresql://privacyops_app:PASSWORD@NEW_HOST:5432/privacyops?schema=public" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secret
kubectl rollout restart deployment/privacyops-api
kubectl rollout restart deployment/privacyops-temporal-worker
```

### Step 4: Verify RLS Post-Failover
```sql
-- Critical: verify RLS is enabled on all tenant-scoped tables
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (
      'data_assets', 'scan_results', 'dsar_requests', 'legal_holds',
      'remediation_actions', 'vendor_assessments', 'breach_records',
      'audit_logs', 'connector_configs', 'tenant_settings'
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE tablename = tbl.tablename AND rowsecurity = true
    ) THEN
      RAISE EXCEPTION 'RLS DISABLED on table: % -- TENANT ISOLATION COMPROMISED', tbl.tablename;
    END IF;
  END LOOP;
  RAISE NOTICE 'All tenant-scoped tables have RLS enabled.';
END $$;

-- Verify no policy was dropped during failover
SELECT count(*) AS policy_count FROM pg_policies WHERE schemaname = 'public';
-- Compare against known baseline (document expected count here)
```

### Step 5: Data Integrity Checks
```sql
-- Verify hash chain audit log integrity
SELECT
  al.id,
  al.previous_hash,
  al.current_hash,
  encode(sha256(
    concat(al.previous_hash, al.tenant_id, al.action, al.entity_type, al.entity_id, al.timestamp::text)::bytea
  ), 'hex') AS computed_hash,
  CASE
    WHEN al.current_hash = encode(sha256(
      concat(al.previous_hash, al.tenant_id, al.action, al.entity_type, al.entity_id, al.timestamp::text)::bytea
    ), 'hex') THEN 'VALID'
    ELSE 'BROKEN'
  END AS chain_status
FROM audit_logs al
ORDER BY al.id DESC
LIMIT 100;

-- Check for gaps in the audit log sequence
SELECT a.id + 1 AS gap_start, MIN(b.id) - 1 AS gap_end
FROM audit_logs a
LEFT JOIN audit_logs b ON b.id > a.id
GROUP BY a.id
HAVING a.id + 1 < MIN(b.id)
LIMIT 20;
```

### Step 6: Resume Paused Workflows
```bash
# Resume Temporal task queues that were paused
# Verify workers are registered before resuming
tctl --ns privacyops-production task-queue describe -tq SCAN
tctl --ns privacyops-production task-queue describe -tq RETENTION

# Check for workflows that need manual retry
tctl --ns privacyops-production workflow list --status failed --query "CloseTime > '2026-05-10T00:00:00Z'"
```

---

## 6. Communication Template

### Internal
```
DATABASE FAILOVER [EXECUTED/IN PROGRESS]
Time: [TIMESTAMP UTC]
Failover Type: [Automatic / Manual]
Impact: Prisma connection pool drained; [X] active workflows paused
RLS Status: [Verified / Under Verification]
Audit Log Integrity: [Intact / Investigating]
ETA to Full Recovery: [ESTIMATE]
IC: [Name]
```

### External
```
We experienced a brief database maintenance event at [TIME UTC].
Service has been restored. Some data processing jobs (scans, DSARs) may
experience delays of up to [X] minutes as queued work is re-processed.
No data loss or security impact has been identified.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer confirms failover status |
| 10 min | DBA engaged if manual intervention needed |
| 20 min | Platform Engineering lead notified if RLS verification fails |
| 30 min | VP Engineering + Security lead if tenant isolation concerns |
| 1 hour | CTO briefing if data integrity issues discovered |

---

## 8. Post-Incident Review

- Document exact failover timeline with WAL positions
- Verify no audit log entries were lost during failover window
- Confirm hash chain continuity across the failover boundary
- Review Prisma connection pool settings -- were they adequate for failover?
- Assess whether advisory lock contention contributed to or resulted from the failover
- Verify all 43 connectors re-established database connections
- Review RLS policy count against baseline
- Update connection timeout settings if failover took longer than expected
- Test failover procedure in staging environment

---

## 9. Related Runbooks

- [System Outage Playbook](./system-outage-playbook.md)
- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md)
