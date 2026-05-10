# SOP-011: Audit Log Review

**Document ID:** SOP-PRIVACYOPS-ALR-011
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Compliance Officer

---

## 1. Purpose

Define the procedure for reviewing, verifying, and analyzing the TechD PrivacyOps platform's SHA256 hash chain audit logs. This covers integrity verification of the cryptographic hash chain, detection of suspicious activity patterns, extraction of compliance evidence for regulatory audits, enforcement of retention policies, and preparation for GDPR, DPDP Act, SOC 2, and ISO 27001 audits.

## 2. Scope

Applies to all audit log data managed by the AuditService:
- **Audit Log Entries**: All entries in `audit_logs` table with hash chain integrity
- **Security Events**: Events with `category: 'security'` and severity-classified types
- **Data Access Logs**: Category `data_access` covering connector queries, DSAR data collection, data exports
- **Admin Actions**: Category `admin` covering configuration changes, role modifications, tenant settings
- **Compliance Events**: Category `compliance` covering DSAR completions, consent changes, retention executions
- **Auth Events**: Category `auth` covering login, logout, MFA, session management
- **NATS Event Correlation**: Cross-reference with NATS JetStream `PRIVACYOPS` stream events

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Compliance Officer | Owns review cycle, produces compliance evidence packages |
| Security Analyst | Analyzes suspicious activity patterns, threat hunting |
| Privacy Officer | Reviews data access patterns, DSAR audit trails |
| DPO | Signs off on regulatory audit evidence |
| Platform Engineer | Hash chain verification, log infrastructure maintenance |
| External Auditor | Consumes evidence packages during audit engagements |

## 4. Prerequisites

- Read access to `audit_logs` table in PostgreSQL (via read replica preferred)
- AuditService `verifyChain()` method accessible
- NATS CLI configured for event stream querying
- Grafana dashboards for audit log visualization
- Previous review report for trend comparison
- Audit log retention policy document
- Understanding of SecurityEvent types and severity classifications

## 5. Procedure

### 5.1 SHA256 Hash Chain Verification

1. **Automated Chain Verification**
   1.1. Execute hash chain verification for each tenant:
        ```typescript
        // Via AuditService - verifies SHA256 chain integrity
        const result: ChainVerificationResult = await auditService.verifyChain(
          tenantId,
          startDate, // Beginning of review period
          endDate,   // End of review period
        );
        ```
   1.2. Interpret results:
        - `result.valid === true`: Chain is intact, no tampering detected
        - `result.valid === false`: Chain broken at `result.firstInvalidAt`
        - `result.brokenAtId`: ID of first entry with invalid hash
        - `result.totalChecked`: Number of entries verified
   1.3. If chain is broken:
        - **CRITICAL**: Escalate immediately to Security Operations Lead
        - Identify the exact break point and affected entries
        - Check PostgreSQL advisory lock logs for concurrent write issues
        - Cross-reference with NATS events for the same time period
        - Initiate incident per SOP-001 (Incident Response)
        - Preserve evidence: Export raw entries around break point

2. **Full Platform Verification**
   2.1. Run verification across all active tenants:
        ```sql
        SELECT id, name, status FROM tenants WHERE status = 'active';
        ```
   2.2. For each tenant, verify chain for the review period
   2.3. Document verification results:

   | Tenant | Period | Entries Checked | Chain Valid | Notes |
   |--------|--------|----------------|-------------|-------|
   | ... | ... | ... | Yes/No | ... |

   2.4. Retain verification report as compliance evidence

3. **Hash Algorithm Verification**
   3.1. Spot-check hash computation on random entries:
        ```sql
        SELECT id, action, entity_type, entity_id, created_at,
               hash, previous_hash
        FROM audit_logs
        WHERE tenant_id = '<tenant_id>'
        ORDER BY created_at
        LIMIT 10 OFFSET <random_offset>;
        ```
   3.2. Manually recompute SHA256 hash and compare:
        ```typescript
        // Hash = SHA256(previousHash + action + entityType + entityId + timestamp)
        const computed = createHash('sha256')
          .update(previousHash + action + entityType + entityId + timestamp)
          .digest('hex');
        assert(computed === storedHash);
        ```
   3.3. Verify PostgreSQL advisory locks are functioning (prevents concurrent chain corruption)

