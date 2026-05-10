# TechD PrivacyOps + DSPM Platform -- Troubleshooting Guide

**Owner:** Platform Engineering Team
**Review Cycle:** Monthly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Operations

---

## 1. Overview

This guide covers troubleshooting procedures for the most common operational issues on the TechD PrivacyOps platform. Each section follows the pattern: symptoms, diagnosis, root cause analysis, and resolution.

---

## 2. Failed Scans

### 2.1 Symptoms

- Scan status shows `FAILED` in the dashboard
- SCAN Temporal workflow terminated with error
- Tenant reports scan not completing
- BullMQ scan job in failed state

### 2.2 Diagnosis

```bash
# 1. Get the scan workflow details from Temporal
tctl workflow describe -w scan-<scan-id>

# 2. Check the workflow event history for the failure point
tctl workflow show -w scan-<scan-id> --output_filename /tmp/scan-history.json

# 3. Search application logs for the scan
# Kibana: scanId: "<scan-id>" AND level: "error"

# 4. Check BullMQ job details
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD hgetall "bull:scan:<job-id>"
```

### 2.3 Common Root Causes and Resolutions

**Connector authentication expired:**
```
Error: "IConnector.authenticate() failed: 401 Unauthorized"
```
Resolution: Navigate to Admin > Connectors > [connector] > Re-authorize. The connector will re-execute the OAuth flow.

**Connector rate limit exceeded:**
```
Error: "IConnector.fetchRecords() failed: 429 Too Many Requests"
```
Resolution: The scan will auto-retry with exponential backoff. If persistent, check if the tenant has multiple concurrent scans running against the same connector. Stagger scan schedules.

**Out of memory during large scan:**
```
Error: "JavaScript heap out of memory" or OOMKilled in pod events
```
Resolution: Increase the Temporal worker memory limit for the SCAN task queue. For very large datasets (>5M records), enable streaming mode in the scan configuration.

**Schema discovery failure:**
```
Error: "discoverSchema activity failed: Unknown object type"
```
Resolution: The connector's target system has a schema change. Check if the IConnector implementation needs updating for the new schema. Create an engineering ticket.

---

## 3. Stuck Temporal Workflows

### 3.1 Symptoms

- Workflow status is `RUNNING` but no activity progress
- Task queue has pending tasks but no active pollers
- Workflow running time exceeds expected duration by 3x+

### 3.2 Diagnosis

```bash
# 1. Check if workers are polling the task queue
tctl taskqueue describe -tq <QUEUE_NAME>
# Look for "pollers" section -- if empty, no workers are registered

# 2. Check worker pod status
kubectl get pods -n privacyops -l component=temporal-worker-<queue>

# 3. Check for a specific stuck workflow
tctl workflow describe -w <workflow-id>
# Look at "pendingActivities" for activities waiting to be scheduled

# 4. Check workflow history length (poison pill detection)
tctl workflow show -w <workflow-id> -o json | jq '.events | length'
# If > 10000 events, the workflow may be approaching history limit
```

### 3.3 Common Root Causes and Resolutions

**No workers polling the task queue:**
Resolution: Check if the worker deployment is healthy. Restart the worker pods for the affected queue:
```bash
kubectl rollout restart deployment temporal-worker-<queue> -n privacyops
```

**Activity timeout too short:**
```
Error: "activity StartToClose timeout exceeded"
```
Resolution: Increase the activity timeout in the workflow definition. For scan activities processing large datasets, the default 5-minute timeout may be insufficient.

**Workflow history approaching limit (50K events):**
Resolution: The workflow is using `continueAsNew` incorrectly or has an infinite loop. Terminate and investigate:
```bash
tctl workflow terminate -w <workflow-id> --reason "History limit approaching - investigation required"
```

**Temporal server resource exhaustion:**
Resolution: Check Temporal server metrics. Scale the Temporal frontend/history/matching services if needed.

---

## 4. DSAR Processing Errors

### 4.1 Symptoms

- DSAR request stuck in `PROCESSING` state
- DSAR Temporal workflow shows activity failures
- PII redaction step failing or timing out
- DSAR response not generated within SLA

### 4.2 Diagnosis

```bash
# 1. Check the DSAR workflow
tctl workflow describe -w dsar-<dsar-id>

# 2. Check AI co-pilot circuit breaker (PII redaction dependency)
curl -sf https://api.privacyops.techd.io/admin/ai-copilot/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Check which connector data extraction is failing
# Kibana: dsarId: "<dsar-id>" AND level: "error"
```

### 4.3 Common Root Causes and Resolutions

**AI co-pilot circuit breaker is OPEN (PII redaction blocked):**
The DSAR pipeline is fail-closed. If PII redaction cannot complete, the entire DSAR response is blocked.
Resolution:
1. Check upstream LLM provider status
2. Verify PII redaction service pods are healthy
3. Wait for circuit breaker auto-recovery (HALF_OPEN probe after 60s)
4. If urgent and approaching deadline, escalate to Tier 3 for manual redaction assessment

