# Legal Hold Enforcement Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-LH-010
**Last Updated:** 2026-05-10
**Owner:** Legal Operations / Platform Engineering
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `LegalHoldDeletionBlocked` -- DATA_DELETION workflow attempted to delete data under active legal hold
- Prometheus alert `LegalHoldExpiring` -- legal hold `expires_at` within 7 days and no extension or release action taken
- NATS event `legal_hold.violation.deletion_attempted` -- deletion request blocked by hold enforcement
- NATS event `legal_hold.expiration.warning` -- hold nearing expiration
- Audit log entry: `legal_hold_override_attempt` -- someone attempted to bypass a legal hold
- DSAR workflow interaction with held data -- `dsar.collection.legal_hold_conflict` event
- RETENTION workflow attempted to purge data covered by active hold
- RLS policy failure on `legal_holds` table -- tenant_id filtering bypass attempt

### Manual Detection
- Legal counsel requests verification that a hold is properly enforced
- Custodian reports that data they expected to be preserved was modified or deleted
- eDiscovery vendor reports missing data that should have been under hold
- Audit review identifies gap in hold coverage for a litigation matter

### Legal Hold Data Model
```
LegalHold {
  id: UUID
  tenant_id: UUID          -- RLS enforced
  hold_name: string
  matter_id: string
  custodians: string[]
  data_scope: jsonb        -- defines what data is held
  created_at: timestamp
  released_at: timestamp   -- NULL = active hold
  expires_at: timestamp    -- auto-release date if set
  created_by: UUID
  released_by: UUID
}
```
A legal hold is **active** when: `released_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | Data under active hold was deleted or modified; evidence spoliation risk | Immediate |
| SEV-2 | Hold enforcement mechanism failed; deletion workflow bypassed hold check | < 15 minutes |
| SEV-3 | Hold-DSAR conflict; hold expiring without action; hold scope misconfiguration | < 1 hour |
| SEV-4 | Hold creation/modification audit; routine hold verification | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Verify the legal hold is active and enforced:**
   ```sql
   -- Check legal hold status
   SELECT
     lh.id,
     lh.tenant_id,
     lh.hold_name,
     lh.matter_id,
     lh.custodians,
     lh.data_scope,
     lh.created_at,
     lh.released_at,
     lh.expires_at,
     CASE
       WHEN lh.released_at IS NOT NULL THEN 'RELEASED'
       WHEN lh.expires_at IS NOT NULL AND lh.expires_at <= NOW() THEN 'EXPIRED'
       ELSE 'ACTIVE'
     END AS hold_status
   FROM legal_holds lh
   WHERE lh.id = 'HOLD_ID' AND lh.tenant_id = 'TENANT_ID';
   ```

2. **If data was deleted under active hold -- EMERGENCY:**
   ```bash
   # Immediately pause ALL DATA_DELETION workflows
   tctl --ns privacyops-production workflow list --status open \
     --query "TaskQueue='DATA_DELETION'" -o json | \
     jq -r '.[].execution.workflowId' | while read wid; do
       tctl --ns privacyops-production workflow terminate -w "$wid" \
         -r "Emergency pause -- legal hold enforcement failure investigation"
     done

   # Also pause RETENTION workflows that may trigger deletions
   tctl --ns privacyops-production workflow list --status open \
     --query "TaskQueue='RETENTION'" -o json | \
     jq -r '.[].execution.workflowId' | while read wid; do
       tctl --ns privacyops-production workflow terminate -w "$wid" \
         -r "Emergency pause -- legal hold enforcement failure investigation"
     done
   ```

3. **Preserve evidence of the hold enforcement state:**
   ```sql
   -- Snapshot legal hold audit trail
   COPY (
     SELECT * FROM audit_logs
     WHERE entity_type = 'legal_hold'
       AND entity_id = 'HOLD_ID'
     ORDER BY timestamp
   ) TO '/tmp/legal_hold_audit.csv' WITH CSV HEADER;

   -- Snapshot deletion activity during the incident window
   COPY (
     SELECT * FROM audit_logs
     WHERE action IN ('data_delete', 'data_purge', 'retention_purge', 'dsar_delete')
       AND tenant_id = 'TENANT_ID'
       AND timestamp >= NOW() - INTERVAL '48 hours'
     ORDER BY timestamp
   ) TO '/tmp/deletion_activity_audit.csv' WITH CSV HEADER;
   ```

4. **Notify Legal counsel immediately** for SEV-1/SEV-2.

5. **Check for data recoverability** if deletion occurred:
   ```bash
   # Check if soft-delete is in place (data may be recoverable)
   psql -h db-primary.internal -U privacyops_admin -c \
     "SELECT id, deleted_at FROM data_assets WHERE id IN ('DELETED_IDS') AND deleted_at IS NOT NULL;"

   # Check database backup availability
   # AWS RDS example:
   aws rds describe-db-snapshots --db-instance-identifier privacyops-production --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' --output table | head -10
   ```

---

## 4. Investigation Steps

### Hold Enforcement Mechanism Verification
```sql
-- Verify that deletion workflows check legal holds
-- The DATA_DELETION and RETENTION workflows should query active holds before deleting

