# SOP-012: Tenant Offboarding

**Document ID:** SOP-PRIVACYOPS-TO-012
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Customer Success Lead

---

## 1. Purpose

Define the end-to-end procedure for offboarding a tenant from the TechD PrivacyOps platform. This covers data export, legal hold verification, DSAR completion confirmation, data deletion across all 43 registered connectors, audit trail preservation, billing cancellation via Stripe, and post-offboarding verification to ensure complete and compliant tenant removal from the multi-tenant SaaS platform.

## 2. Scope

Applies to tenant offboarding triggered by:
- **Customer-initiated cancellation**: Contract expiration or early termination
- **Platform-initiated suspension**: Non-payment, policy violation, trial expiration
- **Regulatory requirement**: Data residency change, business dissolution
- **Merger/acquisition**: Tenant consolidation or transfer

Covers all data in:
- PostgreSQL tables filtered by `tenant_id` (protected by RLS)
- Redis keys scoped to tenant (sessions, caches, rate limits)
- NATS JetStream events containing tenant data
- Temporal workflow state for tenant workflows
- Connector-side data discovered and indexed by the platform
- Backup archives containing tenant data
- Billing records in Stripe and `billing_accounts`, `subscriptions`, `invoices` tables

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Customer Success Lead | Initiates offboarding, manages tenant communication |
| Privacy Officer | Verifies legal hold clearance, DSAR completion |
| Platform Engineer | Executes technical data deletion, verifies cleanup |
| DPO | Signs off on data deletion certification |
| Legal Counsel | Reviews contractual obligations, legal hold status |
| Billing Operations | Processes Stripe cancellation, final invoice |
| Security Engineer | Verifies audit trail preservation, credential cleanup |

## 4. Prerequisites

- Offboarding request received and approved by Customer Success Lead
- Tenant contract terms reviewed for data retention obligations
- All active users notified of pending offboarding (minimum 30 days notice)
- DPO available for deletion certification sign-off
- Temporal `DATA_DELETION` task queue worker operational
- RemediationExecutorService operational with `delete_data` action support
- Stripe API access for billing operations
- Backup of tenant data completed before deletion begins

## 5. Procedure

### 5.1 Pre-Offboarding Assessment

1. **Tenant Status Review**
   1.1. Retrieve tenant record:
        ```sql
        SELECT id, name, slug, status, subscription_tier,
               data_residency_region, created_at, plan_id, billing_account_id
        FROM tenants
        WHERE id = '<tenant_id>';
        ```
   1.2. Inventory tenant scope:
        ```sql
        -- Active users
        SELECT COUNT(*) FROM users WHERE tenant_id = '<tenant_id>' AND status = 'active';

        -- Data sources
        SELECT type, status, COUNT(*) FROM data_sources
        WHERE tenant_id = '<tenant_id>'
        GROUP BY type, status;

        -- Discovered assets
        SELECT COUNT(*) FROM assets WHERE tenant_id = '<tenant_id>';

        -- DSAR requests
        SELECT status, COUNT(*) FROM dsar_requests
        WHERE tenant_id = '<tenant_id>'
        GROUP BY status;

        -- Incidents
        SELECT status, COUNT(*) FROM incidents
        WHERE tenant_id = '<tenant_id>'
        GROUP BY status;

        -- Remediation plans
        SELECT status, COUNT(*) FROM remediation_plans
        WHERE tenant_id = '<tenant_id>'
        GROUP BY status;
        ```
   1.3. Document total data footprint for deletion tracking

2. **Legal Hold Check**
   2.1. Query active legal holds:
        ```sql
        SELECT * FROM legal_holds
        WHERE tenant_id = '<tenant_id>'
          AND status = 'active';
        ```
   2.2. If active legal holds exist:
        - **STOP**: Cannot proceed with data deletion
        - Notify Legal Counsel for hold release decision
        - Document hold details and delay reason
        - Schedule re-check after hold resolution
   2.3. If no active holds: Proceed with offboarding
   2.4. Retain legal hold check result as compliance evidence

