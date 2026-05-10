# Data Loss Prevention Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-DLP-004
**Last Updated:** 2026-05-10
**Owner:** Security Engineering / Data Protection Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `DataExfiltrationAnomaly` -- data export volume exceeds tenant baseline by 3x
- Connector executing bulk read operations outside scheduled scan windows
- RemediationExecutorService action of type `data_export` or `data_copy` without corresponding approved DSAR
- DSAR download triggered for a request with status `redaction_failed` (fail-closed violation attempt)
- NATS event `dsar.response.download` without preceding `dsar.response.redaction_complete` event
- AI co-pilot processing request that bypasses PII redaction (redaction fail-closed should block this)
- Audit log shows `data_access` actions across multiple tenants from a single user/service account
- Connector config modified to point to an external/unauthorized destination
- Hash chain audit log records data export events outside business hours

### Manual Detection
- DPO reports potential DSAR over-disclosure after customer complaint
- Connector owner notices data replicated to unexpected location
- Internal audit identifies remediation action targeting wrong data scope

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 (Critical) | Confirmed cross-tenant data exposure; PII exfiltration; DSAR over-disclosure with sensitive categories | Immediate |
| SEV-2 (High) | Unauthorized data export via connector; remediation action with wrong scope; redaction bypass | < 15 minutes |
| SEV-3 (Medium) | Anomalous data access pattern; connector misconfiguration detected before data movement | < 1 hour |
| SEV-4 (Low) | Policy violation with no data movement; configuration drift; minor DSAR scope issue | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Block active data movement immediately:**
   ```bash
   # Identify and pause active scan/export workflows
   tctl --ns privacyops-production workflow list --status open \
     --query "TaskQueue='SCAN' OR TaskQueue='DATA_DELETION' OR TaskQueue='REMEDIATION'" | head -20

   # Pause suspicious workflows
   tctl --ns privacyops-production workflow terminate -w WORKFLOW_ID -r "DLP incident -- data export blocked"
   ```

2. **Disable the affected connector:**
   ```sql
   -- Immediately disable the connector suspected of unauthorized data movement
   UPDATE connector_configs
   SET is_active = false, updated_at = NOW()
   WHERE id = 'CONNECTOR_ID' AND tenant_id = 'TENANT_ID';

   -- Log the emergency action
   INSERT INTO audit_logs (tenant_id, action, entity_type, entity_id, actor, metadata, timestamp)
   VALUES ('TENANT_ID', 'emergency_connector_disable', 'connector_config', 'CONNECTOR_ID',
           'incident_response', '{"reason": "DLP incident PB-DLP-004"}', NOW());
   ```

3. **Check DSAR fail-closed redaction status:**
   ```sql
   -- Identify any DSAR requests where redaction failed but download was attempted
   SELECT dr.id, dr.tenant_id, dr.status, dr.subject_email, dr.created_at, dr.updated_at
   FROM dsar_requests dr
   WHERE dr.status = 'redaction_failed'
     AND EXISTS (
       SELECT 1 FROM audit_logs al
       WHERE al.entity_id = dr.id::text
         AND al.action = 'dsar_download_attempt'
         AND al.timestamp >= NOW() - INTERVAL '24 hours'
     );
   ```

4. **Preserve forensic evidence:**
   ```bash
   # Snapshot relevant audit logs
   psql -h db-primary.internal -U privacyops_admin -c \
     "COPY (SELECT * FROM audit_logs WHERE tenant_id = 'TENANT_ID' AND timestamp >= NOW() - INTERVAL '48 hours') TO '/tmp/dlp_audit_snapshot.csv' WITH CSV HEADER;"

   # Capture connector execution logs
   kubectl logs -l app=privacyops-api --since=24h | grep -E "connector|IConnector|data_export|remediation" > /tmp/connector_activity.log
   ```

5. **Notify Security team and DPO** within 10 minutes for SEV-1/SEV-2.

---

## 4. Investigation Steps

### DSAR Over-Disclosure Investigation
```sql
-- Review DSAR response contents and redaction history
SELECT
  dr.id AS dsar_id,
  dr.tenant_id,
  dr.request_type,
  dr.subject_email,
  dr.status,
  dr.data_categories,
  dr.created_at,
  dr.completed_at,
  al.action,
  al.metadata,
  al.timestamp
FROM dsar_requests dr
JOIN audit_logs al ON al.entity_id = dr.id::text AND al.entity_type = 'dsar_request'
WHERE dr.id = 'DSAR_REQUEST_ID'
ORDER BY al.timestamp;

-- Check redaction pipeline execution
SELECT * FROM audit_logs
WHERE entity_id = 'DSAR_REQUEST_ID'
  AND action IN ('redaction_started', 'redaction_complete', 'redaction_failed', 'dsar_download')
ORDER BY timestamp;
```

### Connector Misconfiguration Audit
```sql
-- Review recent connector configuration changes
SELECT
  al.tenant_id,
  al.action,
  al.entity_id AS connector_id,
  al.actor,
  al.metadata,
  al.timestamp,
  cc.connector_type,
  cc.is_active
FROM audit_logs al
JOIN connector_configs cc ON al.entity_id = cc.id::text
WHERE al.action IN ('connector_config_update', 'connector_config_create', 'connector_credential_update')
  AND al.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY al.timestamp DESC;

-- Check connector destination/endpoint changes
SELECT id, connector_type, tenant_id,
  config->>'endpoint' AS endpoint,
  config->>'bucket' AS bucket,
  config->>'database' AS database,
  updated_at
FROM connector_configs
WHERE updated_at >= NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

### RemediationExecutorService Action Audit
```sql
-- Review remediation actions for scope accuracy
-- RemediationExecutorService supports 12 action types across 11 connectors (CAPABILITY_MATRIX)
SELECT
  ra.id,
  ra.tenant_id,
  ra.action_type,
  ra.connector_type,
  ra.target_entity,
  ra.scope,
  ra.status,
  ra.executed_at,
  ra.executed_by,
  ra.result_metadata
