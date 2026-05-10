# SOP-001: Security Incident Response

**Document ID:** SOP-PRIVACYOPS-IR-001
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Security Operations Lead

---

## 1. Purpose

Define the end-to-end process for detecting, classifying, containing, investigating, and remediating security incidents within the TechD PrivacyOps platform. This SOP ensures consistent handling across the NestJS modular monolith, all 43 registered connectors, and supporting infrastructure (PostgreSQL, NATS JetStream, Temporal, Redis).

## 2. Scope

Applies to all security events surfaced through:
- The 7-layer auth guard pipeline (CSRF, JWT, Tenant, Permissions, FeatureGate, ABAC, Approval)
- NATS JetStream `PRIVACYOPS` stream events (subjects `privacyops.security.*`, `privacyops.audit.*`)
- AuditService SecurityEvent types: `suspicious_activity`, `unauthorized_access`, `rate_limit_exceeded`, `bulk_deletion`, `account_locked`
- OpenTelemetry traces and Prometheus alert rules
- Connector-level anomalies reported by ConnectorHealthService
- AI co-pilot circuit breaker trips and PII redaction failures

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Security Operations Lead | Owns incident lifecycle, coordinates response team |
| Incident Commander (IC) | Assigned per-incident; makes containment decisions |
| Platform Engineering | Infrastructure containment, log extraction, rollback |
| Privacy Officer | Assesses regulatory impact, coordinates with DPO |
| Tenant Success Manager | Manages affected tenant communication |
| DevSecOps Engineer | Forensic analysis, guard pipeline investigation |
| Executive Sponsor | Escalation point for P1 incidents |

## 4. Prerequisites

- Access to Grafana dashboards with PrivacyOps Prometheus datasource
- Read access to `audit_logs` and `security_events` tables in PostgreSQL
- NATS CLI (`nats`) configured with production credentials and `EVENT_HMAC_SECRET`
- Temporal Web UI access for workflow state inspection
- PagerDuty/Opsgenie integration configured for on-call rotation
- Incident response Slack channel (`#privacyops-incidents`) provisioned
- Forensic investigation VM with read-only database replica access

## 5. Procedure

### 5.1 Detection & Triage

1. **Automated Detection Sources**
   1.1. Monitor Prometheus alerts for guard pipeline failures:
        - `privacyops_auth_failures_total` exceeding threshold (>50/min per tenant)
        - `privacyops_rate_limit_exceeded_total` spike detection
        - `privacyops_guard_rejection_total{guard="abac"}` anomalies
   1.2. Review NATS JetStream consumer for security events:
        ```
        nats consumer next PRIVACYOPS security-incident-consumer --count 100
        ```
   1.3. Check AuditService SecurityEvent stream for `critical` severity entries:
        ```sql
        SELECT * FROM audit_logs
        WHERE severity = 'critical'
          AND category = 'security'
          AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC;
        ```
   1.4. Review PlatformAlertService notifications in `#privacyops-alerts`

2. **Manual Detection Triggers**
   2.1. Customer-reported suspicious activity via support ticket
   2.2. Vendor security advisory affecting a registered connector
   2.3. Penetration test findings or bug bounty report
   2.4. AI co-pilot anomaly: circuit breaker open state or PII redaction bypass

3. **Initial Triage (within 15 minutes)**
   3.1. Acknowledge the alert in PagerDuty/Opsgenie
   3.2. Open incident record in `incidents` table via IncidentsService:
        - Reference number auto-generated as `INC-YYYY-NNNN`
        - Set initial `status: 'investigating'`
   3.3. Assign Incident Commander from on-call rotation

### 5.2 Classification

4. **Severity Classification**

   | Priority | Criteria | Response Time | Example |
   |----------|----------|---------------|---------|
   | P1 - Critical | Active data exfiltration, tenant isolation breach, RLS bypass, auth pipeline compromise | 15 min | Cross-tenant data leak, JWT signing key exposure |
   | P2 - High | Single-tenant data exposure, connector credential compromise, audit chain tampering | 30 min | Connector OAuth token stolen, hash chain broken |
   | P3 - Medium | Brute force attempt, permission escalation attempt, DLQ overflow | 2 hours | Repeated `login_failure` from single IP, ABAC policy misconfiguration |
   | P4 - Low | Policy violation, configuration drift, non-exploitable vulnerability | 24 hours | Unused API key not rotated, feature gate bypass in dev |

5. **Impact Assessment**
   5.1. Determine affected tenant(s) by querying `tenant_id` from audit logs
   5.2. Identify affected connectors from `data_sources` table
   5.3. Check if LegalHold constraints apply to affected data
   5.4. Assess regulatory notification requirements (GDPR 72h, CERT-In 6h, DPDP Act)

### 5.3 Containment

6. **Immediate Containment (P1/P2)**
   6.1. **Tenant Isolation**: Update tenant status to `suspended` in `tenants` table:
        ```sql
        UPDATE tenants SET status = 'suspended' WHERE id = '<tenant_id>';
        ```
   6.2. **Session Revocation**: Invalidate all JWT sessions for affected users via Redis:
        ```
        redis-cli DEL "session:<tenant_id>:*"
        ```
   6.3. **Connector Lockdown**: Disable affected data sources:
        ```sql
        UPDATE data_sources SET status = 'disabled' WHERE tenant_id = '<tenant_id>';
        ```
   6.4. **Temporal Workflow Pause**: Cancel active workflows on affected task queues:
        ```
        tctl workflow cancel --query "TenantId='<tenant_id>'"
        ```
   6.5. **NATS Subject Isolation**: Block event publishing for affected tenant subject prefix