3. **DSAR Completion Verification**
   3.1. Check for open DSAR requests:
        ```sql
        SELECT id, reference_number, type, status, created_at, due_date
        FROM dsar_requests
        WHERE tenant_id = '<tenant_id>'
          AND status NOT IN ('completed', 'cancelled', 'identity_failed');
        ```
   3.2. For each open DSAR:
        - If near deadline: Expedite completion before offboarding
        - If recently submitted: Complete processing (regulatory obligation)
        - If stale: Review with Privacy Officer for appropriate closure
   3.3. All DSARs must be completed or properly closed before data deletion
   3.4. Document DSAR resolution status

4. **Active Workflow Verification**
   4.1. Check for running Temporal workflows:
        ```bash
        tctl workflow list --query "TenantId='<tenant_id>' AND ExecutionStatus='Running'"
        ```
   4.2. For each active workflow:
        - SCAN workflows: Cancel (no longer needed)
        - DSAR workflows: Complete (regulatory obligation)
        - BREACH workflows: Complete (regulatory obligation)
        - RETENTION workflows: Cancel (superseded by full deletion)
        - APPROVAL workflows: Cancel (moot post-offboarding)
        - VENDOR workflows: Complete or cancel based on contractual need
        - REMEDIATION workflows: Cancel (superseded by full deletion)
        - DATA_DELETION workflows: Let complete (already in progress)

### 5.2 Data Export

5. **Tenant Data Export**
   5.1. Generate comprehensive data export for the tenant:
        - All data source configurations (credentials excluded)
        - Asset inventory with classifications
        - DSAR request history and responses
        - Compliance assessment results
        - Consent records
        - Audit log extract (tenant-scoped)
        - ROPA (Records of Processing Activities)
        - Vendor assessment records
   5.2. Export format: JSON and CSV in encrypted ZIP archive
   5.3. Encrypt with tenant's encryption key (`encryptionKeyId`)
   5.4. Provide secure download link (72-hour expiry, single-use)
   5.5. Audit log: `action: 'tenant.data.exported'`
   5.6. Retain export package for 30 days post-offboarding

6. **Tenant Notification**
   6.1. Send final data export availability notice to all tenant admins
   6.2. Provide data deletion timeline:
        - Data export available for download: 30 days
        - Data deletion begins: After export window closes (or on request)
        - Data deletion completion: Within 30 days of initiation
        - Audit trail retention: Per regulatory minimum (see Section 5.5)
   6.3. Request written confirmation of data export receipt (recommended)

### 5.3 Billing Cancellation

7. **Stripe Billing Termination**
   7.1. Cancel Stripe subscription:
        ```typescript
        // Via billing service - uses Stripe provider (not NullBillingProvider)
        // Production guard ensures real Stripe provider is used
        await billingService.cancelSubscription(tenantId, {
          reason: 'tenant_offboarding',
          cancelAtPeriodEnd: false, // Immediate cancellation
        });
        ```
   7.2. Generate final invoice for prorated usage:
        ```sql
        SELECT * FROM invoices
        WHERE tenant_id = '<tenant_id>'
          AND status = 'pending';
        ```
   7.3. Process outstanding payments
   7.4. Update billing account status:
        ```sql
        UPDATE billing_accounts
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE tenant_id = '<tenant_id>';
        ```
   7.5. Audit log: `action: 'billing.subscription.cancelled'`

### 5.4 Data Deletion

8. **Tenant Suspension**
   8.1. Update tenant status to prevent further access:
        ```sql
        UPDATE tenants SET status = 'deactivated' WHERE id = '<tenant_id>';
        ```
   8.2. Invalidate all user sessions in Redis:
        ```bash
        redis-cli KEYS "session:<tenant_id>:*" | xargs redis-cli DEL
        ```
   8.3. Revoke all API keys for the tenant
   8.4. Disable all data source connections

9. **Connector-Side Data Cleanup**
   9.1. For each connected data source, check if platform manages data in the source:
        ```sql
        SELECT id, type, status FROM data_sources
        WHERE tenant_id = '<tenant_id>';
        ```
   9.2. For sources where platform created/modified data:
        - Initiate Temporal `DATA_DELETION` workflow per connector
        - Check CAPABILITY_MATRIX for `delete_data` support:

        | Connector Type | delete_data Support | Action |
        |---------------|-------------------|--------|
        | aws_s3 | Yes | Delete platform-created objects |
        | postgresql | Yes | Delete platform-created records |
        | salesforce | Yes | Remove platform-managed fields |
        | google_drive | Yes | Remove platform-created files |
        | (etc.) | Check matrix | Per connector capability |

   9.3. Execute `disposeAsset` via RemediationExecutorService for each supported connector
   9.4. For connectors without `delete_data`: Document and notify tenant of remaining data
   9.5. Verify deletion confirmation from each connector

