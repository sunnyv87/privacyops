# Connector Failure Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-CON-005
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / Connectors Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `ConnectorErrorRate` -- IConnector implementation error rate exceeds 10% over 5 minutes
- Temporal activity timeout on SCAN task queue -- scan workflow activity exceeds configured timeout
- BullMQ scan job moved to failed queue after max retries
- NATS event `connector.health.degraded` or `connector.health.down` published
- OpenTelemetry trace shows connector span duration exceeding 3x p99 baseline
- Prometheus counter `connector_failures_total{connector_type="..."}` spike
- Circuit breaker opened on a specific connector type (if connector-level CB is enabled)
- Scan workflow enters `scan_failed` status with connector error code

### Manual Detection
- Customer reports missing or stale scan results for a specific data source
- Connector dashboard shows last successful scan > 24 hours ago
- Data classification results not updating despite active scan schedule

### Connector Inventory (43 Registered, 11 in CAPABILITY_MATRIX)
The platform has 43 connectors implementing the `IConnector` interface. The `RemediationExecutorService` CAPABILITY_MATRIX currently maps remediation actions for 11 connectors. Common failure-prone connectors include: S3, PostgreSQL, Snowflake, BigQuery, MySQL, MongoDB, Azure Blob, GCS, Salesforce, Slack, and Jira.

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 (Critical) | Multiple connectors down; active DSAR/Breach workflows blocked; > 10 tenants affected | Immediate |
| SEV-2 (High) | Single critical connector down (S3, PostgreSQL, Snowflake); active scans failing; DSAR deadline risk | < 15 minutes |
| SEV-3 (Medium) | Non-critical connector degraded; scan latency increased but completing; single tenant | < 1 hour |
| SEV-4 (Low) | Intermittent connector timeouts; non-production connector; scheduled scan delayed | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Identify the failing connector and scope:**
   ```bash
   # Check connector health across all types
   kubectl logs -l app=privacyops-api --since=15m | grep -E "IConnector|connector.*error|connector.*timeout|connector.*failed" | \
     awk -F'"connector_type":"' '{print $2}' | cut -d'"' -f1 | sort | uniq -c | sort -rn

   # Check active scan workflows on SCAN task queue
   tctl --ns privacyops-production workflow list --status open --query "TaskQueue='SCAN'" | head -20
   ```

2. **Assess tenant impact:**
   ```sql
   SELECT
     cc.connector_type,
     cc.tenant_id,
     cc.is_active,
     cc.last_health_check,
     cc.last_scan_at,
     cc.error_count
   FROM connector_configs cc
   WHERE cc.connector_type = 'FAILING_TYPE'
     AND cc.is_active = true
   ORDER BY cc.error_count DESC;
   ```

3. **Check if the connector failure is blocking DSAR or Breach workflows:**
   ```sql
   SELECT
     dr.id AS request_id,
     dr.request_type,
     dr.status,
     dr.deadline,
     dr.tenant_id,
     dr.data_sources
   FROM dsar_requests dr
   WHERE dr.status IN ('in_progress', 'collecting_data')
     AND dr.data_sources::jsonb ? 'FAILING_CONNECTOR_TYPE'
     AND dr.deadline <= NOW() + INTERVAL '7 days';
   ```

4. **Check external service status** for the connector's target system (AWS status page, Snowflake status, etc.).

5. **Notify affected tenants** if DSAR/Breach deadlines are at risk.

---

## 4. Investigation Steps

### Connector-Specific Troubleshooting

**Amazon S3 Connector**
```bash
# Test S3 connectivity
aws s3 ls s3://BUCKET_NAME --profile privacyops-connector 2>&1

# Common failures:
# - IAM role/policy changes: check AssumeRole permissions
# - Bucket policy updated: verify privacyops service account access
# - KMS key permissions: check decrypt permissions for encrypted objects
# - Regional endpoint issues: verify correct region configuration
# - Rate limiting (503 SlowDown): implement exponential backoff
```

**PostgreSQL Connector (external databases, not platform DB)**
```bash
# Test connectivity to the customer's PostgreSQL
psql -h EXTERNAL_HOST -U CONNECTOR_USER -d EXTERNAL_DB -c "SELECT 1;" 2>&1

# Common failures:
# - Network/firewall changes: verify security group or VPC peering
# - Credential rotation: customer rotated DB password without updating connector
# - SSL certificate expiry: check certificate validity
# - Connection limit exhausted: check max_connections on target
# - Schema changes: tables/columns referenced in scan config no longer exist
```

**Snowflake Connector**
```bash
# Test Snowflake connectivity
snowsql -a ACCOUNT -u CONNECTOR_USER -d DATABASE -s SCHEMA -q "SELECT CURRENT_TIMESTAMP();" 2>&1

# Common failures:
# - Warehouse suspended: warehouse auto-suspended and cannot resume
# - Role privileges revoked: USAGE or SELECT privileges removed
# - Network policy blocking: Snowflake network policy updated
# - Key pair authentication: RSA key expired or rotated
# - Credit exhaustion: Snowflake account credit limit reached
```

**MongoDB Connector**
```bash
# Common failures:
# - Replica set configuration change
# - Atlas IP whitelist not updated
# - Authentication mechanism change (SCRAM vs x.509)
# - Collection dropped or renamed
```

