# TechD PrivacyOps + DSPM -- FAQ & Troubleshooting

This document addresses the top 25 frequently asked questions covering login and access, connector issues, scan errors, DSAR processing, remediation, consent management, AI Co-pilot, data classification, and general platform usage.

---

## Table of Contents

1. [Login and Access Issues](#login-and-access-issues)
2. [Connector Issues](#connector-issues)
3. [Scan Errors](#scan-errors)
4. [DSAR Issues](#dsar-issues)
5. [Remediation Issues](#remediation-issues)
6. [Consent Management Issues](#consent-management-issues)
7. [AI Co-pilot Issues](#ai-co-pilot-issues)
8. [Data Classification Questions](#data-classification-questions)
9. [General Platform Questions](#general-platform-questions)

---

## Login and Access Issues

### 1. I cannot log in -- my password is not accepted

**Cause:** Incorrect password, expired password, or account locked after too many failed attempts.

**Resolution:**
- Verify you are using the correct email address.
- Check if your password has expired (default policy: 90 days). If so, click **Forgot Password** on the login page to initiate a password reset.
- After 5 consecutive failed login attempts, the account is temporarily locked for 15 minutes. Wait and try again, or contact your Admin to unlock the account.
- If your organization uses SSO/SAML, use the **Sign in with SSO** button instead of entering a password.

### 2. I lost my MFA device and cannot complete two-factor authentication

**Cause:** Authenticator app no longer available on the original device.

**Resolution:**
- Use one of the recovery codes provided during MFA enrollment. Each code is single-use.
- If you have no remaining recovery codes, contact your tenant Admin. The Admin can navigate to **Settings > Users**, select your account, and click **Reset MFA** to allow you to re-enroll.
- After re-enrollment, save the new recovery codes in a secure location.

### 3. I can see the dashboard but certain modules are missing from the sidebar

**Cause:** Your assigned role does not include access to those modules, or the feature is disabled via feature gates.

**Resolution:**
- Check your role: Navigate to your **Profile** page to see your assigned role. Refer to the [Admin Configuration Guide](admin-configuration-guide.md) for role-to-module mappings.
- If you need access to a module your role does not cover, ask your Admin to change your role or enable the feature gate in **Settings > Features**.

---

## Connector Issues

### 4. The connector test fails with "Connection timed out"

**Cause:** Network connectivity issue between PrivacyOps and the target data source.

**Resolution:**
- Verify the hostname and port are correct.
- Ensure your firewall or security group allows inbound connections from PrivacyOps IP ranges. Contact TechD support at `support@techd.io` for the current IP allowlist.
- If the data source is in a private network (VPC), confirm that VPC peering or a VPN tunnel is configured.
- For cloud-hosted databases (AWS RDS, Azure SQL, Cloud SQL), check that the "publicly accessible" setting is enabled, or that a private endpoint is configured.

### 5. The connector test fails with "Authentication failed"

**Cause:** Incorrect credentials provided for the data source.

**Resolution:**
- Double-check the username and password. For databases, test the credentials directly using a client tool (e.g., `psql` for PostgreSQL, `mysql` CLI for MySQL).
- For Salesforce, verify the security token is appended to the password, or that your Connected App has the correct OAuth scopes.
- For AWS S3, confirm the IAM access key is active and has the required permissions (`s3:ListBucket`, `s3:GetObject`).
- For Snowflake, verify the role, warehouse, and account identifier are correct.

### 6. The connector shows "Degraded" or "Offline" status after previously working

**Cause:** Credential rotation, network change, or the data source is temporarily unavailable.

**Resolution:**
- Check if credentials were recently rotated. If so, update the connector credentials in **Discovery > Connectors > Edit**.
- Verify the data source is online and accepting connections.
- Check for network changes (firewall rule updates, VPN outages, DNS changes).
- Navigate to the connector detail page and click **Test Connection** to get a specific error message.

### 7. I need to connect to a data source type not listed in the connector catalog

**Cause:** The required connector type is not among the 43 currently supported connectors.

**Resolution:**
- Check the full connector catalog in **Discovery > Connectors > Add Connector** -- some connector types may be listed under different names.
- Contact TechD support to request a new connector type. Include the data source type, version, and expected data volume.
- As a workaround, some data sources can be accessed via generic connectors (e.g., JDBC for SQL-compatible databases).

---

## Scan Errors

### 8. A scan completes but discovers zero assets

**Cause:** The connector credentials lack sufficient read permissions, or the schema/table filters are too restrictive.

**Resolution:**
- Verify the database user has `SELECT` privileges on the target schemas and tables (refer to the [Connector Setup Guide](connector-setup-guide.md) for recommended user setup scripts).
- Check the scan scope configuration -- ensure the schema and table filters include the target objects.
- For cloud storage connectors, verify the IAM policy includes `ListBucket` permission on the target buckets.

### 9. A scan is stuck in "In Progress" for hours

**Cause:** Large data source, resource constraints, or a hung workflow.

**Resolution:**
- Check the scan progress details on the connector's scan history page. A scan of a very large data source (thousands of tables, millions of objects) can legitimately take several hours.
- If the scan shows no progress for more than 30 minutes, click **Cancel Scan** and retry.
- If scans consistently hang, check whether the data source is under heavy load during the scan window. Reschedule scans to off-peak hours.
- Contact TechD support if the issue persists after retrying.

### 10. Scan fails with "SSL handshake error"

**Cause:** TLS certificate mismatch or expiration on the data source.

**Resolution:**
- Verify that the data source's TLS certificate is valid and not expired.
- If the data source uses a private CA, upload the CA certificate in the connector configuration (the SSL CA Certificate field).
- Ensure the database server supports TLS 1.2 or later.
- For self-signed certificates in non-production environments, some connectors offer a "Trust Server Certificate" option -- however, this is not recommended for production.

---

## DSAR Issues

### 11. The identity verification step returns no matches

**Cause:** The data subject's identifying information does not match any records in connected data sources.

**Resolution:**
- Verify the subject's email, name, and phone number are entered correctly.
- Check that the connectors containing the subject's data are active and have been scanned recently.
- The fuzzy matching algorithm may not find matches if the subject used a significantly different name or email variant. Try searching with alternative identifiers (external ID, alternate email).
- If the subject is genuinely not in your systems, close the DSAR with a "No Data Found" response.

### 12. Data discovery is taking unusually long for a DSAR

**Cause:** Many connectors to search, large data volumes, or slow-responding data sources.

**Resolution:**
- Check the discovery progress on the DSAR detail page. Each connector shows its individual status.
- If a specific connector is slow, its underlying data source may be under load. Discovery will retry automatically.
- For tenants with many connectors (20+), discovery runs in parallel batches. Processing time scales with the slowest connector, not the total count.
- If a connector consistently fails during DSAR discovery, check its health status and connectivity.

### 13. The DSAR response package contains data that should have been redacted

**Cause:** The Redaction Engine did not detect certain PII patterns, or the data format is unusual.

**Resolution:**
- Review the specific unredacted content. If it matches a known PII pattern (email, phone, name, SSN, etc.), report it to TechD support as a redaction rule gap.
- Use the **Manual Redaction** feature on the Redaction Review tab to redact the content before sending the response package.
- For non-standard PII formats (e.g., internal customer IDs), add a custom classification label and contact TechD support to extend the redaction rules.

### 14. How do I extend the SLA deadline for a DSAR?

**Resolution:**
1. Navigate to the DSAR detail page.
2. Click **Request Extension**.
3. Enter the extension duration (based on the applicable regulation's extension allowance).
4. Provide a justification (e.g., request complexity, volume of data, need for additional verification).
5. The system automatically notifies the data subject that the deadline has been extended (where the regulation requires notification).

---

## Remediation Issues

### 15. A native remediation action failed with "Insufficient privileges"

**Cause:** The connector's service account lacks the permissions required to execute the remediation action.

**Resolution:**
- Native remediation actions (e.g., `revoke_access`, `mask_data`) require write/admin permissions on the data source, not just read access.
- Update the connector's service account with the necessary permissions:
  - PostgreSQL: `GRANT` and `REVOKE` privileges
  - AWS S3: `s3:PutBucketPolicy`, `s3:PutEncryptionConfiguration`
  - Snowflake: `SECURITYADMIN` or `ACCOUNTADMIN` role for access-related actions
- After updating permissions, retry the remediation action.

### 16. I executed a remediation but the finding is still showing as "Open"

**Cause:** The finding status updates after the next scan confirms the issue is resolved.

**Resolution:**
- After executing a remediation, the finding moves to "In Progress" status.
- The finding is marked "Resolved" either:
  - Immediately, if the remediation action was native and completed successfully.
  - After the next scan, if the remediation was a catalog update or manual action.
- You can manually mark a finding as "Resolved" with evidence if you have confirmed the fix outside the platform.

### 17. Can I undo a remediation action that was executed by mistake?

**Resolution:**
- For native actions: Navigate to the resolved finding, click **View Execution Log**, and click **Rollback** if available.
- Rollback is available for most native actions within 30 days, except for `delete_data` (data deletion is permanent and irreversible).
- For catalog updates and manual actions: No automatic rollback. Revert the change manually in the target system.
- All rollback actions require the same or higher authorization as the original action.

---

## Consent Management Issues

### 18. Consent records from the public endpoint are not appearing in the platform

**Cause:** Signature verification failure or misconfigured tenant ID.

**Resolution:**
- Verify the `CONSENT_PUBLIC_SHARED_SECRET` environment variable matches between your web application and the PrivacyOps deployment.
- Ensure the `X-Tenant-Id` header in the request matches your tenant ID.
- Verify the `X-Consent-Signature` is computed as HMAC-SHA256 of the request body using the shared secret.
- Check your server logs for 401 or 403 errors from the consent public endpoint.
- Test the integration using the Consent SDK's built-in test mode.

### 19. Consent withdrawal is not triggering downstream data processing changes

**Cause:** Withdrawal workflows are not linked to processing activities.

**Resolution:**
- Navigate to **Consent > Purposes** and verify that each purpose is linked to the relevant processing activities and data sources.
- Check **Settings > Consent > Withdrawal Workflows** to ensure automated actions (e.g., data deletion, processing suspension) are configured for each purpose.
- If workflows are configured but not executing, check the Temporal workflow status in the system health dashboard, or contact TechD support.

---

## AI Co-pilot Issues

### 20. The AI Co-pilot returns generic responses instead of platform-specific answers

**Cause:** The `ai_llm_enrichment` feature flag is disabled, or the AI API key is not configured.

**Resolution:**
- Ask your Admin to verify that the `ai_copilot` feature gate is enabled in **Settings > Features**.
- Verify the `ANTHROPIC_API_KEY` environment variable is configured in the deployment. Without it, the AI provider is inert and falls back to template-based responses.
- If both are configured and the issue persists, the AI service may be temporarily unavailable. The platform degrades gracefully -- all functionality works without AI, but responses use deterministic templates instead of natural language.

### 21. Is my sensitive data sent to the AI model?

**Resolution:**
- No. All data sent to the AI model is pre-scrubbed by the Redaction Engine, which detects and removes 12 PII pattern types (names, emails, phone numbers, SSNs, credit card numbers, etc.) before submission.
- The AI Co-pilot operates on metadata, aggregated statistics, and redacted summaries -- never on raw personal data.
- Your Admin can disable AI features entirely via the `ai_copilot` and `ai_llm_enrichment` feature gates if your organization's policy prohibits external AI processing.

---

## Data Classification Questions

### 22. How do I add custom classification labels?

**Resolution:**
1. Navigate to **Classification > Labels**.
2. Click **Create Label**.
3. Define:
   - **Label name** (e.g., "Employee ID", "Internal Account Number")
   - **Category** (e.g., Internal PII, Business Confidential)
   - **Sensitivity level** (1-5)
   - **Detection patterns** -- regex patterns and/or keyword lists for automatic detection
   - **Regulation tags** -- which regulations this label is relevant to
4. Click **Save**. Custom labels are scoped to your tenant.
5. Trigger a rescan on relevant connectors to apply the new label to existing data.

> **Note:** The `custom_classification` feature gate must be enabled (it is enabled by default).

### 23. The classification engine is labeling data incorrectly (false positives)

**Cause:** Regex patterns matching unintended data formats, or ML model confidence thresholds too low.

**Resolution:**
- Navigate to **Classification > Reviews** and reject incorrect classifications. This feedback improves future accuracy.
- For persistent false positives on a specific label, contact TechD support to tune the detection pattern.
- Adjust the ML model confidence threshold in **Settings > Classification > Confidence Threshold** (default: 0.75). Increasing the threshold reduces false positives but may increase false negatives.
- Add exclusion rules for specific columns or tables that consistently produce false positives.

---

## General Platform Questions

### 24. How do I export my data from PrivacyOps for external audit or backup?

**Resolution:**
- **Reports:** All reports can be exported in PDF, CSV, XLSX, or JSON format from the Reports module.
- **Audit Logs:** Export audit logs from **Settings > Audit Log > Export** in CSV or JSON format.
- **DSAR Archives:** Download completed DSAR packages from individual DSAR detail pages.
- **API:** Use the REST API to programmatically extract data. All list endpoints support pagination and filtering for efficient data extraction.
- **Compliance Evidence:** Export compliance control evidence from **Compliance > Controls > Export**.
- For a full tenant data export (e.g., for migration), contact TechD support.

### 25. What happens to my data if my subscription ends?

**Resolution:**
- Upon subscription expiration, your tenant enters a 30-day grace period during which you retain full read-only access. No new scans, DSARs, or remediations can be initiated.
- During the grace period, you can export all data using the methods described in FAQ 24.
- After the grace period, the tenant is deactivated. Data is retained for an additional 60 days before permanent deletion.
- TechD can provide a full data export upon request during the retention period.
- To reactivate your subscription, contact your TechD account manager.

---

## Contacting Support

If your issue is not addressed in this FAQ:

| Channel | Details |
|---------|---------|
| **In-app AI Co-pilot** | Ask the AI Co-pilot for contextual help |
| **Support portal** | Submit a ticket at `https://support.techd.io` |
| **Email** | Send details to `support@techd.io` |
| **Emergency hotline** | For production-blocking issues, call your TechD Customer Success Manager |

### When Contacting Support, Include:

- Your tenant ID (found in **Settings > Tenant**)
- The specific error message or unexpected behavior
- Steps to reproduce the issue
- Screenshots or screen recordings if applicable
- The browser and version you are using
- The time the issue occurred (with timezone)

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