10. **Platform Database Deletion**
    10.1. Delete tenant data in dependency order (foreign key constraints):
          ```sql
          -- Phase 1: Workflow and activity data
          DELETE FROM remediation_plans WHERE tenant_id = '<tenant_id>';
          DELETE FROM risk_findings WHERE tenant_id = '<tenant_id>';
          DELETE FROM identity_access_mappings WHERE tenant_id = '<tenant_id>';
          DELETE FROM classifications WHERE tenant_id = '<tenant_id>';
          DELETE FROM content_samples WHERE tenant_id = '<tenant_id>';

          -- Phase 2: Module data
          DELETE FROM dsar_requests WHERE tenant_id = '<tenant_id>';
          DELETE FROM data_subjects WHERE tenant_id = '<tenant_id>';
          DELETE FROM consent_records WHERE tenant_id = '<tenant_id>';
          DELETE FROM incidents WHERE tenant_id = '<tenant_id>';
          DELETE FROM vendor_assessments WHERE tenant_id = '<tenant_id>';
          DELETE FROM compliance_assessments WHERE tenant_id = '<tenant_id>';

          -- Phase 3: Core data
          DELETE FROM assets WHERE tenant_id = '<tenant_id>';
          DELETE FROM scan_jobs WHERE tenant_id = '<tenant_id>';
          DELETE FROM data_sources WHERE tenant_id = '<tenant_id>';

          -- Phase 4: User and access data
          DELETE FROM user_roles WHERE user_id IN (
            SELECT id FROM users WHERE tenant_id = '<tenant_id>'
          );
          DELETE FROM users WHERE tenant_id = '<tenant_id>';
          DELETE FROM roles WHERE tenant_id = '<tenant_id>';

          -- Phase 5: Billing data (retain for financial records)
          -- invoices and billing_accounts retained per financial retention policy

          -- Phase 6: Feature overrides and configuration
          DELETE FROM feature_overrides WHERE tenant_id = '<tenant_id>';
          DELETE FROM usage_events WHERE tenant_id = '<tenant_id>';
          DELETE FROM usage_aggregates WHERE tenant_id = '<tenant_id>';
          DELETE FROM onboarding_state WHERE tenant_id = '<tenant_id>';
          ```
    10.2. Each deletion step audit logged (using system actor, not tenant actor)
    10.3. Run deletion in a transaction with advisory lock to prevent concurrent access

11. **Redis Cleanup**
    11.1. Remove all tenant-scoped Redis keys:
          ```bash
          redis-cli KEYS "*:<tenant_id>:*" | xargs redis-cli DEL
          redis-cli KEYS "tenant:<tenant_id>:*" | xargs redis-cli DEL
          redis-cli KEYS "feature:<tenant_id>:*" | xargs redis-cli DEL
          ```
    11.2. Verify no residual keys remain

12. **NATS Cleanup**
    12.1. NATS events containing tenant data expire per stream retention (7 days)
    12.2. For immediate cleanup: Purge messages with tenant_id filter if supported
    12.3. Verify DLQ does not contain unprocessed tenant events

### 5.5 Audit Trail Preservation

13. **Audit Log Retention**
    13.1. Audit logs are NOT deleted during tenant offboarding
    13.2. Export tenant audit logs to long-term archive:
          ```sql
          COPY (
            SELECT * FROM audit_logs
            WHERE tenant_id = '<tenant_id>'
            ORDER BY created_at
          ) TO '/archive/tenant-<tenant_id>/audit_logs.csv' WITH CSV HEADER;
          ```
    13.3. Verify hash chain integrity on archived logs
    13.4. Retain archived audit logs per regulatory minimums:
          - Security events: 7 years
          - DSAR records: 5 years
          - General audit: 3 years
    13.5. After retention period: Secure deletion with documentation

14. **Deletion Certification**
    14.1. Generate deletion certificate containing:
          - Tenant identifier and offboarding date
          - Data categories deleted
          - Connector-side deletion confirmations
          - Audit trail preservation confirmation
          - Legal hold clearance confirmation
          - DSAR completion confirmation
          - Data retained (billing records, audit logs) with retention periods
    14.2. DPO signs deletion certificate
    14.3. Provide deletion certificate to tenant (upon request)
    14.4. File deletion certificate in compliance records

