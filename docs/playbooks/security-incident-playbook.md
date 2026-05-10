# Security Incident Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-SEC-003
**Last Updated:** 2026-05-10
**Owner:** Security Engineering / Incident Response Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Auth guard pipeline rejection spike: > 50 rejections/minute from any single layer (CSRF, JWT, Tenant, Permissions, FeatureGate, ABAC, Approval)
- JWT validation failures: invalid signature, expired token reuse, or token from revoked session
- Tenant guard detecting `tenant_id` mismatch between JWT claims and request context
- ABAC policy denials on privileged operations (data export, connector config changes, tenant admin actions)
- Hash chain audit log tampering detected -- SHA256 chain verification failure
- NATS JetStream HMAC signature validation failure on incoming messages
- Unusual connector activity: bulk data access patterns outside normal scan windows
- AI co-pilot PII redaction logs showing unexpected data patterns
- Prometheus alert `AuthGuardBypassAttempt` -- request reaching downstream without passing all 7 guard layers
- Multiple failed login attempts from a single IP or against a single tenant

### Manual Detection
- Customer reports unauthorized activity in their tenant
- Security researcher disclosure via responsible disclosure program
- Audit log review reveals unexplained privileged actions

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 (Critical) | Confirmed tenant isolation breach; data exfiltration; auth bypass | Immediate |
| SEV-2 (High) | JWT compromise; single-tenant unauthorized access; guard layer bypass | < 15 minutes |
| SEV-3 (Medium) | Suspicious activity patterns; brute force attempts; single guard rejection spike | < 1 hour |
| SEV-4 (Low) | Informational security events; policy misconfiguration; minor anomalies | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Activate incident response** -- declare security incident in `#security-incident` channel (restricted access).

2. **Preserve evidence immediately:**
   ```bash
   # Snapshot hash chain audit logs for the affected time window
   psql -h db-primary.internal -U privacyops_admin -c \
     "COPY (SELECT * FROM audit_logs WHERE timestamp >= NOW() - INTERVAL '2 hours' ORDER BY id) TO '/tmp/audit_snapshot.csv' WITH CSV HEADER;"

   # Export auth guard rejection logs
   kubectl logs -l app=privacyops-api --since=2h | grep -E "guard|auth|jwt|csrf|tenant|abac|permission|approval" > /tmp/guard_logs.txt

   # Capture NATS JetStream state
   nats stream info PRIVACYOPS_EVENTS --json > /tmp/nats_stream_snapshot.json
   ```

3. **Assess scope of compromise:**
   ```sql
   -- Identify affected tenants from audit log
   SELECT DISTINCT tenant_id, action, entity_type, COUNT(*) as action_count
   FROM audit_logs
   WHERE timestamp >= NOW() - INTERVAL '2 hours'
     AND (action LIKE '%unauthorized%' OR action LIKE '%denied%' OR action LIKE '%bypass%')
   GROUP BY tenant_id, action, entity_type
   ORDER BY action_count DESC;
   ```

4. **If JWT compromise confirmed -- revoke immediately:**
   ```bash
   # Invalidate all active sessions for compromised user/tenant
   redis-cli -h redis.internal KEYS "session:*:TENANT_ID" | xargs redis-cli DEL

   # Rotate JWT signing key (requires coordinated restart)
   # WARNING: This will invalidate ALL active sessions platform-wide
   # Only execute with VP Engineering approval for SEV-1
   ```

5. **If tenant isolation breach suspected**, immediately follow [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md).

---

## 4. Investigation Steps

### Guard Pipeline Forensics

The 7-layer auth guard processes requests in this order. A bypass means a layer was skipped or misconfigured:

```
Layer 1: CSRF Guard        -- Validates CSRF token on state-changing requests
Layer 2: JWT Guard         -- Validates JWT signature, expiry, claims
Layer 3: Tenant Guard      -- Extracts tenant_id, validates against JWT claims
Layer 4: Permissions Guard -- Checks RBAC permissions for the requested action
Layer 5: FeatureGate Guard -- Validates tenant has access to the requested feature
Layer 6: ABAC Guard        -- Attribute-based access control evaluation
Layer 7: Approval Guard    -- Checks if action requires and has approval workflow completion
```

```bash
# Check if any request bypassed a guard layer (OpenTelemetry traces)
# Look for traces where guard spans are missing
curl -s "http://jaeger.internal:16686/api/traces?service=privacyops-api&tags=guard.bypass:true&limit=100" | jq .

# Check guard execution order in traces
curl -s "http://jaeger.internal:16686/api/traces?service=privacyops-api&operation=AuthGuardPipeline&limit=50" | jq '.data[].spans[] | {operationName, tags}'
```

### Hash Chain Audit Log Verification
```sql
-- Verify hash chain integrity for the investigation window
WITH chain_verification AS (
  SELECT
    id,
    tenant_id,
    action,
    entity_type,
    entity_id,
    timestamp,
    previous_hash,
    current_hash,
    LAG(current_hash) OVER (ORDER BY id) AS expected_previous_hash
  FROM audit_logs
  WHERE timestamp >= NOW() - INTERVAL '24 hours'
  ORDER BY id
)
SELECT id, tenant_id, action, timestamp,
  CASE
    WHEN previous_hash IS NULL AND id = (SELECT MIN(id) FROM chain_verification) THEN 'GENESIS'
    WHEN previous_hash = expected_previous_hash THEN 'VALID'
    ELSE 'CHAIN BROKEN'
  END AS integrity_status
FROM chain_verification
WHERE previous_hash != expected_previous_hash
  OR expected_previous_hash IS NULL;
```