### General IConnector Interface Diagnostics
```bash
# Check connector health check results
kubectl logs -l app=privacyops-api --since=1h | grep "IConnector.healthCheck" | tail -20

# Check connector credential validation
kubectl logs -l app=privacyops-api --since=1h | grep "IConnector.validateCredentials" | tail -20

# Review OpenTelemetry traces for connector operations
curl -s "http://jaeger.internal:16686/api/traces?service=privacyops-api&operation=ConnectorScan&tags=connector_type:FAILING_TYPE&limit=10" | jq '.data[].spans[] | {duration: .duration, tags: [.tags[] | select(.key | startswith("error"))]}'
```

### Scan Workflow Analysis
```bash
# Check scan workflow history for failure details
tctl --ns privacyops-production workflow show -w SCAN_WORKFLOW_ID --print_full_history | grep -A5 "ActivityTaskFailed"

# Check for scan retry exhaustion
tctl --ns privacyops-production workflow list --status failed --query "TaskQueue='SCAN' AND CloseTime > '$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)'" | head -20
```

---

## 5. Resolution Steps

### Credential Issues
1. **Verify credentials are current** in the connector configuration.
2. **Re-encrypt and store updated credentials:**
   ```sql
   -- After obtaining new credentials, update via the application API
   -- Do NOT directly update encrypted credentials in the database
   ```
3. Use the platform admin API to update connector credentials through the proper encryption pipeline.

### Network/Connectivity Issues
1. **Verify network path** from the platform to the connector target:
   ```bash
   # From within the platform pod
   kubectl exec -it deployment/privacyops-api -- nc -zv EXTERNAL_HOST PORT
   kubectl exec -it deployment/privacyops-api -- curl -v telnet://EXTERNAL_HOST:PORT
   ```
2. **Check VPC peering, security groups, and firewall rules** for recent changes.
3. **Verify DNS resolution** from within the cluster.

### Scan Failure Recovery
1. **Retry failed scan workflows:**
   ```bash
   # Reset a specific failed scan workflow for retry
   tctl --ns privacyops-production workflow reset -w SCAN_WORKFLOW_ID --reason "Connector restored -- retry scan"
   ```
2. **Bulk retry for a connector type:**
   ```bash
   # List all failed scans for the connector type
   tctl --ns privacyops-production workflow list --status failed \
     --query "TaskQueue='SCAN' AND ConnectorType='FAILING_TYPE'" | \
     awk '{print $1}' | while read wid; do
       tctl --ns privacyops-production workflow reset -w "$wid" --reason "Bulk retry after connector fix"
     done
   ```

### Circuit Breaking (Connector Level)
- If the connector is failing repeatedly and impacting the SCAN queue:
  1. Temporarily disable the connector for affected tenants
  2. Set a health check interval to auto-re-enable when the external service recovers
  3. Notify tenants of the temporary suspension

### Emergency Connector Bypass for DSAR
- If a DSAR deadline is imminent and the connector is not recoverable:
  1. Mark the connector's data source as `unavailable` in the DSAR workflow
  2. Document the gap in the DSAR response
  3. Set a follow-up task to supplement the DSAR response when the connector recovers

---

## 6. Communication Template

### Internal
```
CONNECTOR FAILURE: [SEV-X] [Connector Type] Down
Detection Time: [TIMESTAMP UTC]
Affected Connector Type: [S3 / PostgreSQL / Snowflake / etc.]
Affected Tenants: [Count and IDs]
Root Cause: [Credential / Network / External service / Config]
DSAR/Breach Deadline Risk: [Yes -- details / No]
Active Scan Workflows Impacted: [Count]
Status: [Investigating / Mitigating / Resolved]
IC: [Name]
```

### External (Affected Tenant)
```
We are experiencing connectivity issues with [data source type] integrations.
Your scheduled scans for [data source name] may be delayed.
[If DSAR affected: Your DSAR request [ID] processing will resume once connectivity is restored.
We are monitoring regulatory deadlines and will communicate any risks.]
Expected resolution: [ESTIMATE]
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer identifies failing connector |
| 15 min | Connectors team lead engaged for SEV-1/SEV-2 |
| 30 min | Customer Success notifies affected tenants with DSAR/Breach deadlines |
| 1 hour | External vendor support engaged (AWS, Snowflake, etc.) if needed |
| 2 hours | DPO notified if DSAR regulatory deadlines at risk |
| 4 hours | Platform Engineering lead for systemic connector platform issues |

---

## 8. Post-Incident Review

- Document root cause with connector type specifics
- Review IConnector health check adequacy -- did it detect the issue?
- Assess whether circuit breaking should be added/tuned for this connector type
- Review retry and timeout settings for the connector's scan activities
- Update CAPABILITY_MATRIX if remediation actions were affected
- Assess credential rotation notification process with tenants
- Review monitoring coverage for all 43 registered connectors
- Update connector-specific troubleshooting documentation
- Verify scan data integrity after recovery -- were partial results stored?

---

## 9. Related Runbooks

- [System Outage Playbook](./system-outage-playbook.md)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [Data Loss Prevention Playbook](./data-loss-prevention-playbook.md)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