-- Check if the data targeted for deletion overlaps with any active hold scope
SELECT
  lh.id AS hold_id,
  lh.hold_name,
  lh.data_scope,
  lh.created_at,
  lh.released_at,
  lh.expires_at
FROM legal_holds lh
WHERE lh.tenant_id = 'TENANT_ID'
  AND lh.released_at IS NULL
  AND (lh.expires_at IS NULL OR lh.expires_at > NOW())
  AND (
    lh.data_scope->>'entity_type' = 'TARGET_ENTITY_TYPE'
    OR lh.data_scope->>'scope' = 'all'
    OR lh.custodians::jsonb ? 'TARGET_CUSTODIAN_EMAIL'
  );
```

### RLS Verification on Legal Holds Table
```sql
-- Verify RLS is active on legal_holds table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'legal_holds' AND schemaname = 'public';

-- Verify RLS policy enforces tenant_id filtering
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'legal_holds' AND schemaname = 'public';

-- Test RLS enforcement
SET app.current_tenant_id = 'TENANT_A';
SELECT count(*) FROM legal_holds; -- Should only return TENANT_A holds
RESET app.current_tenant_id;
```

### DSAR-Legal Hold Interaction
```sql
-- Check for DSAR requests that involve data under legal hold
SELECT
  dr.id AS dsar_id,
  dr.tenant_id,
  dr.request_type,
  dr.status,
  dr.subject_email,
  lh.id AS hold_id,
  lh.hold_name,
  lh.data_scope
FROM dsar_requests dr
JOIN legal_holds lh ON dr.tenant_id = lh.tenant_id
WHERE dr.status IN ('in_progress', 'pending', 'collecting_data')
  AND lh.released_at IS NULL
  AND (lh.expires_at IS NULL OR lh.expires_at > NOW())
  AND (
    lh.custodians::jsonb ? dr.subject_email
    OR lh.data_scope->>'scope' = 'all'
  )
ORDER BY dr.created_at DESC;

-- DSAR deletion requests (right to erasure) MUST be blocked when legal hold is active
-- The platform should respond to the DSAR but exclude held data from deletion
-- Document the hold conflict in the DSAR response
```

### Hold Expiration Analysis
```sql
-- Find all holds expiring within 30 days
SELECT
  id,
  tenant_id,
  hold_name,
  matter_id,
  expires_at,
  expires_at - NOW() AS time_remaining,
  CASE
    WHEN expires_at <= NOW() THEN 'EXPIRED'
    WHEN expires_at <= NOW() + INTERVAL '7 days' THEN 'CRITICAL'
    WHEN expires_at <= NOW() + INTERVAL '30 days' THEN 'WARNING'
    ELSE 'OK'
  END AS urgency
FROM legal_holds
WHERE released_at IS NULL
  AND expires_at IS NOT NULL
ORDER BY expires_at ASC;
```

### Audit Trail Verification
```sql
-- Verify complete audit trail for legal hold lifecycle
SELECT
  al.action,
  al.actor,
  al.metadata,
  al.timestamp,
  al.current_hash
FROM audit_logs al
WHERE al.entity_type = 'legal_hold'
  AND al.entity_id = 'HOLD_ID'
ORDER BY al.timestamp;

-- Expected lifecycle events:
-- legal_hold_created
-- legal_hold_scope_updated (if modified)
-- legal_hold_custodian_added / legal_hold_custodian_removed
-- deletion_blocked_by_hold (when enforcement activated)
-- legal_hold_extended (expiration pushed out)
-- legal_hold_released (explicitly released)
-- legal_hold_expired (auto-expired)

