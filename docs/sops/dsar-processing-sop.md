# SOP-002: DSAR Processing

**Document ID:** SOP-PRIVACYOPS-DSAR-002
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Privacy Operations Lead

---

## 1. Purpose

Define the end-to-end procedure for processing Data Subject Access Requests (DSARs) within the TechD PrivacyOps platform. This covers intake, identity verification, data collection across all registered connectors, fail-closed redaction, legal hold enforcement, response package generation, and delivery within regulatory deadlines.

## 2. Scope

Applies to all DSAR types handled by the platform:
- **Access** (GDPR Art. 15, DPDP Act Sec. 11): Right to obtain a copy of personal data
- **Erasure/Deletion** (GDPR Art. 17, CCPA Sec. 1798.105): Right to be forgotten
- **Rectification** (GDPR Art. 16): Right to correct inaccurate data
- **Portability** (GDPR Art. 20): Right to receive data in machine-readable format
- **Restriction** (GDPR Art. 18): Right to restrict processing
- **Objection** (GDPR Art. 21): Right to object to processing

Covers all 43 registered connectors in ConnectorRegistry (AWS S3, PostgreSQL, Snowflake, Salesforce, Google Drive, SharePoint, Slack, etc.) and Temporal DSAR task queue workflows.

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Privacy Operations Analyst | Receives and triages DSAR requests, monitors workflow progress |
| Data Protection Officer (DPO) | Approves complex requests, exemption decisions |
| Platform Engineer | Troubleshoots workflow failures, connector issues |
| Legal Counsel | Reviews legal hold conflicts, exemption applicability |
| Tenant Admin | Configures tenant-specific DSAR settings, reviews responses |
| Identity Verification Team | Validates data subject identity |

## 4. Prerequisites

- DsarService operational with RedactionService dependency injected
- Temporal worker running on `DSAR` task queue with activities registered:
  - `verifyIdentity`, `collectData`, `generateResponse`, `notifyCompletion`, `notifyOverdue`
- IdentityMatcherService configured with tenant-specific matching rules
- RedactionService PII patterns loaded from `redaction-engine/patterns/pii-patterns.ts`
- NATS JetStream `PRIVACYOPS` stream accepting `privacyops.dsar.*` subjects
- All target connectors in `connected` status for the tenant
- Notification channels configured (email, in-app, webhook)

## 5. Procedure

### 5.1 Intake & Registration

1. **Request Receipt**
   1.1. DSAR received via one of:
        - Self-service portal (POST `/api/v1/dsar`)
        - Email to privacy@{tenant-domain} (auto-parsed)
        - Manual entry by Privacy Operations Analyst
   1.2. DsarService generates reference number: `DSAR-YYYY-NNNN`
   1.3. Data subject record created/updated via `findOrCreateDataSubject()`:
        - Email hashed with SHA-256 for pseudonymized lookup
        - Identity attributes merged (name, phone, externalId)
   1.4. Audit log entry created: `action: 'dsar.request.created'`
   1.5. NATS event published: `privacyops.dsar.created`

2. **Deadline Calculation**
   2.1. System calculates due dates per applicable regulation:

   | Regulation | Response Deadline | Extension Allowed |
   |-----------|-------------------|-------------------|
   | GDPR | 30 calendar days | +60 days (complex requests) |
   | CCPA/CPRA | 45 calendar days | +45 days (one extension) |
   | DPDP Act (India) | As prescribed by rules | Per Data Protection Board |
   | LGPD (Brazil) | 15 calendar days | None |
   | POPIA (South Africa) | 30 calendar days | +30 days |

   2.2. Earliest deadline set as `dueDateIso` in Temporal workflow input
   2.3. Warning thresholds configured: 7 days, 3 days, 1 day before deadline

3. **Request Validation**
   3.1. Verify request contains minimum required fields (subject email, request type)
   3.2. Check for duplicate requests from same data subject within 90 days
   3.3. Validate request type against tenant's enabled DSAR types
   3.4. Flag requests requiring DPO review (bulk requests, requests from legal representatives)

### 5.2 Identity Verification

4. **Verification Process**
   4.1. Temporal `dsarWorkflow` triggers `verifyIdentity` activity
   4.2. IdentityMatcherService performs multi-factor verification:
        - Email ownership verification (confirmation link)
        - Identity attribute cross-reference against `data_subjects` table
        - Optional: Government ID verification for high-sensitivity requests
   4.3. If verification fails:
        - Workflow returns `status: 'identity_verification_failed'`
        - Request status updated to `identity_failed`
        - Data subject notified with re-submission instructions
   4.4. If verification succeeds, workflow proceeds to data collection

### 5.3 Legal Hold Check

5. **Legal Hold Enforcement**
   5.1. Query `legal_holds` table with RLS-enforced tenant_id filtering:
        ```sql
        SELECT * FROM legal_holds
        WHERE tenant_id = '<tenant_id>'
          AND status = 'active'
          AND (scope @> '{"dataSubjectId": "<subject_id>"}'
               OR scope @> '{"global": true}');
        ```
   5.2. If active legal hold exists:
        - For **erasure** requests: Block deletion, notify Legal Counsel
        - For **access** requests: Proceed but flag held data in response
        - For **restriction** requests: Apply restriction but preserve data
   5.3. Document legal hold impact in request record
   5.4. Notify DPO of legal hold conflict for resolution decision

### 5.4 Data Collection