**Connector data extraction timeout:**
```
Error: "extractSubjectData activity timed out for connector: <type>"
```
Resolution: The connector may be processing a very large dataset for the subject. Check the connector's rate limits and increase the activity timeout if necessary.

**Subject not found across connectors:**
```
Warn: "No data found for subject across 12 connectors"
```
Resolution: Verify the subject identifier (email, user ID) is correct. Check if the data was already deleted by a previous DSAR or retention policy. This may be a valid "no data" response.

**Fail-closed redaction producing empty response:**
```
Error: "Redaction pipeline returned empty result - fail-closed activated"
```
Resolution: The redaction engine could not process the data. Check for malformed data from connectors. If the data contains unsupported formats, the redaction engine blocks all output rather than risk leaking PII. Engineering may need to add format support.

---

## 5. Connector Auth Failures

### 5.1 Symptoms

- Connector health check returns `auth_expired`
- Scans failing with 401/403 errors
- Connector last_authenticated timestamp is stale

### 5.2 Diagnosis

```bash
# 1. Check connector health
curl -sf https://api.privacyops.techd.io/admin/connectors/<id>/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Check connector credentials status
# Kibana: module: "ConnectorService" AND connectorId: "<id>" AND level: "error"
```

### 5.3 Common Root Causes and Resolutions

**OAuth token expired (no refresh token):**
Resolution: Some providers require periodic re-authorization. Navigate to Admin > Connectors > Re-authorize.

**OAuth refresh token rotation failed:**
Resolution: The provider may have rotated the refresh token but the new one was not stored. Check for errors in the token refresh flow. Re-authorize the connector.

**API key revoked at provider:**
Resolution: Generate a new API key at the provider and update it in the connector configuration. Rotate via Admin > Connectors > Edit Credentials.

**IP allowlist changed at provider:**
Resolution: Verify the platform's egress IP addresses are still allowlisted at the provider. Check if Kubernetes node IPs have changed after a cluster upgrade.

**Connector credential stored in wrong tenant context:**
Resolution: RLS ensures credentials are tenant-scoped. If a connector appears to work for one tenant but not another, verify the credential was stored under the correct tenant ID.

---

## 6. WebSocket Disconnects (Socket.IO)

### 6.1 Symptoms

- Users report real-time updates not appearing in the Next.js frontend
- Socket.IO connection status shows disconnected
- WebSocket events not being delivered

### 6.2 Diagnosis

```bash
# 1. Check Socket.IO adapter health
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD keys "socket.io*" | wc -l

# 2. Check connected client count
curl -sf https://api.privacyops.techd.io/admin/websocket/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Check for Redis adapter errors
# Kibana: module: "SocketIOAdapter" AND level: "error"
```

### 6.3 Common Root Causes and Resolutions

**Redis adapter disconnected:**
Resolution: The Socket.IO Redis adapter uses IORedis for cluster coordination. If Redis is unreachable, all WebSocket state is lost. Restart the API pods after Redis is restored.

**Load balancer sticky sessions misconfigured:**
Resolution: Socket.IO requires sticky sessions when running multiple API instances. Verify the Kubernetes ingress has session affinity configured:
```yaml
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "privacyops_ws"
```

**Client reconnection storm after deployment:**
Resolution: After a rolling deployment, all connected clients reconnect simultaneously. This is normal. If it causes resource pressure, implement connection throttling via Socket.IO's `connectTimeout` option.

---

## 7. JWT Expiration and Auth Issues

### 7.1 Symptoms

- Users receiving 401 Unauthorized responses
- Auth guard logs show JWT validation failures
- Token refresh not working

### 7.2 Diagnosis

```bash
# 1. Check JWT-related errors
# Kibana: module: "AuthGuard:JWT" AND level: "warn"

# 2. Decode a JWT to inspect claims (do NOT log the token)
# Use jwt.io or a local tool -- never paste production tokens into online tools

# 3. Verify JWT_SECRET is accessible
kubectl get secret privacyops-secrets -n privacyops -o jsonpath='{.data.JWT_SECRET}' | base64 -d | wc -c
```

### 7.3 Common Root Causes and Resolutions

**JWT_SECRET rotated but old tokens still in use:**
Resolution: After a secret rotation, existing tokens are invalidated. Users must re-authenticate. If this was an unplanned rotation, communicate to affected tenants.

**Clock skew between services:**
Resolution: JWT validation includes `nbf` (not before) and `exp` (expiration) checks. If Kubernetes nodes have clock skew > 30s, tokens may be prematurely rejected. Verify NTP synchronization on all nodes.

**Token issued for wrong tenant:**
Resolution: The Tenant auth guard validates that the JWT's tenant claim matches the request's tenant context. If a user switched tenants without re-authenticating, they will be rejected. This is by design.

---

## 8. RLS Violations

### 8.1 Symptoms

- Error logs showing "RLS policy violation"
- Queries returning empty results when data exists
- Permission denied errors on database operations

### 8.2 Diagnosis

```sql
-- Check current RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('scans', 'dsar_requests', 'audit_logs', 'legal_holds');

-- Verify the session tenant context is being set
SHOW app.current_tenant_id;
```

