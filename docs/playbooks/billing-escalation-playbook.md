# Billing Escalation Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-BILL-011
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / Billing Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `BillingProviderError` -- Stripe API error rate exceeds 5% over 5 minutes
- Prometheus alert `NullBillingProviderProduction` -- NullBillingProvider instantiated in production (CRITICAL: platform should have thrown on startup)
- Application startup failure with: `BillingProviderGuard: NODE_ENV=production requires BILLING_PROVIDER=stripe`
- Stripe webhook delivery failures -- webhook endpoint returning non-2xx for > 10 minutes
- Prometheus alert `SubscriptionSyncDrift` -- local subscription state diverged from Stripe
- Prometheus alert `UsageMeteringGap` -- usage events not reported to Stripe for > 1 hour
- BullMQ billing job queue showing failed jobs
- NATS event `billing.webhook.failed` or `billing.sync.error`
- Tenant provisioning failing due to Stripe customer creation errors

### Manual Detection
- Customer reports incorrect billing or inability to access paid features
- Finance team identifies revenue discrepancies in Stripe dashboard
- Tenant reports being downgraded despite active subscription
- Feature gates incorrectly restricting paid tenants (e.g., `ai_llm_enrichment` disabled for paying customer)

### Billing Architecture
```
BillingProvider Interface
  |
  +-- StripeBillingProvider (production)
  |     - Customer management
  |     - Subscription lifecycle
  |     - Usage-based metering
  |     - Webhook event processing
  |     - Invoice management
  |
  +-- NullBillingProvider (development/testing only)
        - No-op implementation
        - Production startup guard: throws if NODE_ENV=production AND BILLING_PROVIDER != 'stripe'
        - Prevents accidental free-tier operation in production
```

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | NullBillingProvider in production; all billing broken; tenants cannot subscribe | Immediate |
| SEV-2 | Stripe webhooks failing; subscription states stale; paid features incorrectly gated | < 15 minutes |
| SEV-3 | Usage metering gaps; single tenant billing issue; invoice generation failure | < 1 hour |
| SEV-4 | Minor sync drift; cosmetic billing UI issue; non-revenue-impacting | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Verify billing provider configuration:**
   ```bash
   # Check which billing provider is active
   kubectl get deployment/privacyops-api -o jsonpath='{.spec.template.spec.containers[0].env}' | \
     jq '.[] | select(.name == "BILLING_PROVIDER" or .name == "NODE_ENV" or .name == "STRIPE_SECRET_KEY")'

   # Check if the production startup guard fired
   kubectl logs -l app=privacyops-api --since=30m | grep -i "BillingProviderGuard\|NullBillingProvider\|BILLING_PROVIDER"

   # Verify the API is running (if startup guard threw, pods will be in CrashLoopBackOff)
   kubectl get pods -l app=privacyops-api -o wide
   ```

2. **Check Stripe API status:**
   ```bash
   # Verify Stripe API connectivity
   curl -s -o /dev/null -w "%{http_code}" https://api.stripe.com/v1/balance \
     -u "$STRIPE_SECRET_KEY:"

   # Check Stripe status page
   curl -s https://status.stripe.com/api/v2/status.json | jq '.status'
   ```

3. **Check Stripe webhook health:**
   ```bash
   # Check recent webhook events in application logs
   kubectl logs -l app=privacyops-api --since=30m | grep -i "stripe.*webhook\|webhook.*stripe" | tail -20

   # Check webhook endpoint status in Stripe
   # (requires Stripe CLI or dashboard access)
   stripe webhook_endpoints list --limit 5 2>/dev/null || echo "Use Stripe dashboard to check webhook endpoints"
   ```

4. **Assess tenant impact:**
   ```sql
   -- Check for tenants with stale subscription data
   SELECT
     t.id AS tenant_id,
     t.name,
     t.subscription_status,
     t.subscription_plan,
     t.stripe_customer_id,
     t.subscription_updated_at,
     NOW() - t.subscription_updated_at AS staleness
   FROM tenants t
   WHERE t.subscription_updated_at < NOW() - INTERVAL '24 hours'
     AND t.subscription_status = 'active'
   ORDER BY t.subscription_updated_at ASC;
   ```

5. **If NullBillingProvider is active in production (SEV-1):**
   ```bash
   # CRITICAL: Fix the environment variable immediately
   kubectl set env deployment/privacyops-api BILLING_PROVIDER=stripe

   # Verify STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set
   kubectl get secret privacyops-billing-secrets -o jsonpath='{.data}' | jq 'keys'

   # Restart pods
   kubectl rollout restart deployment/privacyops-api
   ```

---

## 4. Investigation Steps