6. **Multi-Connector Data Gathering**
   6.1. Temporal `collectData` activity iterates all connected data sources for the tenant
   6.2. For each connector, IdentityMatcherService maps data subject to source-specific identifiers:
        - Email-based lookup (primary)
        - Phone number matching (secondary)
        - External ID cross-reference (tertiary)
   6.3. Connector `scanAssets` invoked to locate data subject records
   6.4. For each discovered asset, data extracted per request type:
        - **Access/Portability**: Full record extraction
        - **Erasure**: Record inventory for deletion confirmation
        - **Rectification**: Current values for correction
   6.5. Collection progress tracked per connector with heartbeat (3-min timeout)
   6.6. Failed connector collections logged; workflow continues with available data
   6.7. Maximum collection timeout: 10 minutes per activity, 1 hour per workflow

### 5.5 Redaction & Response Generation

7. **Fail-Closed PII Redaction**
   7.1. RedactionService processes all collected data through PII patterns:
        - SSN, credit card, passport numbers
        - Third-party personal data (other data subjects)
        - Internal system identifiers and credentials
   7.2. **CRITICAL: Fail-closed behavior** - If redaction fails for any reason:
        - Download of response package is **blocked entirely**
        - Error logged with `severity: 'critical'`
        - Privacy Operations Analyst notified for manual review
        - Request status set to `redaction_review_required`
   7.3. Redaction applied to: response documents, data exports, metadata
   7.4. Redaction audit trail preserved (what was redacted, pattern matched, timestamp)

8. **Response Package Assembly**
   8.1. Temporal `generateResponse` activity creates response package:
        - Cover letter with request reference number
        - Data inventory by source system
        - Extracted data in requested format (JSON, CSV, PDF)
        - Processing activity summary (ROPA extract)
   8.2. Package encrypted with tenant-specific key (`encryptionKeyId` from `tenants` table)
   8.3. Package stored in secure staging area with 30-day auto-expiry

### 5.6 Review & Delivery

9. **Quality Review**
   9.1. For standard requests: Auto-approved if redaction passed
   9.2. For complex requests (legal hold, bulk, representative):
        - DPO reviews response package
        - Approval routed through Temporal `APPROVAL` task queue
   9.3. Reviewer verifies:
        - All connected sources queried
        - Redaction applied correctly (no third-party PII leaked)
        - Legal hold constraints respected
        - Response addresses all aspects of the request

10. **Delivery**
    10.1. Data subject notified via configured channels (NotificationService)
    10.2. Secure download link generated with:
          - Time-limited access (72 hours)
          - Single-use token
          - IP-restricted to verification context
    10.3. Download audit logged: `action: 'dsar.response.downloaded'`
    10.4. For erasure requests: Proceed to deletion workflow (see step 11)

### 5.7 Erasure Execution (Deletion Requests Only)

11. **Data Deletion**
    11.1. Temporal `DATA_DELETION` task queue workflow triggered
    11.2. For each connector with identified data:
          - Check CAPABILITY_MATRIX for `delete_data` support
          - Execute `disposeAsset` via RemediationExecutorService
          - Verify deletion confirmation from connector
    11.3. Deletion verification:
          - Re-scan affected sources to confirm data removed
          - Document any data retained under legal exemption
    11.4. Deletion certificate generated and stored in audit trail

### 5.8 Closure

12. **Request Closure**
    12.1. Update request status to `completed`
    12.2. Temporal `notifyCompletion` activity sends closure notification
    12.3. Final audit log entry: `action: 'dsar.request.completed'`
    12.4. NATS event published: `privacyops.dsar.completed`
    12.5. Compliance evidence package generated for regulatory record

## 6. Verification

- [ ] Request reference number (DSAR-YYYY-NNNN) assigned and tracked
- [ ] Identity verification completed and documented
- [ ] Legal hold check performed and conflicts resolved
- [ ] All connected data sources queried (check per-connector status)
- [ ] Redaction applied successfully (no fail-closed blocks)
- [ ] Response delivered within regulatory deadline
- [ ] Audit trail complete with hash chain integrity
- [ ] For erasure: Deletion verified across all connectors

## 7. Rollback

If DSAR workflow fails mid-execution:
1. Check Temporal workflow execution state via Web UI
2. Retry failed activities using Temporal retry mechanism (max 3 attempts, backoff coefficient 2)
3. If collector activity fails: Re-run `collectData` for failed connectors only
4. If redaction fails: Do NOT bypass; escalate to Privacy Operations for manual processing
5. If delivery fails: Re-generate secure download link and re-notify
6. For erasure rollback: Restore from backup if deletion was incorrect (see SOP-006)

## 8. Frequency

- **Request processing**: Continuous (as received)
- **Overdue request review**: Daily automated check via Temporal scheduled jobs
- **Process audit**: Monthly review of completion rates and SLA compliance
- **Connector coverage validation**: Quarterly (ensure new connectors added to DSAR flow)
- **Redaction pattern update**: Quarterly or when new PII types identified

## 9. References

- SOP-011: Audit Log Review
- SOP-012: Tenant Offboarding (for bulk deletion scenarios)
- Architecture Doc: `docs/architecture/07-privacyops-detailed-design.md`
- Source: `apps/api/src/modules/dsar/dsar.service.ts`
- Source: `apps/api/src/core/workflow/workflows/dsar.workflow.ts`
- Source: `apps/api/src/modules/redaction-engine/redaction.service.ts`
- Source: `apps/api/src/modules/dsar/identity-matcher.service.ts`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Privacy Operations | Initial version |
| | | | |
| | | | |
