# AI Co-Pilot Failure Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-AI-009
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / AI/ML Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `AICopilotCircuitBreakerOpen` -- circuit breaker triggered after 5 failures within 60 seconds
- Prometheus alert `AICopilotPIIRedactionFailure` -- PII redaction pipeline failure (fail-closed: blocks all AI responses)
- Prometheus alert `AICopilotLatencyHigh` -- model endpoint response time > 10 seconds p95
- Prometheus counter `ai_copilot_errors_total` spike exceeding 3x baseline
- OpenTelemetry trace shows AI co-pilot span failing with redaction pipeline error
- NATS event `ai.copilot.circuit_breaker.open` published
- Feature gate `ai_llm_enrichment` evaluation errors in tenant context
- BullMQ AI processing queue depth growing with no completions

### Manual Detection
- Users report AI co-pilot suggestions not appearing or returning errors
- AI-assisted data classification not enriching scan results
- Tenant admin reports AI features disabled unexpectedly

### Circuit Breaker Behavior
The AI co-pilot circuit breaker opens after **5 consecutive failures within a 60-second window**. When open:
- All AI co-pilot requests are immediately rejected (fail-fast)
- Circuit breaker enters half-open state after a configurable cooldown period
- A single successful request in half-open state closes the circuit
- PII redaction failures are treated as circuit breaker failures

### PII Redaction Behavior (Fail-Closed)
The PII redaction pipeline operates in **fail-closed** mode:
- If PII redaction fails for any reason, the AI response is **blocked entirely**
- No unredacted data is ever returned to the user
- The system logs the failure and increments the circuit breaker failure counter
- This is a deliberate safety design -- data protection over availability

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | PII redaction bypass -- unredacted PII exposed in AI responses | Immediate |
| SEV-2 | Circuit breaker stuck open across all tenants; AI features fully unavailable | < 15 minutes |
| SEV-3 | Circuit breaker flapping; intermittent AI failures; single tenant affected | < 1 hour |
| SEV-4 | AI latency degraded; feature gate misconfiguration; cosmetic AI issues | < 4 hours |

**NOTE:** A PII redaction bypass (SEV-1) is a data protection incident. Immediately engage the [Security Incident Playbook](./security-incident-playbook.md).

---

## 3. Immediate Actions (First 15 Minutes)

1. **Verify circuit breaker state:**
   ```bash
   # Check circuit breaker status via metrics
   curl -s http://privacyops-api:9090/metrics | grep -E "ai_copilot_circuit_breaker|ai_copilot_state"

   # Check application logs for circuit breaker events
   kubectl logs -l app=privacyops-api --since=15m | grep -i "circuit.breaker\|ai.*copilot.*fail\|pii.*redact"
   ```

2. **Verify PII redaction is fail-closed (CRITICAL):**
   ```bash
   # Confirm no AI responses were served without redaction
   kubectl logs -l app=privacyops-api --since=1h | grep -E "pii_redaction_bypassed|redaction_skipped"
   # This should return ZERO results. ANY results = SEV-1 escalation

   # Check redaction failure logs
   kubectl logs -l app=privacyops-api --since=1h | grep -i "redaction_failed\|pii.*fail"
   ```

3. **Check model endpoint availability:**
   ```bash
   # Test connectivity to the AI model endpoint
   curl -s -o /dev/null -w "%{http_code} %{time_total}s" \
     -X POST https://MODEL_ENDPOINT/v1/completions \
     -H "Authorization: Bearer $AI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "test", "max_tokens": 1}'

   # Check model endpoint error rates
   curl -s http://privacyops-api:9090/metrics | grep "ai_model_endpoint"
   ```

4. **Check tenant feature gate status:**
   ```sql
   -- Verify ai_llm_enrichment feature gate status per tenant
   SELECT
     ts.tenant_id,
     ts.feature_gates->>'ai_llm_enrichment' AS ai_enabled,
     ts.updated_at
   FROM tenant_settings ts
   WHERE ts.feature_gates->>'ai_llm_enrichment' IS NOT NULL
   ORDER BY ts.updated_at DESC;
   ```

