# Tenant Isolation Breach Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-TIB-008
**Last Updated:** 2026-05-10
**Owner:** Security Engineering / Platform Security Team
**Review Cadence:** Monthly (elevated due to criticality)

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `TenantIsolationViolation` -- API response containing data for a tenant_id not matching the authenticated session
- RLS policy bypass detected -- query returning rows where `tenant_id != current_setting('app.current_tenant_id')`
- Tenant Guard (Layer 3) rejection with mismatch between JWT `tenant_id` claim and request-path tenant
- ABAC Guard (Layer 6) logging cross-tenant attribute evaluation
- Hash chain audit log showing entity access where `audit.tenant_id != entity.tenant_id`
- NATS event published with tenant_id not matching the originating session's tenant context
- Connector executing scan against data source belonging to a different tenant
- LegalHold record accessed without matching tenant_id filter
- Socket.IO WebSocket broadcasting event to connections in wrong tenant room
- OpenTelemetry trace showing tenant_id context propagation mismatch across service spans

### Manual Detection
- Customer reports seeing data that does not belong to them
- Internal audit discovers cross-tenant data in DSAR response
- Penetration test identifies tenant isolation bypass vector
- Code review identifies missing tenant_id filter in a query path

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 (Critical) | Confirmed cross-tenant data exposure to an external party; data downloaded or exported | Immediate -- all-hands |
| SEV-2 (High) | Cross-tenant data accessible but not confirmed downloaded; internal detection | Immediate |
| SEV-3 (Medium) | Potential bypass vector identified (code review/pentest) but no confirmed exploitation | < 1 hour |
| SEV-4 (Low) | RLS configuration drift detected in non-production; no production impact | < 4 hours |

**NOTE:** All tenant isolation breaches start at minimum SEV-2. This is a ZERO-TOLERANCE category.

---

## 3. Immediate Actions (First 15 Minutes)

1. **IMMEDIATELY assess whether cross-tenant data was exposed to an external party.**

2. **Emergency tenant suspension** (if active exploitation confirmed):
   ```sql
   -- Suspend the compromised tenant to prevent further data access
   UPDATE tenants SET
     is_suspended = true,
     suspended_at = NOW(),
     suspension_reason = 'Security incident -- tenant isolation breach investigation'
   WHERE id = 'COMPROMISED_TENANT_ID';

   -- Invalidate all active sessions for the tenant
   -- This forces re-authentication which will hit the suspension check
   ```
   ```bash
   # Flush all Redis sessions for the tenant
   redis-cli -h redis.internal KEYS "session:*:COMPROMISED_TENANT_ID" | xargs redis-cli -h redis.internal DEL

   # Terminate active WebSocket connections for the tenant
   kubectl exec deployment/privacyops-api -- node -e "
     const io = require('socket.io-client');
     // Emit forced disconnect for tenant room
     console.log('Disconnecting tenant room: COMPROMISED_TENANT_ID');
   "
   ```

3. **Preserve forensic evidence:**
   ```sql
   -- Snapshot all audit log entries involving the affected tenants
   COPY (
     SELECT * FROM audit_logs
     WHERE tenant_id IN ('TENANT_A', 'TENANT_B')
       AND timestamp >= NOW() - INTERVAL '72 hours'
     ORDER BY id
   ) TO '/tmp/tenant_breach_audit.csv' WITH CSV HEADER;

   -- Verify hash chain integrity for the evidence window
   WITH chain AS (
     SELECT id, tenant_id, current_hash, previous_hash,
       LAG(current_hash) OVER (ORDER BY id) AS expected_prev
     FROM audit_logs
     WHERE timestamp >= NOW() - INTERVAL '72 hours'
   )
   SELECT * FROM chain WHERE previous_hash != expected_prev;
   ```

4. **Notify Security Engineering lead and CISO** immediately for SEV-1/SEV-2.

5. **Lock down the affected code path** -- if a specific API endpoint is identified as the vector:
   ```bash
   # Emergency feature flag to disable the affected endpoint
   kubectl set env deployment/privacyops-api DISABLE_ENDPOINT_XXX=true
   ```

---

## 4. Investigation Steps

