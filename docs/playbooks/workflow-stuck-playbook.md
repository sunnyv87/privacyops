# Workflow Stuck Playbook -- TechD PrivacyOps + DSPM Platform

**Playbook ID:** PB-WF-006
**Last Updated:** 2026-05-10
**Owner:** Platform Engineering / Workflow Reliability Team
**Review Cadence:** Quarterly

---

## 1. Trigger / Detection

### Automated Alerts
- Prometheus alert `TemporalWorkflowStuck` -- workflow running longer than 2x expected duration per queue type
- Prometheus alert `TemporalQueueBacklog` -- pending tasks in any of the 8 queues exceed threshold:
  - SCAN: > 500 pending tasks
  - DSAR: > 50 pending tasks (regulatory deadline sensitivity)
  - BREACH: > 10 pending tasks (highest urgency)
  - RETENTION: > 200 pending tasks
  - APPROVAL: > 100 pending tasks
  - VENDOR: > 200 pending tasks
  - REMEDIATION: > 100 pending tasks
  - DATA_DELETION: > 50 pending tasks
- Temporal worker heartbeat missing for > 90 seconds on any task queue
- BullMQ queue depth growing with no jobs completing
- NATS consumer lag increasing on workflow event subjects
- OpenTelemetry trace showing activity execution duration exceeding schedule-to-close timeout

### Manual Detection
- DSAR requests not progressing past `in_progress` status for > 4 hours
- Breach notification workflows not sending within configured timeframes
- Scan completion rate drops below 80% of normal throughput
- Approval workflows stuck -- tenant admins report pending approvals not clearing

---

## 2. Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV-1 | BREACH or DSAR queues stalled; regulatory deadlines at risk; all workers down | Immediate |
| SEV-2 | Multiple queues backlogged; APPROVAL queue stuck blocking downstream work | < 15 minutes |
| SEV-3 | Single non-critical queue (SCAN, RETENTION, VENDOR) backlogged; workers degraded | < 1 hour |
| SEV-4 | Individual workflow stuck; no queue-level impact | < 4 hours |

---

## 3. Immediate Actions (First 15 Minutes)

1. **Assess queue health across all 8 task queues:**
   ```bash
   # Check all Temporal task queues
   for QUEUE in SCAN DSAR BREACH RETENTION APPROVAL VENDOR REMEDIATION DATA_DELETION; do
     echo "=== $QUEUE ==="
     tctl --ns privacyops-production task-queue describe -tq "$QUEUE" 2>&1 | head -20
   done

   # Check workflow counts by status
   for STATUS in open failed; do
     echo "=== $STATUS workflows ==="
     tctl --ns privacyops-production workflow count --query "ExecutionStatus='$STATUS'"
   done
   ```

2. **Check Temporal worker pod status:**
   ```bash
   # Verify worker pods are running
   kubectl get pods -l app=privacyops-temporal-worker -o wide

   # Check for OOMKilled or CrashLoopBackOff
   kubectl get pods -l app=privacyops-temporal-worker -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{.status.containerStatuses[0].restartCount}{"\n"}{end}'

   # Check worker logs for errors
   kubectl logs -l app=privacyops-temporal-worker --since=15m --tail=100 | grep -i "error\|panic\|fatal\|timeout"
   ```

3. **Check BullMQ queue depths (Redis-backed):**
   ```bash
   # Check all BullMQ queue sizes
   redis-cli -h redis.internal KEYS "bull:*" | grep -E "waiting|active|delayed|failed" | while read key; do
     echo "$key: $(redis-cli -h redis.internal LLEN "$key" 2>/dev/null || redis-cli -h redis.internal ZCARD "$key" 2>/dev/null)"
   done
   ```

4. **Identify the longest-running stuck workflows:**
   ```bash
   # Find workflows running > 2 hours
   tctl --ns privacyops-production workflow list --status open \
     --query "StartTime < '$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)'" | head -20
   ```

5. **Prioritize BREACH and DSAR queues** -- these have regulatory deadlines.

---

## 4. Investigation Steps