5. **If PII redaction bypass confirmed (SEV-1):**
   - **IMMEDIATELY disable AI co-pilot for ALL tenants:**
     ```bash
     kubectl set env deployment/privacyops-api AI_COPILOT_ENABLED=false
     kubectl rollout restart deployment/privacyops-api
     ```
   - Engage [Security Incident Playbook](./security-incident-playbook.md)
   - Notify CISO and DPO

---

## 4. Investigation Steps

### Circuit Breaker Analysis
```bash
# Review the 5 failures that triggered the circuit breaker
kubectl logs -l app=privacyops-api --since=30m | \
  grep -B2 -A5 "circuit.*breaker\|ai.*copilot.*error" | head -80

# Check failure pattern -- are failures from a specific:
# - Tenant? (feature gate issue)
# - Request type? (specific AI operation failing)
# - Time window? (transient endpoint issue)
kubectl logs -l app=privacyops-api --since=1h | \
  grep "ai_copilot_error" | \
  jq -r '{tenant_id: .tenant_id, operation: .operation, error: .error, timestamp: .timestamp}' 2>/dev/null | head -20

# Check if circuit breaker cooldown is working
kubectl logs -l app=privacyops-api --since=1h | grep -i "half.open\|circuit.*close\|circuit.*open"
```

### PII Redaction Pipeline Diagnosis
```bash
# Check redaction service health
kubectl logs -l app=privacyops-api --since=30m | grep -i "pii\|redact\|sanitiz" | tail -30

# Check if the redaction model/regex patterns are loading correctly
kubectl logs -l app=privacyops-api --since=30m | grep -i "redaction.*init\|pattern.*load\|ner.*model"

# Verify fail-closed behavior in the code path
# The redaction pipeline should:
# 1. Process AI response through PII detection
# 2. Redact detected PII entities
# 3. If ANY step fails -> block response entirely (fail-closed)
# 4. Log the failure
# 5. Increment circuit breaker failure counter

# Check for redaction timeout issues
kubectl logs -l app=privacyops-api --since=30m | grep -i "redaction.*timeout"
```

### Model Endpoint Investigation
```bash
# Check model endpoint response codes over time
kubectl logs -l app=privacyops-api --since=2h | \
  grep "ai_model_response" | \
  awk '{print $1, $NF}' | \
  sort | uniq -c | sort -rn

# Check for rate limiting from the model provider
kubectl logs -l app=privacyops-api --since=1h | grep -i "rate.limit\|429\|throttl"

# Check for model endpoint DNS resolution
kubectl exec deployment/privacyops-api -- nslookup MODEL_ENDPOINT_HOST

# Check model API key validity
kubectl exec deployment/privacyops-api -- printenv | grep AI_API_KEY | head -c 20
# Verify key prefix matches expected format (do NOT log full key)
```

### Feature Gate Investigation
```sql
-- Check if ai_llm_enrichment feature gate was recently modified
SELECT
  al.tenant_id,
  al.action,
  al.metadata,
  al.actor,
  al.timestamp
FROM audit_logs al
WHERE al.action IN ('feature_gate_update', 'feature_gate_disable', 'tenant_settings_update')
  AND al.metadata::text LIKE '%ai_llm_enrichment%'
ORDER BY al.timestamp DESC
LIMIT 20;

-- Check FeatureGate Guard (Layer 5) rejections related to AI
-- These rejections are legitimate if the tenant does not have the feature
```

---

## 5. Resolution Steps

### Circuit Breaker Recovery

**If model endpoint is back online:**
```bash
# The circuit breaker should auto-recover through its half-open state
# Monitor for successful requests
kubectl logs -l app=privacyops-api -f | grep -i "circuit.*close\|ai.*copilot.*success"

# If the circuit breaker is stuck, force-restart the API pods to reset state
kubectl rollout restart deployment/privacyops-api
```

**If model endpoint is down for extended period:**
1. Verify with the model provider (OpenAI, Anthropic, Azure, etc.) for service status.
2. Switch to backup model endpoint if configured:
   ```bash
   kubectl set env deployment/privacyops-api AI_MODEL_ENDPOINT=https://BACKUP_ENDPOINT/v1
   kubectl rollout restart deployment/privacyops-api
   ```
