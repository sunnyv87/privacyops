# TechD PrivacyOps + DSPM Platform -- Data Retention Policy

**Document ID:** TECHD-DRP-006
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Data Protection Officer (DPO)
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy defines the data retention framework for the TechD PrivacyOps + DSPM platform, including retention schedules by data type and regulation, automated enforcement via Temporal workflows, legal hold interaction, and the apply_retention remediation action. It applies to all data processed, stored, or managed by the platform across all 43 registered connectors and internal data stores.

---

## 2. Retention Principles

- **Purpose Limitation:** Data is retained only as long as necessary for its stated processing purpose.
- **Regulatory Compliance:** Retention periods meet or exceed minimum requirements across all applicable regulations.
- **Automated Enforcement:** Retention policies are enforced automatically through Temporal RETENTION task queue workflows.
- **Legal Hold Supremacy:** Active legal holds override retention policies, preventing deletion regardless of retention period expiry.
- **Audit Trail:** All retention actions are logged in the SHA256 hash chain audit log.
- **Fail-Safe Deletion:** Data deletion failures are retried with exponential backoff and escalated after configurable failure thresholds.

---

## 3. Retention Schedules

### 3.1 Platform Internal Data

| Data Type | Retention Period | Justification | Deletion Method |
|-----------|-----------------|---------------|-----------------|
| Tenant user accounts | Duration of tenancy + 90 days | Account recovery, billing reconciliation | Soft delete, then hard delete |
| Authentication tokens (active) | Token lifetime (15 min / 7 days) | Session management | Automatic expiry |
| Authentication tokens (revoked) | 30 days post-revocation | Security forensics | Hard delete |
| MFA recovery codes | Until used or MFA reset | Authentication | Hard delete on use |
| Connector credentials | Duration of connector + 30 days | Operational | Hard delete with secure wipe |
| DSAR request records | 6 years | GDPR accountability | Soft delete, then archive |
| DSAR response payloads | 90 days post-delivery | Data minimization | Hard delete |
| Scan results (catalog metadata) | Duration of connector | Operational | Cascading delete on connector removal |
| Billing records (Stripe metadata) | 7 years | Tax/financial compliance | Archived, then deleted |
| Workflow execution history | 1 year | Operational monitoring | Temporal retention policy |
| NATS JetStream messages (processed) | 7 days | Replay/retry capability | JetStream retention policy |
| NATS DLQ messages | 30 days | Debugging and forensics | JetStream retention policy |

### 3.2 Audit Log Retention

Audit log retention is defined in the Audit Logging Policy (TECHD-ALP-005). Summary:

| Log Category | Retention Period |
|-------------|-----------------|
| Authentication/Authorization events | 3 years |
| Data access events (PII/PHI/PCI) | 6 years |
| DSAR events | 6 years |
| Remediation events | 6 years |
| System events | 1 year |
| Legal hold events | Hold duration + 7 years |

### 3.3 Tenant Data Retention (Connected Sources)

Retention policies for data in connected sources are configurable per tenant and enforced via the platform's remediation capabilities:

| Classification | Default Retention | Minimum (GDPR) | Minimum (HIPAA) | Minimum (PCI DSS) |
|---------------|-------------------|-----------------|-----------------|-------------------|
| PII | 3 years or purpose expiry | Until purpose expires | N/A | N/A |
| PHI | 6 years | N/A | 6 years from creation or last effective date | N/A |
| PCI | 1 year post-transaction | N/A | N/A | 1 year |
| Confidential | 5 years | N/A | N/A | N/A |
| Internal | 3 years | N/A | N/A | N/A |
| Public | No automatic deletion | N/A | N/A | N/A |

---

## 4. Per-Regulation Retention Requirements

### 4.1 GDPR (General Data Protection Regulation)

- **Article 5(1)(e):** Personal data kept no longer than necessary for the purposes for which it is processed.
- **Article 17:** Right to erasure ("right to be forgotten") must be honored within 30 days unless an exception applies.
- **Article 30:** Records of processing activities retained for the duration of processing plus a reasonable accountability period (platform default: 6 years).
- **Platform Implementation:** DSAR DELETION workflows process erasure requests through the DSAR task queue. The `delete_data` remediation action executes deletion across applicable connectors. Deletion confirmation is logged in the audit chain.