7. **Evidence Preservation**
   7.1. Snapshot affected audit_logs with hash chain intact:
        ```sql
        COPY (SELECT * FROM audit_logs WHERE tenant_id = '<tenant_id>'
              AND created_at BETWEEN '<start>' AND '<end>'
              ORDER BY created_at)
        TO '/forensics/incident-<INC_ID>/audit_logs.csv' WITH CSV HEADER;
        ```
   7.2. Export NATS JetStream messages from `PRIVACYOPS` and `PRIVACYOPS_DLQ` streams
   7.3. Capture Temporal workflow execution history for affected workflows
   7.4. Preserve OpenTelemetry trace spans via Jaeger export

### 5.4 Investigation

8. **Audit Log Analysis**
   8.1. Verify hash chain integrity using `AuditService.verifyChain()`:
        ```typescript
        const result: ChainVerificationResult = await auditService.verifyChain(tenantId, startDate, endDate);
        // Check result.valid, result.firstInvalidAt, result.brokenAtId
        ```
   8.2. Correlate events using `correlationId` across audit logs and NATS events
   8.3. Review SecurityEvent sequence: `login_failure` -> `unauthorized_access` -> `suspicious_activity`
   8.4. Check HMAC signatures on NATS events for tampering evidence

9. **Guard Pipeline Analysis**
   9.1. Review guard rejection logs for each layer:
        - `jwt-auth.guard.ts`: Token validation failures
        - `permissions.guard.ts`: Missing permission claims
        - `abac.guard.ts`: Attribute-based policy denials
        - `approval.guard.ts`: Unapproved action attempts
   9.2. Check for guard bypass patterns in access logs
   9.3. Inspect FeatureGate configuration for unexpected overrides

10. **Connector Investigation**
    10.1. Review ConnectorHealthService status for affected connectors
    10.2. Check credential rotation timestamps in data_sources
    10.3. Analyze `scanAssets`, `getAccessPolicies`, `disposeAsset` call patterns
    10.4. Verify CAPABILITY_MATRIX enforcement for remediation actions

### 5.5 Remediation

11. **Technical Remediation**
    11.1. Execute appropriate RemediationExecutorService actions:
          - `rotate_credentials`: For compromised connector credentials
          - `revoke_access`: For unauthorized access grants
          - `quarantine`: For affected data assets
          - `disable_public_access`: For exposed resources
    11.2. Patch identified vulnerability (see SOP-008 Vulnerability Management)
    11.3. Update ABAC policies if policy gap identified
    11.4. Re-enable guard pipeline components after verification

12. **Tenant Restoration**
    12.1. Verify containment actions resolved the threat
    12.2. Restore tenant status to `active`
    12.3. Re-enable affected data source connections
    12.4. Resume paused Temporal workflows
    12.5. Notify tenant of resolution via NotificationService channels (email, in-app, webhook)

### 5.6 Post-Incident

13. **Post-Mortem (within 5 business days of resolution)**
    13.1. Conduct blameless post-mortem with all responders
    13.2. Document root cause, timeline, and impact assessment
    13.3. Identify preventive measures and create follow-up tasks
    13.4. Update incident record with `status: 'closed'` and lessons learned
    13.5. Publish sanitized post-mortem to `#privacyops-engineering`

14. **Metrics & Reporting**
    14.1. Record MTTD (Mean Time to Detect), MTTC (Mean Time to Contain), MTTR (Mean Time to Resolve)
    14.2. Update incident trend dashboard in Grafana
    14.3. Report to executive sponsor for P1/P2 incidents

## 6. Verification

- [ ] Incident record exists in `incidents` table with complete timeline
- [ ] Hash chain integrity verified for affected tenant audit logs
- [ ] All containment actions documented and reversed (if temporary)
- [ ] Affected tenant notified per contractual SLA
- [ ] Regulatory notification completed if required (see SOP-003)
- [ ] Post-mortem completed and action items assigned
- [ ] Prometheus alert rules updated if detection gap found

## 7. Rollback

If containment actions cause service degradation:
1. Restore tenant status from backup: `UPDATE tenants SET status = 'active' WHERE id = '<tenant_id>';`
2. Re-enable data sources: `UPDATE data_sources SET status = 'connected' WHERE tenant_id = '<tenant_id>';`
3. Flush Redis session cache and allow re-authentication
4. Resume Temporal workflows from last checkpoint
5. Republish held NATS events from DLQ after HMAC re-verification

## 8. Frequency

- **Tabletop exercises**: Quarterly (one per severity level per year)
- **Runbook review**: Semi-annually or after any P1/P2 incident
- **On-call rotation update**: Monthly
- **Detection rule tuning**: After each incident or quarterly

## 9. References

- SOP-003: Data Breach Notification
- SOP-008: Vulnerability Management
- SOP-011: Audit Log Review
- Architecture Doc: `docs/architecture/11-security-architecture.md`
- Source: `apps/api/src/core/audit/audit.service.ts`
- Source: `apps/api/src/modules/incidents/incidents.service.ts`
- Source: `apps/api/src/core/events/event-bus.service.ts`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Security Operations | Initial version |
| | | | |
| | | | |