### 8.3 Common Root Causes and Resolutions

**Tenant context not propagated to database session:**
Resolution: The Prisma middleware must set `app.current_tenant_id` via `SET LOCAL` before each query. If the middleware is bypassed (raw queries), RLS blocks the query. Fix the query to use the Prisma client with tenant context.

**LegalHold RLS bypass attempt:**
This is always a P1 security incident. LegalHold data is protected by additional RLS policies that prevent deletion even by the owning tenant during active legal holds.
Resolution: Investigate whether this is a code bug or a deliberate bypass attempt. Engage Security On-Call immediately.

**Migration altered RLS policies:**
Resolution: After Prisma migrations, verify that RLS policies are intact. Run the RLS verification query from the health check procedures. If policies are missing, re-apply them from the migration scripts.

---

## 9. Remediation Failures by Action Type

### 9.1 Diagnosis

```bash
# Check which action types are failing
# Kibana: module: "RemediationExecutor" AND level: "error" | stats count by metadata.actionType

# Check CAPABILITY_MATRIX compatibility
curl -sf https://api.privacyops.techd.io/admin/remediation/capability-matrix \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 9.2 Failures by Action Type

The RemediationExecutorService supports 12 action types. Common failures:

**ACCESS_REVOKE:** Provider API does not support programmatic access revocation. Check CAPABILITY_MATRIX -- only 8 of 11 connectors support this action.

**DATA_DELETE:** Deletion may require APPROVAL workflow completion first. Check if the approval is pending in the APPROVAL task queue. Verify LegalHold is not blocking deletion.

**DATA_MASK:** Masking failure often indicates the field type is not supported for masking. Check connector-specific masking capabilities.

**ENCRYPT:** Encryption key not available for the target connector. Verify KMS integration for the specific connector.

**QUARANTINE:** Quarantine location not configured for the connector. Admin must configure the quarantine destination.

**NOTIFY_OWNER:** Notification channel (email/Slack) not configured for the data owner. Check owner mapping configuration.

### 9.3 CAPABILITY_MATRIX Reference

Before troubleshooting, verify the action is supported for the target connector:

```bash
curl -sf https://api.privacyops.techd.io/admin/remediation/capability-matrix \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.matrix["<connectorType>"]'
```

If the action is not in the matrix for that connector, it cannot be executed. The RemediationExecutorService will reject unsupported actions with a clear error message.

---

## 10. NATS Event Processing Failures

### 10.1 Symptoms

- DLQ depth increasing
- Events not being processed
- HMAC validation failures

### 10.2 Diagnosis

```bash
# Check consumer status
nats consumer info PRIVACYOPS_EVENTS <consumer-name>

# Check DLQ
nats stream info PRIVACYOPS_DLQ

# Check for HMAC failures
# Kibana: message: "HMAC_VALIDATION_FAILED"
```

### 10.3 Common Root Causes and Resolutions

**HMAC validation failures:**
```
Error: "HMAC_VALIDATION_FAILED: signature mismatch"
```
Resolution: The HMAC signing key may have been rotated on the publisher but not the consumer. Verify both use the same key. If tampering is suspected, escalate as P1.

**Idempotency key collision:**
```
Warn: "Duplicate idempotency key detected, skipping message"
```
This is expected behavior. The idempotency window is 72 hours. If you see excessive duplicates, check if a publisher is retrying too aggressively.

**Consumer max delivery exceeded:**
```
Error: "Max deliveries exceeded for message, sending to DLQ"
```
Resolution: The message failed processing after all retry attempts. Inspect the DLQ message for the original error. Fix the underlying issue and republish.

---

## 11. Billing Integration Issues

### 11.1 NullBillingProvider in Production

```
CRITICAL: "NullBillingProvider detected in production environment"
```

This is always a P1. The production guard should prevent NullBillingProvider from being used. If this appears:
1. Immediately check the `BILLING_PROVIDER` environment variable
2. Verify the Stripe configuration is present
3. Check if a recent deployment inadvertently changed the billing configuration
4. Escalate to VP Engineering

### 11.2 Stripe Webhook Failures

```bash
# Check webhook delivery status
curl -sf https://api.privacyops.techd.io/admin/billing/webhook-status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Resolution: Verify the Stripe webhook signing secret matches. Check if the webhook endpoint URL changed after a deployment. Verify network connectivity to Stripe.

---

## 12. Quick Diagnostic Checklist

When troubleshooting any issue, start with this sequence:

1. [ ] Check `/health` endpoint -- is the API responding?
2. [ ] Check pod status -- `kubectl get pods -n privacyops`
3. [ ] Check recent deployments -- `kubectl rollout history -n privacyops`
4. [ ] Check error logs for the last 30 minutes -- Kibana or Grafana Loki
5. [ ] Check Temporal workflow status for affected task queue
6. [ ] Check NATS consumer lag and DLQ depth
7. [ ] Check Redis memory and connection count
8. [ ] Check PostgreSQL active connections and long queries
9. [ ] Check AI co-pilot circuit breaker state
10. [ ] Correlate findings using OpenTelemetry trace IDs