### 4.2 CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act)

- **Section 1798.105:** Right to delete personal information upon consumer request.
- **Section 1798.130:** Response within 45 days (extendable to 90 days with notice).
- **Platform Implementation:** DSAR workflows configured for CCPA timelines. Automated connector-level deletion with verification scans.

### 4.3 HIPAA (Health Insurance Portability and Accountability Act)

- **45 CFR 164.530(j):** Retain documentation for 6 years from the date of creation or last effective date.
- **Platform Implementation:** PHI-classified data in connected sources has a minimum 6-year retention enforced. Deletion requests for PHI are validated against the 6-year minimum and blocked if within the retention period.

### 4.4 PCI DSS (Payment Card Industry Data Security Standard)

- **Requirement 3.1:** Keep cardholder data storage to a minimum; implement data retention policies.
- **Requirement 9.8:** Destroy media when no longer needed for business or legal reasons.
- **Platform Implementation:** PCI-classified data flagged for deletion after 1 year post-transaction. Full PAN values are never retained in the platform's own data stores.

---

## 5. Automated Retention Enforcement

### 5.1 Temporal RETENTION Task Queue

The RETENTION task queue manages automated retention enforcement workflows:

**Workflow Stages:**

1. **Discovery:** Identify data assets with expired retention periods based on catalog metadata.
2. **Validation:** Verify no active legal holds exist on the identified data (LegalHold RLS check).
3. **Classification Check:** Confirm data classification and applicable regulation minimum retention.
4. **Approval (if required):** Route to APPROVAL task queue for high-classification data (PII, PHI, PCI).
5. **Execution:** Invoke `apply_retention` action via RemediationExecutorService.
6. **Verification:** Re-scan the connector to verify data deletion/archival.
7. **Audit:** Log retention action in the SHA256 hash chain.
8. **Notification:** Notify tenant administrators of completed retention actions.

**Workflow Configuration:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| Schedule | Daily at 02:00 UTC | Cron schedule for retention checks |
| Batch Size | 1000 assets | Maximum assets processed per workflow run |
| Retry Policy | 3 attempts, exponential backoff | Failure handling |
| Timeout | 4 hours | Maximum workflow execution time |
| Approval Required | PII, PHI, PCI | Classifications requiring approval before deletion |

### 5.2 The apply_retention Remediation Action

The `apply_retention` action type in the RemediationExecutorService supports three modes per the CAPABILITY_MATRIX:

| Connector | Mode | Behavior |
|-----------|------|----------|
| aws_s3 | native | Applies S3 lifecycle rules to set expiration on objects |
| azure_blob | native | Configures blob lifecycle management policies |
| gcp_storage | native | Sets Object Lifecycle Management rules |
| snowflake | native | Executes time travel and data retention configuration |
| bigquery | native | Sets table/partition expiration |
| postgresql | catalog_update | Flags for manual deletion; optional: executes DELETE with tenant scope |
| mysql | catalog_update | Flags for manual deletion; optional: executes DELETE with tenant scope |
| sqlserver | catalog_update | Flags for manual deletion; optional: executes DELETE with tenant scope |
| mongodb | catalog_update | Flags for manual deletion; optional: executes DELETE with TTL index |
| salesforce | catalog_update | Flags for manual deletion via Salesforce admin |
| okta | unsupported | Manual intervention required |

### 5.3 Retention Tagging in Data Catalog

Each data asset in the catalog tracks retention metadata:

| Metadata Field | Description |
|----------------|-------------|
| `retention_policy_id` | Reference to the applicable retention policy |
| `retention_start_date` | Date from which the retention period is calculated |
| `retention_end_date` | Computed date when the retention period expires |
| `retention_status` | active, expiring_soon (30 days), expired, held, deleted |
| `legal_hold_id` | Reference to active legal hold (if applicable) |
| `last_retention_check` | Timestamp of last automated retention check |
| `deletion_date` | Actual date of deletion (if deleted) |
| `deletion_method` | Hard delete, soft delete, archive, or lifecycle rule |