### NullBillingProvider Production Guard
```bash
# The platform has a production startup guard that should THROW if:
# NODE_ENV=production AND BILLING_PROVIDER != 'stripe'
# If this guard did NOT fire, investigate why:

# Check if NODE_ENV is set correctly
kubectl exec deployment/privacyops-api -- printenv NODE_ENV

# Check if BILLING_PROVIDER is set correctly
kubectl exec deployment/privacyops-api -- printenv BILLING_PROVIDER

# Check the guard implementation in startup logs
kubectl logs -l app=privacyops-api --since=1h | grep -i "billing.*guard\|billing.*provider\|billing.*init"

# If the guard was bypassed, this is also a code-level issue -- check for recent changes
# to the guard logic
```

### Stripe Webhook Investigation
```bash
# Check webhook delivery log
kubectl logs -l app=privacyops-api --since=2h | grep -i "webhook" | \
  awk '{print $NF}' | sort | uniq -c | sort -rn

# Common webhook event types to monitor:
# customer.subscription.created
# customer.subscription.updated
# customer.subscription.deleted
# invoice.paid
# invoice.payment_failed
# checkout.session.completed

# Check for webhook signature verification failures
kubectl logs -l app=privacyops-api --since=2h | grep -i "webhook.*signature\|stripe.*verify\|webhook.*invalid"

# Check for webhook endpoint configuration
kubectl exec deployment/privacyops-api -- printenv STRIPE_WEBHOOK_SECRET | head -c 10
# Verify the whsec_ prefix is present (do not log full secret)
```

### Subscription Sync Investigation
```sql
-- Compare local subscription state with expected state
SELECT
  t.id,
  t.name,
  t.stripe_customer_id,
  t.subscription_status AS local_status,
  t.subscription_plan AS local_plan,
  t.subscription_updated_at,
  ts.feature_gates
FROM tenants t
JOIN tenant_settings ts ON t.id = ts.tenant_id
WHERE t.stripe_customer_id IS NOT NULL
ORDER BY t.subscription_updated_at ASC
LIMIT 50;

-- Check for feature gate mismatches (paid tenant with free-tier gates)
SELECT
  t.id,
  t.name,
  t.subscription_plan,
  ts.feature_gates->>'ai_llm_enrichment' AS ai_enabled,
  ts.feature_gates->>'advanced_scanning' AS scanning_enabled,
  ts.feature_gates->>'breach_notification' AS breach_enabled
FROM tenants t
JOIN tenant_settings ts ON t.id = ts.tenant_id
WHERE t.subscription_status = 'active'
  AND t.subscription_plan IN ('enterprise', 'professional')
  AND (
    ts.feature_gates->>'ai_llm_enrichment' = 'false'
    OR ts.feature_gates->>'advanced_scanning' = 'false'
  );
```

### Usage Metering Investigation
```sql
-- Check usage event reporting gaps
SELECT
  tenant_id,
  usage_type,
  MAX(reported_at) AS last_reported,
  NOW() - MAX(reported_at) AS gap,
  COUNT(*) AS pending_events
FROM usage_events
WHERE reported_to_stripe = false
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id, usage_type
ORDER BY gap DESC;

-- Check BullMQ billing jobs
```
```bash
# Check billing job queue status
redis-cli -h redis.internal LLEN "bull:billing:waiting"
redis-cli -h redis.internal LLEN "bull:billing:active"
redis-cli -h redis.internal LLEN "bull:billing:failed"

# Check failed billing job details
redis-cli -h redis.internal LRANGE "bull:billing:failed" 0 5 | head -50
```

### Audit Trail for Billing Events
```sql
-- Review billing-related audit log entries
SELECT
  al.tenant_id,
  al.action,
  al.entity_type,
  al.metadata,
  al.timestamp
FROM audit_logs al
WHERE al.action IN (
  'subscription_created', 'subscription_updated', 'subscription_canceled',
  'payment_succeeded', 'payment_failed', 'invoice_created',
  'usage_reported', 'billing_sync', 'feature_gate_update'
)
  AND al.timestamp >= NOW() - INTERVAL '48 hours'
ORDER BY al.timestamp DESC
LIMIT 50;
```

---

## 5. Resolution Steps

### NullBillingProvider in Production (SEV-1)
1. **Set BILLING_PROVIDER=stripe** (done in immediate actions).
2. **Verify Stripe credentials are valid:**
   ```bash
   curl -s https://api.stripe.com/v1/balance -u "$STRIPE_SECRET_KEY:" | jq .
   ```
3. **Run subscription sync** to reconcile all tenant states with Stripe:
   ```bash
   # Trigger a full subscription sync via admin API
   curl -s -X POST https://api.privacyops.techd.io/admin/billing/sync-all \
     -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
   ```
4. **Verify feature gates are correct** after sync for all paying tenants.
5. **Assess revenue impact:**
   - Were any tenants operating without billing during the NullBillingProvider window?
   - Generate usage records for the gap period from audit logs.

