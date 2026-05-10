# TechD PrivacyOps + DSPM -- Remediation User Guide

This guide explains how to understand DSPM findings, review remediation recommendations, execute corrective actions, track remediation progress, and manage approval workflows in TechD PrivacyOps.

---

## Table of Contents

1. [Remediation Overview](#remediation-overview)
2. [Understanding Findings](#understanding-findings)
3. [Viewing Remediation Recommendations](#viewing-remediation-recommendations)
4. [Remediation Action Types](#remediation-action-types)
5. [Execution Modes: Native, Catalog Update, and Manual](#execution-modes)
6. [Executing a Remediation Action](#executing-a-remediation-action)
7. [Approval Workflows](#approval-workflows)
8. [Tracking Remediation Status](#tracking-remediation-status)
9. [Bulk Remediation](#bulk-remediation)
10. [Remediation by Connector Type](#remediation-by-connector-type)
11. [Rollback and Undo](#rollback-and-undo)

---

## Remediation Overview

The Remediation Engine in TechD PrivacyOps identifies security and privacy findings across your connected data sources and provides actionable recommendations to resolve them. The engine supports 12 distinct action types and operates across 11 connector types, with execution modes that range from fully automated (native) to guidance-based (manual).

### Who Uses This Module

- **Security Analysts** -- Primary users who review findings and execute remediations
- **Admins** -- Configure approval workflows and remediation policies
- **DPOs and Privacy Officers** -- Approve remediations affecting personal data

---

## Understanding Findings

Findings are security or privacy issues detected by DSPM scanning. Each finding represents a specific risk in your data environment.

### Finding Attributes

| Attribute | Description |
|-----------|-------------|
| **Title** | Concise description of the issue |
| **Severity** | Critical, High, Medium, or Low |
| **Category** | Access Control, Encryption, Exposure, Configuration, Retention, Classification |
| **Data Source** | The connector and specific asset (database, table, bucket) affected |
| **Sensitivity** | Sensitivity level of the affected data (based on classification) |
| **Status** | Open, In Progress, Resolved, Accepted Risk, False Positive |
| **Detected On** | Date the finding was first identified |
| **Remediation** | Recommended corrective action |

### Finding Severity Levels

| Severity | Criteria | Example |
|----------|----------|---------|
| **Critical** | Immediate data exposure risk, PII accessible without authentication | Publicly accessible S3 bucket containing customer PII |
| **High** | Significant security gap, sensitive data at risk | Unencrypted database column containing SSNs |
| **Medium** | Security best practice violation, moderate risk | Overly permissive database user with write access to PII tables |
| **Low** | Minor configuration issue, minimal risk | Missing data classification label on a non-sensitive table |

### Navigating Findings

1. Navigate to **DSPM > Findings**.
2. Use filters to narrow the list:
   - Severity (Critical, High, Medium, Low)
   - Category (Access Control, Encryption, Exposure, etc.)
   - Data Source (specific connector or asset)
   - Status (Open, In Progress, Resolved, etc.)
   - Date range
3. Click a finding to view its detail page.

---

## Viewing Remediation Recommendations

Each finding includes a recommended remediation action.

### On the Finding Detail Page

1. The **Remediation** section shows:
   - **Recommended Action** -- The specific action type (e.g., `encrypt`, `revoke_access`, `enable_mfa`)
   - **Execution Mode** -- Whether the action can be executed automatically (native), updates metadata only (catalog_update), or requires manual intervention (manual)
   - **Impact Assessment** -- What the action will change and any potential side effects
   - **Affected Assets** -- List of databases, tables, columns, buckets, or objects impacted
   - **Prerequisites** -- Any requirements before the action can be executed (e.g., backup recommendation)
2. If AI Co-pilot is enabled, a **narrative explanation** describes the finding and recommendation in plain language.

---

## Remediation Action Types

PrivacyOps supports 12 remediation action types:

| Action Type | Description | Common Trigger |
|------------|-------------|----------------|
| `revoke_access` | Remove excessive or unauthorized access permissions | Overly permissive database roles, unauthorized user access |
| `encrypt` | Enable encryption on unencrypted data at rest or in transit | Unencrypted PII columns, unencrypted storage buckets |
| `enable_mfa` | Enforce multi-factor authentication on accounts | Service accounts or users accessing sensitive data without MFA |
| `apply_retention` | Apply data retention policies to age-out old data | Data retained beyond regulatory or policy requirements |
| `restrict_public` | Remove public access from data assets | Publicly accessible cloud storage or databases |
| `delete_data` | Delete data that should not be retained | Orphaned PII, data past retention deadline |
| `mask_data` | Apply data masking to sensitive fields | PII in non-production environments, sensitive data in logs |
| `quarantine` | Isolate data assets pending investigation | Suspected data breach, unauthorized data copies |
| `rotate_credentials` | Rotate access credentials (passwords, keys, tokens) | Stale credentials, credentials exposed in a breach |
| `restrict_sharing` | Limit data sharing to authorized recipients | Excessive data sharing with third parties |
| `disable_public_access` | Disable public endpoints on data stores | Cloud storage with public endpoints enabled |
| `enforce_encryption` | Enforce encryption policies at the configuration level | Storage accounts or databases with encryption disabled |

---

## Execution Modes

Each remediation action operates in one of three modes, determined by the connector type and action combination:

### Native Mode

- The action is executed **automatically** by PrivacyOps through the connector's API or management interface.
- No manual intervention required.
- Example: Revoking a PostgreSQL database user's access by executing `REVOKE` SQL commands.
- Confirmation and rollback information are recorded.

### Catalog Update Mode

- The action **updates metadata** in the PrivacyOps catalog (classification labels, risk scores, policy tags) but does not modify the underlying data source.
- A work order is generated with step-by-step instructions for your infrastructure team.
- Example: Flagging an unencrypted Salesforce field for encryption -- PrivacyOps updates the finding status and generates instructions, but Salesforce field encryption must be configured in Salesforce Setup.

### Manual Mode (Unsupported)

- The connector does not support automated execution for this action type.
- PrivacyOps provides **detailed guidance** with step-by-step instructions.
- The user must perform the action outside the platform and then mark it complete.
- Example: Enabling MFA on a MongoDB Atlas cluster -- PrivacyOps provides the configuration steps, but the user must apply them in the Atlas console.

### Capability Matrix Summary

The capability matrix defines which actions are supported for each connector in which mode. Navigate to **DSPM > Remediation > Capability Matrix** to view the full 11x12 matrix for your tenant.

| Connector | Native Actions | Catalog Update Actions | Manual Guidance |
|-----------|---------------|----------------------|-----------------|
| PostgreSQL | revoke_access, mask_data, delete_data | encrypt, apply_retention | enable_mfa, quarantine |
| AWS S3 | restrict_public, disable_public_access, enforce_encryption | apply_retention | rotate_credentials |
| Snowflake | revoke_access, mask_data | encrypt, apply_retention | enable_mfa |
| Salesforce | revoke_access, restrict_sharing | encrypt, mask_data | enable_mfa |
| MongoDB | revoke_access, delete_data | encrypt | enable_mfa, quarantine |
| Azure Blob | restrict_public, disable_public_access, enforce_encryption | apply_retention | rotate_credentials |

> **Note:** This is a representative subset. The full matrix covers all 11 connector types and 12 action types.

---

## Executing a Remediation Action

### For Native Actions

1. Navigate to the finding detail page.
2. Review the recommended action and impact assessment.
3. If an approval workflow is configured, click **Request Approval**. Otherwise, proceed to step 5.
4. Wait for approval (you are notified when approved).
5. Click **Execute Remediation**.
6. The system executes the action against the data source in real time.
7. A confirmation screen shows:
   - Actions taken (e.g., SQL commands executed, API calls made)
   - Success or failure status
   - Rollback instructions (if applicable)
8. The finding status updates to **Resolved**.

### For Catalog Update Actions

1. Navigate to the finding detail page.
2. Click **Apply Catalog Update**.
3. PrivacyOps updates internal metadata (finding status, risk score, policy tags).
4. A **work order** is generated with step-by-step instructions for your team.
5. Download or email the work order.
6. After your team completes the manual steps, return to the finding and click **Mark as Resolved**.

### For Manual Actions

1. Navigate to the finding detail page.
2. Review the **Manual Remediation Guide** section, which provides:
   - Step-by-step instructions specific to the connector type
   - Links to the vendor's documentation
   - Screenshots or configuration examples where applicable
3. Perform the remediation in the target system.
4. Return to the finding and click **Mark as Resolved**.
5. Optionally upload evidence (screenshot, configuration export) confirming the fix.

---

## Approval Workflows

Admins can configure approval requirements for remediation actions to prevent unauthorized changes to production systems.

### Configuring Approval Rules

Navigate to **Settings > Remediation > Approval Workflows**.

| Rule Setting | Options |
|-------------|---------|
| Require Approval For | All actions, Critical/High only, Native actions only, Specific action types |
| Approvers | DPO, Admin, specific users, or a designated approval group |
| Approval Timeout | Auto-escalate if not approved within N hours (default: 24 hours) |
| Auto-Approve | Optionally auto-approve Low severity findings for specific action types |

### Approval Process

1. The remediator clicks **Request Approval** on the finding.
2. Designated approvers receive a notification with the action details and impact assessment.
3. The approver reviews and clicks **Approve** or **Reject** (with reason).
4. On approval, the remediator is notified and can execute the action.
5. On rejection, the finding remains open with the rejection reason documented.

---

## Tracking Remediation Status

### Remediation Dashboard

Navigate to **DSPM > Remediation** for an overview:

- **Open Remediations** -- Count by severity and action type
- **In Progress** -- Actions awaiting approval or execution
- **Resolved This Period** -- Completed remediations in the current reporting period
- **Mean Time to Remediate (MTTR)** -- Average time from finding detection to resolution
- **Trend Charts** -- Remediation velocity over time

### Filtering and Searching

Filter remediations by:

- Status: Pending, Approved, Executing, Completed, Failed, Rejected
- Severity: Critical, High, Medium, Low
- Action type: Any of the 12 action types
- Connector: Specific data source
- Assignee: Specific user or team
- Date range: Detection date or resolution date

---

## Bulk Remediation

For efficiency when dealing with many similar findings:

1. Navigate to **DSPM > Findings**.
2. Apply filters to isolate similar findings (e.g., all "restrict_public" findings on AWS S3 connectors).
3. Select multiple findings using checkboxes.
4. Click **Bulk Remediate**.
5. Review the batch summary:
   - Number of findings selected
   - Action type to be applied
   - Affected connectors and assets
   - Execution mode for each (native, catalog_update, manual)
6. If approval is required, a single approval request covers the entire batch.
7. Click **Execute Batch** to run all native actions.
8. Monitor batch progress on the **Batch Remediation** tab.

### Batch Limitations

- Only findings with the same action type can be bulk-remediated together.
- Mixed execution modes are allowed -- native actions execute automatically, catalog updates are applied, and manual actions generate work orders.
- Maximum batch size: 100 findings per batch.

---

## Remediation by Connector Type

### Cloud Storage (AWS S3, Azure Blob, GCS)

Common findings and actions:

| Finding | Action | Mode |
|---------|--------|------|
| Public bucket/container | `restrict_public` | Native |
| Encryption disabled | `enforce_encryption` | Native |
| Public endpoint enabled | `disable_public_access` | Native |
| Data past retention | `apply_retention` | Catalog Update |
| Stale access keys | `rotate_credentials` | Manual |

### Relational Databases (PostgreSQL, MySQL, SQL Server)

| Finding | Action | Mode |
|---------|--------|------|
| Excessive user permissions | `revoke_access` | Native |
| Unmasked PII in dev/test | `mask_data` | Native |
| Orphaned personal data | `delete_data` | Native |
| Unencrypted PII columns | `encrypt` | Catalog Update |
| Missing retention policy | `apply_retention` | Catalog Update |

### Data Warehouses (Snowflake, BigQuery)

| Finding | Action | Mode |
|---------|--------|------|
| Overly permissive role grants | `revoke_access` | Native |
| Sensitive data without masking | `mask_data` | Native |
| Encryption configuration gap | `encrypt` | Catalog Update |

### SaaS (Salesforce, Okta)

| Finding | Action | Mode |
|---------|--------|------|
| Unauthorized API access | `revoke_access` | Native |
| Excessive sharing rules | `restrict_sharing` | Native |
| Field-level encryption gap | `encrypt` | Catalog Update |

---

## Rollback and Undo

For native remediation actions, PrivacyOps records the pre-action state to support rollback.

### Rolling Back an Action

1. Navigate to the resolved finding.
2. Click **View Execution Log** to see what was changed.
3. Click **Rollback** to revert the action.
4. Confirm the rollback. The system restores the previous state.
5. The finding reopens with a note indicating the rollback.

### Rollback Limitations

- Rollback is only available for native actions.
- `delete_data` actions cannot be rolled back (data deletion is permanent).
- Rollback must be performed within 30 days of the original action.
- Rollback requires the same or higher authorization as the original action.

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