### Workflow-Level Diagnosis
```bash
# Get detailed workflow history for a stuck workflow
tctl --ns privacyops-production workflow show -w WORKFLOW_ID --print_full_history

# Key things to look for in the history:
# - ActivityTaskScheduled without corresponding ActivityTaskCompleted
# - ActivityTaskTimedOut events
# - WorkflowTaskTimedOut (workflow itself is stuck)
# - SignalExternalWorkflowExecutionFailed (cross-workflow communication broken)
# - Activities stuck in "Scheduled" state (workers not picking up)
```

### Activity Timeout Analysis
```bash
# Check which activity types are timing out
tctl --ns privacyops-production workflow list --status open \
  --query "TaskQueue='STUCK_QUEUE'" -o json | \
  jq '.[].execution.workflowId' | head -10 | while read wid; do
    echo "=== $wid ==="
    tctl --ns privacyops-production workflow show -w "$(echo $wid | tr -d '"')" --print_full_history | \
      grep -A3 "ActivityTaskTimedOut\|ActivityTaskFailed"
  done
```

### Worker Crash Analysis
```bash
# Check for worker panics or crashes
kubectl logs -l app=privacyops-temporal-worker --previous --tail=200 2>/dev/null

# Check resource usage -- OOM is a common cause
kubectl top pods -l app=privacyops-temporal-worker

# Check node resource pressure
kubectl describe nodes | grep -A5 "Conditions:"
```

### Queue-Specific Investigation

**SCAN Queue Stuck**
- Likely cause: connector timeout, external service unavailable
- Check: `kubectl logs -l app=privacyops-temporal-worker --since=30m | grep -i "scan\|connector\|IConnector"`
- Follow: [Connector Failure Playbook](./connector-failure-playbook.md) if connector issue

**DSAR Queue Stuck**
- Likely cause: redaction pipeline failure (fail-closed), data collection timeout, approval dependency
- Check: `SELECT * FROM dsar_requests WHERE status IN ('in_progress','collecting_data','redacting') AND updated_at < NOW() - INTERVAL '4 hours';`
- Critical: DSAR has regulatory deadlines -- escalate immediately if > 50% of deadline elapsed

**BREACH Queue Stuck**
- Likely cause: notification delivery failure, approval workflow dependency
- Check: Breach notification status and downstream dependencies
- Critical: Breach notification timelines are legally mandated

**APPROVAL Queue Stuck**
- Likely cause: approval workflow waiting for human action, notification delivery failure
- Impact: Blocks downstream DSAR, REMEDIATION, and DATA_DELETION workflows
- Check: `SELECT * FROM approval_requests WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours';`

**DATA_DELETION Queue Stuck**
- Likely cause: legal hold blocking deletion, connector failure, cascade dependency
- Check: Active legal holds that may be blocking: `SELECT * FROM legal_holds WHERE released_at IS NULL AND expires_at > NOW();`
- Follow: [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md) if hold-related

### Downstream Dependency Check
```bash
# Check if NATS event delivery is working (workflows may be waiting for events)
nats consumer info PRIVACYOPS_EVENTS WORKFLOW_CONSUMER --json | jq '{pending: .num_pending, ack_pending: .num_ack_pending, redelivered: .num_redelivered}'

# Check if the database is responding (workflow activities depend on DB)
psql -h db-primary.internal -U privacyops_admin -c "SELECT 1;" 2>&1

# Check Redis/BullMQ health
redis-cli -h redis.internal ping
```

---

## 5. Resolution Steps

### Worker Recovery
```bash
# Rolling restart of Temporal workers
kubectl rollout restart deployment/privacyops-temporal-worker

# Scale up workers if backlog is severe
kubectl scale deployment/privacyops-temporal-worker --replicas=CURRENT+2

# Monitor worker registration after restart
for QUEUE in SCAN DSAR BREACH RETENTION APPROVAL VENDOR REMEDIATION DATA_DELETION; do
  echo "=== $QUEUE pollers ==="
  tctl --ns privacyops-production task-queue describe -tq "$QUEUE" | grep "pollerCount"
done
```

