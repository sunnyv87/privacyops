# System Outage Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-SYS-001
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / SRE Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `PrivacyOpsPlatformDown` fires when the NestJS health endpoint (`/health`) returns non-200 for > 60 seconds
- NATS JetStream consumer lag exceeds 10,000 messages on any of the 8 task queues (SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION)
- Temporal worker heartbeat missing for > 90 seconds across any task queue
- PostgreSQL connection pool utilization hits 100% (Prisma connection pool exhausted)
- Redis/IORedis `ECONNREFUSED` or memory utilization > 90%
- BullMQ job failure rate exceeds 50% over a 5-minute window
- Socket.IO WebSocket disconnection storm (>100 disconnects in 30 seconds)
- OpenTelemetry trace error rate exceeds 10% on any service span

### Manual Detection
- Customer reports of 5xx errors or inability to access the platform
- DSAR processing halted -- no workflow completions in the DSAR task queue for > 30 minutes
- Status page monitoring (external) reports endpoint unreachable

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 (Critical) | Full platform outage; all tenants affected; DSAR/Breach deadlines at risk | Immediate, all hands |
| SEV-2 (High) | Partial outage; one or more task queues stalled; subset of tenants impacted | < 15 minutes |
| SEV-3 (Medium) | Degraded performance; single connector class failing; non-critical path down | < 1 hour |
| SEV-4 (Low) | Cosmetic issues; non-customer-facing component degraded | Next business day |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Acknowledge the alert** in the on-call PagerDuty rotation and join the incident Slack channel `#incident-response`.
2. **Verify scope** -- determine full vs. partial outage:
   ```bash
   # Check NestJS API health
   curl -s https://api.privacyops.techd.io/health | jq .

   # Check Temporal worker status across all 8 task queues
   tctl --ns privacyops-production workflow list --status open --query "TaskQueue IN ('SCAN','DSAR','BREACH','RETENTION','APPROVAL','VENDOR','REMEDIATION','DATA_DELETION')" | head -50

   # Check NATS JetStream consumer status
   nats consumer ls PRIVACYOPS_EVENTS --server nats://nats.internal:4222

   # Check PostgreSQL connectivity via Prisma
   npx prisma db execute --stdin <<< "SELECT 1;"

   # Check Redis connectivity
   redis-cli -h redis.internal ping
   ```
3. **Identify the failing layer** using the service dependency map (see Section 4).
4. **Enable enhanced logging** if not already active:
   ```bash
   kubectl set env deployment/privacyops-api LOG_LEVEL=debug
   ```
5. **Notify stakeholders** using the Communication Template (Section 7) within 10 minutes of SEV-1/SEV-2 detection.

---

## 4. Investigation Steps

### Service Dependency Map

```
Client (Browser/SDK)
  |
  v
API Gateway (NestJS) --> 7-Layer Auth Guard Pipeline
  |                        (CSRF -> JWT -> Tenant -> Permissions -> FeatureGate -> ABAC -> Approval)
  |
  +---> PostgreSQL (Prisma ORM, RLS, Advisory Locks, Hash Chain Audit)
  |
  +---> Redis/IORedis (BullMQ job queues, session cache)
  |
  +---> NATS JetStream (event bus, HMAC signed messages, DLQ, idempotency)
  |
  +---> Temporal (8 task queues: SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION)
  |
  +---> 43 Connectors (IConnector interface implementations)
  |
  +---> Stripe Billing (BillingProvider with NullBillingProvider guard)
  |
  +---> AI Co-pilot (PII redaction, circuit breaker, tenant feature gate)
  |
  +---> Socket.IO (real-time WebSocket updates)
```

### Triage by Component

**API Layer (NestJS)**
- Check pod status: `kubectl get pods -l app=privacyops-api`
- Review startup logs for guard pipeline initialization failures
- Verify the 7-layer auth guard chain is loading in correct order
- Check if the Billing production startup guard threw (NODE_ENV=production with BILLING_PROVIDER != stripe)

**Database (PostgreSQL)**
- Check connection pool: `SELECT count(*) FROM pg_stat_activity WHERE datname='privacyops';`
- Verify Prisma connection pool settings in environment
- Check for long-running transactions blocking advisory locks (hash chain audit writes)
- Verify RLS policies are intact: `SELECT * FROM pg_policies;`