### RLS Verification
```sql
-- Comprehensive RLS status check for ALL tenant-scoped tables
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count,
  STRING_AGG(p.policyname, ', ') AS policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'data_assets', 'scan_results', 'dsar_requests', 'legal_holds',
    'remediation_actions', 'vendor_assessments', 'breach_records',
    'audit_logs', 'connector_configs', 'tenant_settings',
    'approval_requests', 'users', 'api_keys', 'notifications'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Verify RLS policies correctly filter on tenant_id
SELECT
  tablename, policyname, cmd,
  qual AS policy_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test RLS enforcement with explicit tenant context
SET app.current_tenant_id = 'TENANT_A_ID';
SELECT count(*), tenant_id FROM data_assets GROUP BY tenant_id;
-- Should return ONLY rows for TENANT_A_ID
RESET app.current_tenant_id;

-- Check for tables with RLS enabled but missing policies (CRITICAL)
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename AND p.schemaname = t.schemaname
  );
```

### Guard Pipeline Audit
```bash
# Trace the 7-layer guard pipeline execution for the suspected request
# Layer order: CSRF -> JWT -> Tenant -> Permissions -> FeatureGate -> ABAC -> Approval

# Check for guard bypass in OpenTelemetry traces
curl -s "http://jaeger.internal:16686/api/traces?service=privacyops-api&tags=tenant.mismatch:true" | jq .

# Check for missing guard layers in traces (a gap means a layer was skipped)
curl -s "http://jaeger.internal:16686/api/traces?service=privacyops-api&limit=100" | \
  jq '.data[].spans[] | select(.operationName | startswith("Guard")) | .operationName' | sort | uniq -c

# Verify Tenant Guard (Layer 3) is extracting tenant_id correctly
kubectl logs -l app=privacyops-api --since=1h | grep -i "TenantGuard\|tenant_id.*mismatch\|tenant.*context"

# Check ABAC policy evaluation for cross-tenant access
kubectl logs -l app=privacyops-api --since=1h | grep -i "ABACGuard\|attribute.*denied\|cross.*tenant"
```

### Cross-Tenant Data Exposure Scope
```sql
-- Determine what data from TENANT_B was accessed by TENANT_A
SELECT
  al.id,
  al.tenant_id AS session_tenant,
  al.entity_type,
  al.entity_id,
  al.action,
  al.actor,
  al.timestamp,
  al.metadata
FROM audit_logs al
WHERE al.tenant_id = 'TENANT_A'
  AND al.entity_id IN (
    SELECT id::text FROM data_assets WHERE tenant_id = 'TENANT_B'
    UNION
    SELECT id::text FROM scan_results WHERE tenant_id = 'TENANT_B'
    UNION
    SELECT id::text FROM dsar_requests WHERE tenant_id = 'TENANT_B'
  )
ORDER BY al.timestamp;

-- Check DSAR responses for cross-tenant data inclusion
SELECT
  dr.id, dr.tenant_id, dr.status, dr.subject_email,
  dr.completed_at
FROM dsar_requests dr
WHERE dr.tenant_id = 'TENANT_A'
  AND dr.completed_at >= NOW() - INTERVAL '72 hours';
-- Then manually inspect response contents for TENANT_B data
```

### LegalHold Isolation Check
```sql
-- Verify legal holds are properly tenant-isolated
SELECT
  lh.id, lh.tenant_id, lh.hold_name, lh.released_at, lh.expires_at,
  lh.created_at
FROM legal_holds lh
WHERE lh.tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM legal_holds
  WHERE id = lh.id
);
-- This should return NO rows if RLS is working correctly
```

### NATS Event Tenant Context
```bash
# Check for NATS events with mismatched tenant context
kubectl logs -l app=privacyops-api --since=4h | \
  grep -E "nats.*publish|nats.*receive" | \
  grep -oP 'tenant_id":"[^"]+' | sort | uniq -c | sort -rn

# Verify HMAC signatures include tenant_id in the signing payload
kubectl logs -l app=privacyops-api --since=1h | grep "hmac.*tenant"
```

---

## 5. Resolution Steps