### 5.6 Post-Offboarding Verification

15. **Deletion Verification**
    15.1. Verify no data remains in application tables:
          ```sql
          -- Run for each major table
          SELECT COUNT(*) FROM users WHERE tenant_id = '<tenant_id>';
          SELECT COUNT(*) FROM data_sources WHERE tenant_id = '<tenant_id>';
          SELECT COUNT(*) FROM assets WHERE tenant_id = '<tenant_id>';
          SELECT COUNT(*) FROM dsar_requests WHERE tenant_id = '<tenant_id>';
          -- Should all return 0
          ```
    15.2. Verify no Temporal workflows remain:
          ```bash
          tctl workflow list --query "TenantId='<tenant_id>'" --count
          ```
    15.3. Verify Redis cleanup:
          ```bash
          redis-cli KEYS "*<tenant_id>*" | wc -l
          # Should return 0
          ```
    15.4. Verify tenant cannot authenticate (status = deactivated)

16. **Tenant Record Handling**
    16.1. Retain minimal tenant record for audit reference:
          ```sql
          UPDATE tenants SET
            status = 'deactivated',
            settings = NULL,
            metadata = jsonb_build_object('offboarded_at', NOW(), 'offboarded_by', '<actor_id>')
          WHERE id = '<tenant_id>';
          ```
    16.2. Tenant record retained for billing reconciliation and audit cross-reference
    16.3. After billing retention period: Anonymize tenant record

17. **Backup Considerations**
    17.1. Existing backups containing tenant data are retained per backup rotation policy
    17.2. Tenant data in backups expires naturally with backup rotation (SOP-006):
          - Daily backups: 30-day retention
          - Weekly backups: 90-day retention
          - Monthly backups: 1-year retention
    17.3. For urgent purge from backups (regulatory requirement): Contact Infrastructure Lead
    17.4. Document backup retention timeline in deletion certificate

## 6. Verification

- [ ] Legal hold check completed (no active holds blocking deletion)
- [ ] All open DSARs completed or properly closed
- [ ] All active Temporal workflows resolved
- [ ] Data export generated and provided to tenant
- [ ] Stripe subscription cancelled and final invoice processed
- [ ] Tenant status set to `deactivated`
- [ ] All user sessions invalidated
- [ ] Connector-side data deletion completed (per CAPABILITY_MATRIX)
- [ ] Platform database deletion completed (all tables)
- [ ] Redis keys cleaned up
- [ ] Audit logs archived with hash chain integrity verified
- [ ] Deletion certificate generated and signed by DPO
- [ ] Post-deletion verification confirms no residual data

## 7. Rollback

Tenant offboarding is a destructive, irreversible process once data deletion begins. Safeguards:
1. **Before deletion**: Full data export + database backup ensure recovery is possible
2. **During deletion**: If process fails mid-way, document progress and resume (do not restart)
3. **After deletion**: Recovery only possible from pre-offboarding backup (SOP-006)
4. **Re-activation request**: If tenant requests re-activation before deletion:
   - Update status from `deactivated` to `active`
   - Re-enable data sources
   - Restore user sessions (users must re-authenticate)
   - Resume any cancelled workflows
5. After deletion is complete: Re-activation requires new tenant provisioning

## 8. Frequency

- **Tenant offboarding**: As triggered by cancellation/termination
- **Pending offboarding review**: Weekly (check for stalled offboarding processes)
- **Audit trail retention review**: Quarterly
- **Offboarding process review**: Semi-annually
- **Deletion certificate audit**: Annually (verify all certificates on file)

## 9. References

- SOP-002: DSAR Processing (for completing open DSARs)
- SOP-006: Backup & Recovery (for pre-deletion backup and retention)
- SOP-011: Audit Log Review (for audit trail preservation)
- Architecture Doc: `docs/architecture/04-core-data-model.md`
- Source: `apps/api/src/core/billing/providers/` (Stripe + NullBillingProvider)
- Source: `apps/api/src/modules/remediation/remediation-agent.service.ts`
- Source: `apps/api/prisma/schema.prisma` (Tenant model, RLS)

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Customer Success Lead | Initial version |
| | | | |
| | | | |