### Workflow Termination (Last Resort)
```bash
# WARNING: Only terminate workflows that are unrecoverable
# Always prefer reset over terminate

# Terminate a single stuck workflow
tctl --ns privacyops-production workflow terminate -w WORKFLOW_ID -r "Stuck workflow -- manual termination after investigation"

# Reset a workflow to replay from a specific point
tctl --ns privacyops-production workflow reset -w WORKFLOW_ID \
  --reason "Reset stuck workflow to retry from last good state" \
  --reset-type LastWorkflowTask
```

### Bulk Queue Recovery
```bash
# For a backlogged queue, reset all failed workflows for retry
tctl --ns privacyops-production workflow list --status failed \
  --query "TaskQueue='QUEUE_NAME' AND CloseTime > '$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)'" -o json | \
  jq -r '.[].execution.workflowId' | while read wid; do
    echo "Resetting $wid"
    tctl --ns privacyops-production workflow reset -w "$wid" \
      --reason "Bulk retry after queue recovery" \
      --reset-type LastWorkflowTask
  done
```

### BullMQ Stuck Job Recovery
```bash
# Move failed BullMQ jobs back to waiting
# Use the application's admin API or bull-board UI

# Check for stalled jobs (active but not processing)
redis-cli -h redis.internal LRANGE "bull:QUEUE_NAME:active" 0 -1

# Clean stalled jobs
redis-cli -h redis.internal DEL "bull:QUEUE_NAME:stalled-check"
```

### Priority Queue Bypass (Emergency)
- For DSAR/BREACH with imminent deadlines:
  1. Create a new workflow instance with high priority
  2. Manually inject required data if connector is down
  3. Document the bypass in the audit log

---

## 6. Communication Template

### Internal
```
WORKFLOW STUCK/BACKLOG: [SEV-X]
Detection Time: [TIMESTAMP UTC]
Affected Queue(s): [SCAN / DSAR / BREACH / RETENTION / APPROVAL / VENDOR / REMEDIATION / DATA_DELETION]
Queue Depth: [Current pending count per affected queue]
Stuck Workflow Count: [Number]
Worker Status: [Running / Crashed / OOMKilled / Degraded]
Root Cause: [Worker crash / Activity timeout / Dependency failure / Backpressure]
Regulatory Deadline Risk: [Yes -- DSAR/BREACH details / No]
Status: [Investigating / Recovering / Resolved]
IC: [Name]
```

### External (If DSAR/Breach Deadlines Affected)
```
Processing of your [DSAR request / breach notification] (ID: [X]) is experiencing
a delay due to a system processing issue. Our team is actively working on resolution.
Updated ETA: [ESTIMATE]
We are tracking regulatory deadlines and will communicate any risks to compliance timelines.
```

---

## 7. Escalation Path

| Time Elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer begins triage |
| 15 min | Workflow/Temporal team lead for SEV-1/SEV-2 |
| 30 min | DPO notified if DSAR deadlines at risk |
| 30 min | Legal notified if BREACH notification deadlines at risk |
| 1 hour | Platform Engineering lead if systemic infrastructure issue |
| 2 hours | VP Engineering for unresolved SEV-1 |
| 4 hours | Customer Success bulk notification for affected tenants |

---

## 8. Post-Incident Review

- Document which queues were affected and root cause per queue
- Review Temporal activity timeout settings -- are they appropriate for the workload?
- Assess worker resource limits (CPU, memory) -- was OOM a factor?
- Review workflow retry policies and backoff strategies
- Assess whether queue priority should be adjusted (BREACH > DSAR > others)
- Check if NATS event delivery contributed to workflow stalls
- Review BullMQ job lifecycle for stalled job detection
- Verify hash chain audit log captured all workflow state transitions
- Update monitoring thresholds based on observed failure patterns
- Assess need for additional worker replicas or queue-specific worker pools

---

## 9. Related Runbooks

- [System Outage Playbook](./system-outage-playbook.md)
- [Connector Failure Playbook](./connector-failure-playbook.md)
- [Performance Degradation Playbook](./performance-degradation-playbook.md)
- [Database Failover Playbook](./database-failover-playbook.md)
- [Legal Hold Enforcement Playbook](./legal-hold-enforcement-playbook.md)