3. If no backup endpoint, disable AI features gracefully:
   ```sql
   -- Temporarily disable ai_llm_enrichment for all tenants
   UPDATE tenant_settings
   SET feature_gates = jsonb_set(feature_gates, '{ai_llm_enrichment}', '"disabled_incident"'),
       updated_at = NOW();
   ```

### PII Redaction Failure Recovery

**Redaction model/patterns failing to load:**
1. Check the redaction model artifact is accessible:
   ```bash
   kubectl exec deployment/privacyops-api -- ls -la /app/models/pii-redaction/
   ```
2. Verify redaction regex patterns are valid:
   ```bash
   kubectl exec deployment/privacyops-api -- node -e "
     const patterns = require('/app/config/pii-patterns.json');
     patterns.forEach(p => { try { new RegExp(p.regex); } catch(e) { console.error('Invalid:', p.name, e.message); }});
     console.log('All patterns valid');
   "
   ```
3. Restart pods to re-initialize the redaction pipeline.

**Redaction timeout:**
1. Increase the redaction timeout if responses are large:
   ```bash
   kubectl set env deployment/privacyops-api AI_REDACTION_TIMEOUT_MS=10000
   ```
2. NEVER disable the fail-closed behavior to work around timeouts.

### Feature Gate Emergency Disable
```sql
-- Emergency disable AI co-pilot for a specific tenant
UPDATE tenant_settings
SET feature_gates = jsonb_set(feature_gates, '{ai_llm_enrichment}', '"false"'),
    updated_at = NOW()
WHERE tenant_id = 'TENANT_ID';
```

### Verification After Recovery
```bash
# Verify AI co-pilot is functioning with PII redaction active
# Use a test request with known PII to confirm redaction works
kubectl exec deployment/privacyops-api -- curl -s -X POST http://localhost:3000/api/v1/ai/test \
  -H "Content-Type: application/json" \
  -d '{"prompt": "classify this: John Doe, SSN 123-45-6789, john@example.com"}' | jq .

# The response should show:
# - PII entities detected and redacted
# - No raw PII in the response
# - Circuit breaker state = closed
```

---

## 6. Communication Template

### Internal
```
AI CO-PILOT INCIDENT: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Issue: [Circuit breaker open / PII redaction failure / Model endpoint down / Feature gate error]
Circuit Breaker State: [Open / Half-Open / Closed]
PII Redaction Status: [Fail-closed active / COMPROMISED -- SEV-1]
Affected Tenants: [All with ai_llm_enrichment / Specific list]
Model Endpoint: [Available / Unavailable / Degraded]
Status: [Investigating / Mitigating / Resolved]
IC: [Name]
```

### External (If PII Exposure -- Legal Review Required)
```
We identified an issue with our AI-assisted features that may have resulted
in incomplete data redaction in AI-generated suggestions on [DATE].
We immediately disabled the affected feature and are conducting a review.
[Details of any data exposure, if applicable]
AI-assisted features will be re-enabled after our security team verifies
the redaction pipeline is functioning correctly.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer assesses circuit breaker and redaction status |
| 5 min | If PII redaction bypass: CISO + DPO immediately; follow Security Incident Playbook |
| 15 min | AI/ML team lead for circuit breaker or model endpoint issues |
| 30 min | Platform Engineering lead for systemic failures |
| 1 hour | VP Engineering for extended AI outage affecting tenants |
| 2 hours | Model provider support engagement for endpoint issues |

---

## 8. Post-Incident Review

- Verify PII redaction was fail-closed throughout the incident (no data leaked)
- Review circuit breaker threshold (5 failures / 60 seconds) -- is it appropriate?
- Assess model endpoint reliability and backup strategy
- Review PII redaction pattern coverage -- were there PII types not being caught?
- Audit the feature gate `ai_llm_enrichment` -- are the right tenants enabled?
- Assess whether circuit breaker state should be persisted (survives pod restarts)
- Review AI response caching -- were any cached responses served without fresh redaction?
- Consider adding synthetic PII canary requests for continuous redaction verification
- Update the model endpoint health check frequency
- Document the fail-closed behavior for new team members

---

## 9. Related Runbooks

- [Security Incident Playbook](./security-incident-playbook.md) (for PII redaction bypass)
- [Data Loss Prevention Playbook](./data-loss-prevention-playbook.md)
- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [System Outage Playbook](./system-outage-playbook.md)