---

## 6. Legal Hold Interaction

### 6.1 Legal Hold Supremacy

When a legal hold is active on data:

- Retention policies are suspended. Data is not deleted regardless of retention period expiry.
- `retention_status` is set to `held`.
- Deletion attempts are blocked and logged as `legal_hold.deletion_blocked` audit events.
- LegalHold enforcement operates at the RLS level with `tenant_id + released_at + expires_at` filtering.

### 6.2 Post-Hold Retention

When a legal hold is released:

1. `released_at` is set on the LegalHold record.
2. The RETENTION task queue re-evaluates held data against current retention policies.
3. Data that has exceeded its retention period is queued for deletion with standard approval workflows.
4. A 30-day grace period is applied after hold release before deletion executes.

### 6.3 Hold Expiration

Legal holds with `expires_at` values are automatically released upon expiration:

- Expiration is checked by the RETENTION task queue during its scheduled runs.
- Expired holds trigger the same post-hold retention process.
- Hold expiration is logged as `legal_hold.expired` audit event.

---

## 7. Data Deletion Procedures

### 7.1 Deletion Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| Hard Delete | Irrecoverable removal from storage | Expired PII, DSAR erasure requests |
| Soft Delete | Logical deletion with recovery period | Accidental deletion recovery (30-day window) |
| Archive | Move to cold storage with limited access | Long-term retention at reduced cost |
| Lifecycle Rule | Cloud provider-managed automatic deletion | Object storage retention enforcement |
| Secure Wipe | Cryptographic erasure or multi-pass overwrite | Connector credentials, encryption keys |

### 7.2 Deletion Verification

After each deletion action:

1. Verification scan of the connector/data store confirms data is no longer accessible.
2. Catalog metadata is updated with `deletion_date` and `deletion_method`.
3. Deletion confirmation is logged in the audit chain.
4. Failed deletions are retried per the workflow retry policy and escalated to tenant administrators.

### 7.3 Cross-Connector Deletion

When data subject data exists across multiple connectors:

- The DSAR DELETION workflow identifies all instances via the data catalog.
- Deletion is executed across all applicable connectors in the CAPABILITY_MATRIX.
- The workflow waits for all connector deletions to complete before marking the DSAR as fulfilled.
- Partial deletion failures are tracked per-connector with individual retry handling.

---

## 8. Tenant Offboarding Retention

When a tenant is deprovisioned:

1. **Grace Period:** 90 days of data retention post-deprovisioning for potential re-activation.
2. **Data Export:** Tenant administrators can request a full data export during the grace period.
3. **Deletion:** After the grace period, all tenant data (including audit logs, catalog metadata, and configuration) is permanently deleted.
4. **Verification:** Post-deletion verification scan confirms no residual tenant data exists.
5. **Certificate:** Deletion certificate generated and provided to the former tenant upon request.

---

## 9. Retention Policy Exceptions

Exceptions to standard retention schedules require:

- Written request from the tenant administrator with business justification.
- Review by the DPO for regulatory compliance impact.
- Approval by the compliance officer.
- Documentation in the tenant's configuration with audit trail.
- Periodic review (quarterly) to confirm the exception is still justified.

---

## 10. Metrics and Monitoring

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Retention workflow completion rate | > 99% | < 95% |
| Average deletion execution time | < 4 hours | > 8 hours |
| Data assets past retention period | 0 | > 100 assets per tenant |
| Legal hold compliance rate | 100% | Any hold violation |
| DSAR deletion completion time | < 25 days | > 20 days (warning) |

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Data Classification Policy | TECHD-DCP-002 |
| Audit Logging Policy | TECHD-ALP-005 |
| Privacy Impact Assessment Template | TECHD-PIA-007 |
| Compliance Matrix | TECHD-CM-012 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | DPO | Initial release |
| 2.0 | 2026-05-10 | DPO | Added Temporal RETENTION workflow details, apply_retention CAPABILITY_MATRIX, legal hold interaction, tenant offboarding, per-regulation requirements |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