### JWT Token Analysis
```bash
# Decode a suspicious JWT (do NOT use online tools for production tokens)
echo "$SUSPICIOUS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# Check for:
# - tenant_id claim matches expected tenant
# - iat (issued at) is within acceptable range
# - exp (expiration) has not been tampered with
# - permissions array contains only legitimate permissions
# - No unexpected custom claims
```

### NATS Message Integrity
```bash
# Check for HMAC validation failures in NATS consumers
kubectl logs -l app=privacyops-api --since=6h | grep -i "hmac\|signature.*invalid\|message.*rejected"

# Check DLQ for messages that failed HMAC validation
nats consumer info PRIVACYOPS_EVENTS DLQ_CONSUMER --json | jq '.num_pending'
```

### Connector Activity Audit
```sql
-- Check for unusual connector data access patterns
SELECT
  c.connector_type,
  c.tenant_id,
  al.action,
  al.entity_type,
  COUNT(*) AS access_count,
  MIN(al.timestamp) AS first_access,
  MAX(al.timestamp) AS last_access
FROM audit_logs al
JOIN connector_configs c ON al.entity_id = c.id::text
WHERE al.timestamp >= NOW() - INTERVAL '24 hours'
  AND al.action IN ('data_read', 'data_export', 'bulk_scan', 'connector_execute')
GROUP BY c.connector_type, c.tenant_id, al.action, al.entity_type
HAVING COUNT(*) > 100
ORDER BY access_count DESC;
```

---

## 5. Resolution Steps

### Containment
1. **Disable compromised accounts:**
   ```sql
   UPDATE users SET is_active = false, locked_at = NOW(), lock_reason = 'Security incident PB-SEC-003'
   WHERE id IN ('COMPROMISED_USER_IDS');
   ```

2. **Revoke compromised API keys:**
   ```sql
   UPDATE api_keys SET revoked_at = NOW(), revoked_reason = 'Security incident'
   WHERE tenant_id = 'AFFECTED_TENANT_ID' AND revoked_at IS NULL;
   ```

3. **Disable affected connectors:**
   ```sql
   UPDATE connector_configs SET is_active = false, updated_at = NOW()
   WHERE tenant_id = 'AFFECTED_TENANT_ID'
     AND connector_type IN ('LIST_SUSPICIOUS_CONNECTORS');
   ```

### Eradication
- Rotate JWT signing keys (coordinated deployment required)
- Rotate NATS HMAC signing keys
- Rotate database credentials if database access was compromised
- Review and update ABAC policies to close exploited gaps
- Patch any identified vulnerability in the guard pipeline

### Recovery
- Re-enable accounts after password reset and MFA verification
- Issue new API keys to affected tenants
- Re-enable connectors after verification
- Verify hash chain audit log integrity post-remediation
- Run full RLS verification (see database-failover-playbook.md)

---

## 6. Communication Template

### Internal (Security Team)
```
SECURITY INCIDENT: [SEV-X] [Brief Description]
Detection Time: [TIMESTAMP UTC]
Attack Vector: [JWT compromise / Guard bypass / Tenant isolation / etc.]
Affected Tenants: [List or "Under Investigation"]
Guard Layer Affected: [Which of the 7 layers]
Data Exposure: [None confirmed / Under investigation / Confirmed -- scope: X]
Containment Status: [Active / Contained / Eradicated]
IC: [Name]
Next Update: [TIME]
```

### External (Affected Customers -- Legal Review Required)
```
We detected unauthorized activity affecting your PrivacyOps account on [DATE].
We immediately contained the activity and are conducting a thorough investigation.
[If applicable: The following data categories may have been accessed: X]
We recommend the following actions: [password reset, API key rotation, etc.]
Our security team is available at security@techd.io for questions.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | Security on-call begins triage |
| 10 min | Security Engineering lead engaged for SEV-1/SEV-2 |
| 15 min | Legal counsel notified for potential data breach |
| 30 min | CISO briefed; breach notification clock assessment begins |
| 1 hour | External forensics firm engaged if needed |
| 4 hours | Board notification for confirmed data breach (per policy) |
| 72 hours | GDPR supervisory authority notification deadline assessment |

---

## 8. Post-Incident Review

- Full forensic timeline with hash chain audit log evidence
- Guard pipeline gap analysis -- which layer failed and why
- Review all 7 guard layers for similar vulnerabilities
- Assess whether the 43 connectors need security review
- Verify NATS HMAC signing prevented event bus tampering
- Review AI co-pilot PII redaction logs for data exposure
- Assess regulatory notification obligations (GDPR 72-hour, state breach laws)
- Update threat model based on findings
- Conduct tabletop exercise based on the incident scenario
- Review and update security monitoring alerts

---

## 9. Related Runbooks

- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md)
- [Data Loss Prevention Playbook](./data-loss-prevention-playbook.md)
- [AI Copilot Failure Playbook](./ai-copilot-failure-playbook.md)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
- [System Outage Playbook](./system-outage-playbook.md)