-- Verify hash chain integrity for hold-related events
WITH hold_events AS (
  SELECT id, current_hash, previous_hash,
    LAG(current_hash) OVER (ORDER BY id) AS expected_prev
  FROM audit_logs
  WHERE entity_type = 'legal_hold' AND entity_id = 'HOLD_ID'
)
SELECT * FROM hold_events WHERE previous_hash != expected_prev;
```

---

## 5. Resolution Steps

### Data Deleted Under Active Hold (SEV-1)
1. **Assess recoverability:**
   - Check soft-delete records (`deleted_at IS NOT NULL`)
   - Identify the most recent database backup before the deletion
   - Determine if connector-side data is still available (source of truth)
2. **Restore from backup** if needed:
   ```bash
   # Restore specific records from backup (point-in-time recovery to a staging instance)
   # Do NOT restore over production -- extract and re-insert specific records
   ```
3. **Document the spoliation risk** for legal counsel:
   - Exact records deleted
   - Time of deletion
   - Whether deletion was permanent or soft-delete
   - Recoverability status
   - Hash chain audit log evidence

### Hold Enforcement Fix
1. **Verify the deletion workflow checks legal holds:**
   ```
   DATA_DELETION workflow should:
   1. Query active legal_holds for the tenant
   2. Compare deletion scope against hold scope
   3. If overlap: block deletion, log conflict, notify tenant admin
   4. If no overlap: proceed with deletion
   ```
2. **Add missing enforcement** if the check was absent.
3. **Add enforcement to RETENTION workflow** if not already present.

### Hold-DSAR Conflict Resolution
1. **For DSAR Deletion (Right to Erasure) requests:**
   - Respond to the DSAR within the regulatory deadline
   - Inform the data subject that certain data cannot be deleted due to legal obligations
   - Document the specific data categories withheld and the legal basis
   - Mark the DSAR as `partially_completed` with hold reference
   ```sql
   UPDATE dsar_requests
   SET status = 'partially_completed',
       metadata = jsonb_set(COALESCE(metadata, '{}'), '{legal_hold_conflict}',
         format('{"hold_id": "%s", "hold_name": "%s", "withheld_categories": %s}',
           'HOLD_ID', 'HOLD_NAME', '"[\"category1\",\"category2\"]"')::jsonb),
       updated_at = NOW()
   WHERE id = 'DSAR_REQUEST_ID';
   ```

2. **For DSAR Access (Right of Access) requests:**
   - Legal hold does NOT block access requests -- the data subject can receive a copy
   - Ensure the DSAR response is properly redacted via the standard pipeline

### Hold Extension
```sql
-- Extend a hold's expiration (legal counsel authorization required)
UPDATE legal_holds
SET expires_at = 'NEW_EXPIRATION_DATE',
    updated_at = NOW()
WHERE id = 'HOLD_ID' AND tenant_id = 'TENANT_ID';

-- The audit log should automatically record this via the hash chain
```

### Hold Release
```sql
-- Release a hold (legal counsel authorization required)
UPDATE legal_holds
SET released_at = NOW(),
    released_by = 'AUTHORIZED_USER_ID',
    updated_at = NOW()
WHERE id = 'HOLD_ID' AND tenant_id = 'TENANT_ID';

-- After release, data becomes eligible for normal retention/deletion policies
-- The RETENTION workflow will process held data in its next cycle
```

---

## 6. Communication Template

### Internal (Legal + Engineering)
```
LEGAL HOLD INCIDENT: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Hold ID: [HOLD_ID]
Matter: [MATTER_ID / Case Name]
Tenant: [TENANT_ID]
Issue: [Deletion under hold / Enforcement failure / DSAR conflict / Expiration / Scope gap]
Data Impact: [Records affected / Deletion occurred: yes/no]
Recoverability: [Recoverable from backup / Soft-delete / Permanent loss]
Spoliation Risk: [Assessment]
Status: [Investigating / Contained / Resolved]
IC: [Name]
Legal Contact: [Name]
```

### External (Tenant Legal Team -- Legal Review Required)
```
We identified an issue with legal hold [HOLD_NAME] in your PrivacyOps environment.
[If deletion occurred: Data covered by the hold was inadvertently processed.
We are working to restore the affected records from backup.]
[If DSAR conflict: A data subject request interacts with data under your legal hold.
We have preserved the held data and will coordinate with you on the response.]
Please contact your legal team and our support at legal-ops@techd.io to discuss next steps.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer verifies hold status and enforcement |
| 5 min | Legal Operations lead notified for all severities |
| 10 min | General Counsel notified for SEV-1 (spoliation risk) |
| 15 min | Platform Engineering lead for enforcement mechanism failures |
| 30 min | Tenant's legal contact notified for SEV-1/SEV-2 |
| 1 hour | VP Engineering for systemic enforcement failures |
| 4 hours | External eDiscovery counsel engaged if spoliation confirmed |

---

## 8. Post-Incident Review

- Document exact timeline of hold creation, enforcement failure, and resolution
- Verify hash chain audit log integrity for all hold-related events
- Review DATA_DELETION and RETENTION workflow code for hold check gaps
- Verify RLS on legal_holds table prevents cross-tenant hold manipulation
- Assess hold expiration notification reliability
- Review DSAR-hold interaction logic for completeness
- Audit all active holds to verify enforcement is working
- Review hold scope definitions for clarity and coverage
- Assess whether hold enforcement should block at the database level (trigger) vs. application level
- Update legal hold creation process with verification step
- Test hold enforcement in staging with all 12 RemediationExecutorService action types

---

## 9. Related Runbooks

- [Data Loss Prevention Playbook](./data-loss-prevention-playbook.md)
- [Security Incident Playbook](./security-incident-playbook.md)
- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md)
- [Database Failover Playbook](./database-failover-playbook.md) (RLS verification post-failover)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md) (DATA_DELETION queue issues)