**Redis/IORedis**
- Check memory: `redis-cli info memory | grep used_memory_human`
- Check BullMQ queue depths: `redis-cli keys "bull:*:waiting" | xargs -I{} redis-cli llen {}`
- Look for connection storms from IORedis reconnect loops

**NATS JetStream**
- Check stream health: `nats stream ls --server nats://nats.internal:4222`
- Verify HMAC signing keys are accessible
- Check DLQ depth for poison messages
- Verify idempotency store is not full

**Temporal**
- Check worker registrations per task queue
- Look for activity timeouts or workflow task failures
- Check namespace health: `tctl --ns privacyops-production namespace describe`

---

## 5. Resolution Steps

### Recovery Sequence (Order Matters)

1. **PostgreSQL** -- restore database connectivity first; all other services depend on it
   - If failover needed, follow `database-failover-playbook.md`
   - Verify RLS policies post-recovery
   - Confirm hash chain audit log integrity

2. **Redis** -- restore cache and BullMQ job processing
   - If memory pressure, flush non-critical caches: `redis-cli FLUSHDB` (staging only; production requires selective eviction)
   - Restart IORedis connections by rolling API pods

3. **NATS JetStream** -- restore event bus
   - Replay DLQ if messages were lost
   - Verify HMAC signature validation is passing
   - Re-establish consumer groups

4. **Temporal** -- restore workflow processing
   - Restart workers for affected task queues
   - Do NOT terminate stuck workflows yet -- follow `workflow-stuck-playbook.md`
   - Verify all 8 task queues have registered workers

5. **NestJS API** -- rolling restart of API pods
   - Verify guard pipeline initializes correctly (all 7 layers)
   - Confirm health endpoint returns 200
   - Verify Socket.IO WebSocket connections re-establish

6. **Connectors** -- verify connector health
   - Run smoke tests against critical connectors (S3, PostgreSQL, Snowflake)
   - Check IConnector health method for each active connector

### Rollback Procedure
- If the outage was caused by a deployment, roll back:
  ```bash
  kubectl rollout undo deployment/privacyops-api
  kubectl rollout undo deployment/privacyops-temporal-worker
  ```

---

## 6. Communication Template

### Internal (Slack #incident-response)
```
INCIDENT DECLARED: [SEV-X] PrivacyOps Platform [Full/Partial] Outage
Time Detected: [TIMESTAMP UTC]
Impact: [Description of affected functionality -- e.g., "All DSAR processing halted, scan workflows stalled"]
Affected Tenants: [All / Specific tenant IDs]
Affected Task Queues: [List affected Temporal queues]
Current Status: Investigating / Mitigating / Resolved
Incident Commander: [Name]
Next Update: [TIME]
```

### External (Customer-Facing Status Page)
```
We are currently experiencing [degraded performance / a service interruption] with the PrivacyOps platform.
[DSAR processing / Data scanning / Breach notification workflows] may be delayed.
Our engineering team is actively investigating and we will provide updates every [30 minutes].
No data loss or security compromise has been identified at this time.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0-15 min | On-call engineer begins triage |
| 15 min | Escalate to Platform Engineering lead if root cause not identified |
| 30 min | Escalate to VP Engineering for SEV-1; notify Customer Success for affected tenants |
| 1 hour | Engage cloud provider support if infrastructure-level issue suspected |
| 2 hours | Executive notification for SEV-1; consider engaging external vendor support |
| 4 hours | CTO briefing for unresolved SEV-1 |

---

## 8. Post-Incident Review

- Schedule post-incident review within 48 hours of resolution
- Document timeline with UTC timestamps
- Identify root cause and contributing factors
- Review detection gaps -- did automated alerts fire before customer reports?
- Verify hash chain audit log captured all relevant events during the incident
- Assess impact on DSAR/Breach regulatory deadlines
- Generate action items with owners and due dates
- Update this playbook if gaps are identified
- Review Prometheus alert thresholds and OpenTelemetry trace sampling rates

---

## 9. Related Runbooks

- [Database Failover Playbook](./database-failover-playbook.md)
- [Workflow Stuck Playbook](./workflow-stuck-playbook.md)
- [Connector Failure Playbook](./connector-failure-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [Security Incident Playbook](./security-incident-playbook.md)
- [Billing Escalation Playbook](./billing-escalation-playbook.md)