### Stripe Webhook Failures
1. **Verify webhook endpoint URL is correct** in Stripe dashboard.
2. **Verify webhook signing secret matches:**
   ```bash
   # The STRIPE_WEBHOOK_SECRET in the environment must match what is configured in Stripe
   # Check the Stripe dashboard for the webhook endpoint's signing secret
   ```
3. **Replay missed webhook events** from Stripe:
   ```bash
   # Use Stripe CLI to resend recent events
   stripe events resend evt_XXXXXX 2>/dev/null || echo "Use Stripe dashboard: Developers > Webhooks > Resend"

   # Or trigger a subscription sync to reconcile state
   curl -s -X POST https://api.privacyops.techd.io/admin/billing/sync-tenant \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"tenant_id": "TENANT_ID"}' | jq .
   ```
4. **Fix webhook endpoint** if it is returning errors:
   ```bash
   # Check if the webhook route is accessible
   curl -s -o /dev/null -w "%{http_code}" -X POST https://api.privacyops.techd.io/webhooks/stripe \
     -H "Content-Type: application/json" -d '{}'
   # Should return 400 (bad request due to missing signature), NOT 404 or 500
   ```

### Subscription Sync Drift
1. **Sync individual tenant:**
   ```bash
   curl -s -X POST https://api.privacyops.techd.io/admin/billing/sync-tenant \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"tenant_id": "TENANT_ID"}' | jq .
   ```
2. **Update feature gates based on subscription plan:**
   ```sql
   -- Manual feature gate correction (use only if sync API is unavailable)
   UPDATE tenant_settings
   SET feature_gates = jsonb_set(
     feature_gates,
     '{ai_llm_enrichment}',
     '"true"'
   ),
   updated_at = NOW()
   WHERE tenant_id = 'TENANT_ID';
   ```

### Usage Metering Gap
1. **Identify the gap window** from the investigation.
2. **Replay usage events to Stripe:**
   ```sql
   -- Mark unsynced events for retry
   UPDATE usage_events
   SET reported_to_stripe = false, retry_count = 0
   WHERE tenant_id = 'TENANT_ID'
     AND created_at BETWEEN 'GAP_START' AND 'GAP_END';
   ```
3. **Trigger the billing queue to process pending events:**
   ```bash
   curl -s -X POST https://api.privacyops.techd.io/admin/billing/process-usage \
     -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
   ```

---

## 6. Communication Template

### Internal
```
BILLING INCIDENT: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Issue: [NullBillingProvider in prod / Webhook failure / Sync drift / Metering gap]
Revenue Impact: [Estimated amount or "under assessment"]
Affected Tenants: [Count and list]
Feature Gates Affected: [List incorrectly gated features]
Stripe API Status: [Healthy / Degraded / Down]
Billing Provider: [stripe / NullBillingProvider (CRITICAL)]
Status: [Investigating / Mitigating / Resolved]
IC: [Name]
```

### External (Affected Customer)
```
We identified a billing configuration issue that may have affected your account.
[If features were incorrectly restricted: Access to [feature names] has been restored.]
[If overcharged: We are processing a billing adjustment for the period [DATE RANGE].]
[If undercharged: We will work with you on reconciliation for the affected period.]
Please contact billing@techd.io if you have questions about your account.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer verifies billing provider status |
| 10 min | Billing team lead for SEV-1/SEV-2 |
| 15 min | Finance team notified for revenue-impacting issues |
| 30 min | VP Engineering for NullBillingProvider in production |
| 1 hour | Customer Success for tenant-facing billing issues |
| 2 hours | Stripe support engagement for persistent API issues |
| 4 hours | CFO notification for significant revenue impact |

---

## 8. Post-Incident Review

- Document root cause -- how did the billing configuration fail?
- If NullBillingProvider was active in production, investigate why the startup guard did not prevent it
- Review Stripe webhook reliability and add retry logic if missing
- Assess subscription sync mechanism -- should it run on a scheduled basis?
- Review usage metering pipeline for data loss risks
- Verify feature gate updates are triggered correctly by subscription changes
- Audit all tenant subscription states against Stripe for consistency
- Review BullMQ billing job error handling and retry policies
- Assess whether billing events should be included in the hash chain audit log
- Calculate and document financial impact
- Update monitoring to detect NullBillingProvider earlier (before it reaches production)
- Review CI/CD pipeline to catch BILLING_PROVIDER misconfigurations

---

## 9. Related Runbooks

- [System Outage Playbook](./system-outage-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md) (billing queue)
- [Tenant Isolation Breach Playbook](./tenant-isolation-breach-playbook.md) (feature gate leaks)
- [Security Incident Playbook](./security-incident-playbook.md) (Stripe credential compromise)