### 5.2 Suspicious Activity Pattern Detection

4. **Authentication Anomaly Review**
   4.1. Failed login surge detection:
        ```sql
        SELECT tenant_id, DATE_TRUNC('hour', created_at) AS hour,
               COUNT(*) AS failure_count
        FROM audit_logs
        WHERE action = 'auth.login_failure'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY tenant_id, hour
        HAVING COUNT(*) > 10
        ORDER BY failure_count DESC;
        ```
   4.2. Account lockout patterns:
        ```sql
        SELECT al.*, u.email, u.name
        FROM audit_logs al
        JOIN users u ON al.actor_id = u.id::text
        WHERE al.action = 'auth.account_locked'
          AND al.created_at > NOW() - INTERVAL '30 days';
        ```
   4.3. Unusual login locations (IP-based):
        ```sql
        SELECT actor_id, ip_address, COUNT(*) AS login_count,
               COUNT(DISTINCT ip_address) AS unique_ips
        FROM audit_logs
        WHERE action = 'auth.login_success'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY actor_id, ip_address
        ORDER BY unique_ips DESC;
        ```

5. **Privilege Escalation Detection**
   5.1. Review role and permission changes:
        ```sql
        SELECT * FROM audit_logs
        WHERE action IN ('auth.role_assigned', 'auth.role_revoked',
                         'auth.permission_changed')
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC;
        ```
   5.2. Flag: Users who assigned themselves roles
   5.3. Flag: Permission changes outside normal business hours
   5.4. Flag: Bulk role assignments (>5 in 1 hour)

6. **Data Access Anomaly Detection**
   6.1. Unusual data export volume:
        ```sql
        SELECT actor_id, COUNT(*) AS export_count,
               SUM((changes->>'recordCount')::int) AS total_records
        FROM audit_logs
        WHERE action LIKE 'data.export%'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY actor_id
        HAVING COUNT(*) > 10
        ORDER BY total_records DESC;
        ```
   6.2. Cross-tenant access attempts (should never succeed):
        ```sql
        SELECT * FROM audit_logs
        WHERE action = 'security.cross_tenant_attempt'
          AND created_at > NOW() - INTERVAL '30 days';
        ```
   6.3. Bulk deletion operations:
        ```sql
        SELECT * FROM audit_logs
        WHERE action LIKE '%bulk_deletion%' OR action LIKE '%delete%'
          AND severity = 'critical'
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC;
        ```

7. **Connector Activity Anomalies**
   7.1. Review connector scan patterns:
        ```sql
        SELECT entity_type, action, COUNT(*) AS action_count,
               COUNT(DISTINCT actor_id) AS unique_actors
        FROM audit_logs
        WHERE entity_type = 'data_source'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY entity_type, action
        ORDER BY action_count DESC;
        ```
   7.2. Flag: Scans initiated outside scheduled windows
   7.3. Flag: Credential access for disabled connectors
   7.4. Flag: disposeAsset calls without corresponding remediation plan

### 5.3 Compliance Evidence Extraction

8. **GDPR Evidence Package**
   8.1. Data processing activity record:
        ```sql
        -- DSAR processing evidence
        SELECT * FROM audit_logs
        WHERE action LIKE 'dsar.%'
          AND created_at BETWEEN '<period_start>' AND '<period_end>'
        ORDER BY created_at;
        ```
   8.2. Consent management activity:
        ```sql
        SELECT * FROM audit_logs
        WHERE entity_type = 'consent'
          AND created_at BETWEEN '<period_start>' AND '<period_end>'
        ORDER BY created_at;
        ```
   8.3. Data breach notification evidence (cross-reference SOP-003 records):
        ```sql
        SELECT * FROM audit_logs
        WHERE action LIKE 'incident.%' OR action LIKE 'breach.%'
          AND created_at BETWEEN '<period_start>' AND '<period_end>'
        ORDER BY created_at;
        ```

9. **SOC 2 Evidence Package**
   9.1. Access control evidence:
        - User provisioning/deprovisioning logs
        - Role assignment changes
        - Authentication event summary
        - MFA enforcement evidence
   9.2. Change management evidence:
        - Configuration change logs (`action LIKE 'config.%'`)
        - Deployment audit trail
   9.3. Incident management evidence:
        - Incident creation, classification, resolution timeline
        - Post-mortem references
   9.4. Data integrity evidence:
        - Hash chain verification results
        - Backup verification records