FROM remediation_actions ra
WHERE ra.tenant_id = 'TENANT_ID'
  AND ra.executed_at >= NOW() - INTERVAL '48 hours'
ORDER BY ra.executed_at DESC;

-- Cross-reference with CAPABILITY_MATRIX -- verify action was valid for connector
-- Valid action types: mask, encrypt, delete, quarantine, restrict_access, notify_owner,
-- classify, tag, move, archive, redact, pseudonymize
```

### Data Flow Tracing via NATS Events
```bash
# Trace data movement events through NATS JetStream
nats consumer info PRIVACYOPS_EVENTS DLP_AUDIT_CONSUMER --json

# Check for data export events in the event stream
kubectl logs -l app=privacyops-api --since=24h | grep -E "nats.*publish.*(data_export|data_copy|data_move|bulk_read)" | head -50

# Verify HMAC signatures on data movement events
kubectl logs -l app=privacyops-api --since=24h | grep -i "hmac.*data" | head -20
```

---

## 5. Resolution Steps

### Unauthorized Export via Connector
1. **Confirm connector is disabled** (done in immediate actions).
2. **Assess data exposure scope:**
   ```sql
   SELECT DISTINCT
     data_category,
     COUNT(*) AS record_count,
     MIN(scanned_at) AS earliest_scan,
     MAX(scanned_at) AS latest_scan
   FROM scan_results
   WHERE connector_id = 'CONNECTOR_ID' AND tenant_id = 'TENANT_ID'
   GROUP BY data_category;
   ```
3. **Revoke connector credentials** at the source system (S3 bucket policy, Snowflake user, PostgreSQL role, etc.).
4. **Request data deletion** from unauthorized destination if accessible.
5. **Re-scan with corrected connector configuration** after root cause is fixed.

### DSAR Over-Disclosure
1. **Revoke the DSAR download link** immediately:
   ```sql
   UPDATE dsar_requests SET status = 'revoked', download_url = NULL, updated_at = NOW()
   WHERE id = 'DSAR_REQUEST_ID';
   ```
2. **Contact the data subject** to request deletion of over-disclosed data.
3. **Root cause the redaction failure:**
   - Was the PII redaction pipeline bypassed?
   - Did the fail-closed mechanism (`status = 'redaction_failed'`) work correctly?
   - Were the data categories in the DSAR scope incorrectly expanded?
4. **Re-process the DSAR** with correct scope and verified redaction.

### Remediation Action Over-Scope
1. **Reverse the remediation action** if possible (depends on action type):
   - `delete` -- restore from backup if within retention window
   - `mask`/`encrypt`/`pseudonymize` -- apply to correct scope, restore original for incorrect scope
   - `quarantine` -- release incorrectly quarantined data
2. **Review the CAPABILITY_MATRIX** mapping for the affected connector to verify action compatibility.
3. **Audit all pending remediation actions** in the REMEDIATION task queue for similar scope issues.

---

## 6. Communication Template

### Internal (Security + DPO)
```
DATA LOSS PREVENTION INCIDENT: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Type: [Unauthorized export / DSAR over-disclosure / Remediation over-scope / Connector misconfig]
Affected Tenant(s): [List]
Data Categories Exposed: [PII types, sensitivity level]
Volume: [Record count / Size estimate]
Connector Involved: [Type and ID]
Containment: [Active / Contained]
Regulatory Notification Required: [Assessment pending / Yes -- GDPR Art. 33 / No]
IC: [Name]
```

### External (Affected Tenant -- Legal Review Required)
```
We identified a data handling incident in your PrivacyOps environment on [DATE].
Scope: [Description of data categories and volume affected]
Root Cause: [Brief, non-technical description]
Actions Taken: [What was done to contain and remediate]
Your Required Actions: [If any -- e.g., notify their own data subjects]
We are available to support your internal assessment and regulatory obligations.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | Security on-call + DPO notified |
| 15 min | Security Engineering lead for SEV-1/SEV-2 |
| 30 min | Legal counsel for regulatory assessment |
| 1 hour | CISO briefing; breach notification clock starts if personal data confirmed |
| 4 hours | Customer Success notifies affected tenants |
| 24 hours | Regulatory notification decision finalized |
| 72 hours | GDPR supervisory authority notification deadline (if applicable) |

---

## 8. Post-Incident Review

- Document complete data flow from source to unauthorized destination
- Review DSAR redaction pipeline for systemic vulnerabilities
- Audit RemediationExecutorService CAPABILITY_MATRIX accuracy for all 11 connectors
- Verify fail-closed redaction mechanism is functioning (DSAR status = 'redaction_failed' blocks download)
- Review connector configuration change approval process
- Assess whether ABAC policies adequately restrict data export actions
- Verify NATS HMAC signing prevented event tampering during the incident
- Review hash chain audit log for completeness of data movement records
- Update DLP detection rules based on attack pattern observed
- Conduct training for teams on data handling procedures

---

## 9. Related Runbooks

- [Security Incident Playbook](./security-incident-playbook.md)
- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md)
- [Connector Failure Playbook](./connector-failure-playbook.md)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
- [AI Copilot Failure Playbook](./ai-copilot-failure-playbook.md)