### Immediate Fix: RLS Gap
```sql
-- If RLS was disabled on a table, re-enable immediately
ALTER TABLE affected_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE affected_table FORCE ROW LEVEL SECURITY;

-- Create/fix the tenant isolation policy
CREATE POLICY tenant_isolation ON affected_table
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Immediate Fix: Guard Pipeline Gap
1. If a guard layer was bypassed, deploy a hotfix to the NestJS guard decorator chain.
2. Verify the guard order in the controller/module decorator:
   ```
   @UseGuards(CsrfGuard, JwtGuard, TenantGuard, PermissionsGuard, FeatureGateGuard, AbacGuard, ApprovalGuard)
   ```
3. Ensure no controller/endpoint is missing the guard decorator.

### Immediate Fix: Prisma Query Missing tenant_id
1. Identify the Prisma query missing the `where: { tenant_id }` clause.
2. Add the tenant_id filter and deploy hotfix.
3. Verify with RLS as defense-in-depth (RLS should have caught this).

### Data Exposure Remediation
1. **Quantify exposed data** -- exact records, data categories, sensitivity level.
2. **Notify affected tenant(s)** -- legal review required before external communication.
3. **Revoke any downloads** containing cross-tenant data:
   ```sql
   UPDATE dsar_requests SET status = 'revoked', download_url = NULL
   WHERE id IN ('AFFECTED_DSAR_IDS');
   ```
4. **Request deletion** of exposed data from the unauthorized recipient if applicable.

### Tenant Unsuspension (After Fix Verified)
```sql
-- Only after fix is deployed and verified
UPDATE tenants SET
  is_suspended = false,
  suspended_at = NULL,
  suspension_reason = NULL
WHERE id = 'TENANT_ID';
```

---

## 6. Communication Template

### Internal (Security -- Restricted Distribution)
```
TENANT ISOLATION BREACH: [SEV-X] -- CONFIDENTIAL
Detection Time: [TIMESTAMP UTC]
Affected Tenants: [TENANT_A exposed to TENANT_B's data / reverse / mutual]
Breach Vector: [RLS gap / Guard bypass / Query missing filter / NATS context leak]
Data Categories Exposed: [PII types]
Records Exposed: [Count or estimate]
Data Downloaded: [Yes / No / Unknown]
Containment Status: [Tenant suspended / Endpoint disabled / Fix deployed]
Regulatory Impact: [Assessment pending -- GDPR Art. 33 / state breach laws]
IC: [Name]
CISO Notified: [Yes/No]
```

### External (Affected Tenants -- LEGAL REVIEW MANDATORY)
```
We identified a data isolation issue that may have resulted in limited exposure
of your data to another customer on [DATE]. We immediately contained the issue
and conducted a thorough forensic investigation.

Scope: [Specific data categories and approximate record count]
Duration: [Time window of potential exposure]
Actions Taken: [Summary of containment and remediation]
Your Required Actions: [Notification to your data subjects, if applicable]

We take this matter extremely seriously and have implemented additional
safeguards to prevent recurrence. We are available to discuss this matter
and support your regulatory obligations.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | Security on-call declares incident; CISO notified immediately for all severities |
| 5 min | Security Engineering lead joins; tenant suspended if active exploitation |
| 15 min | Legal counsel engaged; breach notification clock assessment |
| 30 min | VP Engineering + CTO briefed |
| 1 hour | External forensics firm on standby for SEV-1 |
| 4 hours | Board notification for confirmed cross-tenant data breach |
| 24 hours | Affected tenant notification (after legal review) |
| 72 hours | GDPR supervisory authority notification if required |

---

## 8. Post-Incident Review

- Full forensic timeline with hash chain audit log evidence
- Root cause analysis -- which isolation layer failed and why
- RLS policy audit across ALL tables (not just the affected one)
- Guard pipeline code review for similar gaps
- Prisma query audit for missing tenant_id filters
- NATS event tenant context propagation review
- LegalHold RLS verification
- Socket.IO room isolation verification
- Regulatory notification decisions and outcomes
- Update automated tenant isolation testing (add regression test for the vector)
- Consider architectural improvements (e.g., database-per-tenant evaluation)
- Review the Approval Guard (Layer 7) for cross-tenant approval bypass scenarios

---

## 9. Related Runbooks

- [Security Incident Playbook](./security-incident-playbook.md)
- [Data Loss Prevention Playbook](./data-loss-prevention-playbook.md)
- [Database Failover Playbook](./database-failover-playbook.md) (RLS verification post-failover)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
- [AI Copilot Failure Playbook](./ai-copilot-failure-playbook.md)