10. **Regulatory Audit Preparation**
    10.1. Compile evidence into structured package:
          - Hash chain verification certificate (signed by Compliance Officer)
          - Activity summary statistics (total events, by category, by severity)
          - Anomaly investigation summaries
          - DSAR completion metrics (on-time rate, average response time)
          - Access control review results (from SOP-007)
          - Incident response metrics (MTTD, MTTC, MTTR)
    10.2. Prepare tenant-specific evidence if requested by auditor
    10.3. Ensure all exported evidence is itself audit-logged

### 5.4 Retention Compliance

11. **Retention Policy Enforcement**
    11.1. Verify audit log retention periods:

    | Log Category | Minimum Retention | Regulatory Basis |
    |-------------|-------------------|-----------------|
    | Security events | 7 years | SOC 2, ISO 27001 |
    | Data access logs | 5 years | GDPR Art. 30, DPDP Act |
    | DSAR activity | 5 years | GDPR documentation requirement |
    | Auth events | 3 years | General compliance |
    | Admin actions | 5 years | SOC 2 |
    | Incident records | 7 years | Regulatory filing retention |

    11.2. Check for premature deletion:
          ```sql
          SELECT category, MIN(created_at) AS oldest_entry, COUNT(*) AS total_entries
          FROM audit_logs
          GROUP BY category;
          ```
    11.3. Verify no audit logs deleted within retention window
    11.4. For expired entries: Archive before deletion, maintain deletion record

12. **NATS Event Correlation**
    12.1. Cross-reference audit logs with NATS JetStream events:
          - Match `correlationId` between audit entries and NATS events
          - Verify HMAC signatures on correlated events
          - Check DLQ for events that failed processing but have audit entries
    12.2. Flag discrepancies:
          - Audit entry without corresponding NATS event (or vice versa)
          - HMAC signature failures on events correlated with audit entries
          - Time drift between audit timestamp and NATS event timestamp

### 5.5 Reporting

13. **Monthly Review Report**
    13.1. Compile findings:
          - Hash chain verification status (all tenants)
          - Suspicious activity summary and investigation outcomes
          - Top 10 most active audit categories
          - Anomaly trends (comparison with previous month)
          - Retention compliance status
          - Recommendations for policy updates
    13.2. Submit to DPO and Compliance Officer
    13.3. Present critical findings to CAB

## 6. Verification

- [ ] SHA256 hash chain verified for all active tenants
- [ ] No chain breaks detected (or incidents filed for any breaks)
- [ ] Suspicious activity patterns investigated and documented
- [ ] Authentication anomalies reviewed and addressed
- [ ] Compliance evidence extracted for current reporting period
- [ ] NATS event correlation completed
- [ ] Retention compliance verified (no premature deletions)
- [ ] Monthly report compiled and submitted
- [ ] Spot-check hash computations passed

## 7. Rollback

Audit log review is a read-only process. If issues are discovered:
1. Hash chain break: Initiate SOP-001 Incident Response (do not attempt to repair chain)
2. Suspicious activity: Escalate per SOP-001 severity classification
3. Retention violation: Recover from backup (SOP-006) if logs were prematurely deleted
4. NATS correlation gaps: Investigate event bus reliability (EventBusService DLQ review)
5. Never modify audit log entries to "fix" issues; document and escalate

## 8. Frequency

- **Hash chain verification**: Daily (automated), monthly (manual spot-check)
- **Suspicious activity review**: Weekly (automated alerts), monthly (deep analysis)
- **Compliance evidence extraction**: Quarterly (or on-demand for audits)
- **Retention compliance check**: Monthly
- **Full audit log review**: Monthly
- **Regulatory audit preparation**: Quarterly (or per audit schedule)
- **NATS event correlation**: Monthly

## 9. References

- SOP-001: Incident Response (for chain integrity violations)
- SOP-003: Data Breach Notification (for breach evidence)
- SOP-007: Access Control Review (for access audit integration)
- Architecture Doc: `docs/architecture/11-security-architecture.md`
- Source: `apps/api/src/core/audit/audit.service.ts`
- Source: `apps/api/src/core/events/event-bus.service.ts`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Compliance Officer | Initial version |
| | | | |
| | | | |
