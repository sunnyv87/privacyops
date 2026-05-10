# TechD PrivacyOps + DSPM -- DSAR User Guide

This guide covers the end-to-end workflow for managing Data Subject Access Requests (DSARs) in TechD PrivacyOps. It includes creating requests, verifying subject identity, discovering and reviewing data, handling redactions, managing legal holds, exporting response packages, generating response letters, and tracking SLAs.

---

## Table of Contents

1. [DSAR Overview](#dsar-overview)
2. [Request Types](#request-types)
3. [Creating a DSAR](#creating-a-dsar)
4. [Subject Identity Verification](#subject-identity-verification)
5. [Automated Data Discovery](#automated-data-discovery)
6. [Reviewing Discovery Results](#reviewing-discovery-results)
7. [PII Redaction](#pii-redaction)
8. [Legal Hold Interactions](#legal-hold-interactions)
9. [Export and Download](#export-and-download)
10. [Response Letter Generation](#response-letter-generation)
11. [SLA Tracking and Compliance](#sla-tracking-and-compliance)
12. [DSAR Lifecycle and Status Tracking](#dsar-lifecycle-and-status-tracking)
13. [Bulk DSAR Operations](#bulk-dsar-operations)

---

## DSAR Overview

A Data Subject Access Request (DSAR) is a formal request from an individual exercising their rights under privacy regulations such as GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, or PIPL. PrivacyOps automates the DSAR lifecycle from intake through response delivery, including subject data discovery across all connected data sources.

### Who Uses This Module

- **Privacy Officers and DPOs** -- Primary DSAR processors and approvers
- **Compliance Managers** -- SLA monitoring and reporting
- **Admins** -- Configuration of DSAR workflows and templates

---

## Request Types

PrivacyOps supports the following DSAR types, aligned with major privacy regulations:

| Request Type | Description | Applicable Regulations |
|-------------|-------------|----------------------|
| **Access** | Provide the data subject with a copy of their personal data | GDPR Art. 15, CCPA 1798.110, LGPD Art. 18 |
| **Rectification** | Correct inaccurate or incomplete personal data | GDPR Art. 16, LGPD Art. 18 |
| **Erasure** | Delete personal data ("Right to be Forgotten") | GDPR Art. 17, CCPA 1798.105, LGPD Art. 18 |
| **Portability** | Export personal data in a structured, machine-readable format | GDPR Art. 20, LGPD Art. 18 |
| **Restriction** | Restrict processing of personal data | GDPR Art. 18 |
| **Objection** | Object to specific processing activities | GDPR Art. 21 |
| **Do Not Sell** | Opt out of sale/sharing of personal information | CCPA 1798.120 |

---

## Creating a DSAR

DSARs can enter the system through three channels:

### Web Portal (Self-Service)

1. Navigate to **DSAR > Requests**.
2. Click **New Request**.
3. Fill in the request form:
   - **Subject Name** -- The data subject's full name
   - **Subject Email** -- Primary email address for correspondence
   - **Subject Phone** -- Optional phone number
   - **External ID** -- Optional identifier from your systems (customer ID, account number)
   - **Request Type** -- Select from the list above
   - **Regulation** -- The regulation under which the request is made
   - **Description** -- Free-text description of what the subject is requesting
   - **Supporting Documents** -- Upload any identity documents or correspondence
4. Click **Submit Request**. The request enters the verification queue.

### Email Intake

Forward DSAR emails to your configured DSAR inbox. The system parses the email to extract subject information and creates a draft request for review.

### API Submission

External portals and web forms can submit DSARs via the REST API endpoint `POST /api/v1/dsar`. See the [API Reference Guide](api-reference-guide.md) for details.

---

## Subject Identity Verification

Before processing a DSAR, you must verify the identity of the data subject to prevent unauthorized data disclosure.

### Verification Workflow

1. Navigate to the DSAR detail page.
2. Click the **Verify Identity** tab.
3. PrivacyOps runs fuzzy identity matching across connected data sources using weighted scoring:
   - Email match: highest weight
   - Phone number match: high weight
   - Name match (fuzzy): medium weight
   - External ID match: highest weight
4. Review the match results. The system displays:
   - Matched records across data sources with confidence scores
   - Potential false positives flagged for manual review
5. Choose a verification outcome:
   - **Verified** -- Identity confirmed, proceed to data discovery
   - **Additional Verification Required** -- Request further documentation from the subject
   - **Rejected** -- Identity cannot be confirmed; request is closed with a rejection reason

### Verification Methods

| Method | Description |
|--------|-------------|
| Document Upload | Subject provides government ID, utility bill, or other identity documents |
| Knowledge-Based | Subject answers questions based on account information |
| Email Verification | System sends a verification link to the subject's registered email |
| Third-Party | Integration with external identity verification services |

---

## Automated Data Discovery

Once identity is verified, PrivacyOps automatically searches for the subject's data across all connected sources.

### How It Works

1. The system generates search queries using the subject's identifying information (email, name, phone, external IDs).
2. Temporal workflows execute searches in parallel across all active connectors.
3. Each connector is queried based on its type:
   - **Databases** (PostgreSQL, MySQL, Snowflake, etc.) -- SQL queries against classified PII columns
   - **Cloud Storage** (S3, Azure Blob, GCS) -- File content search and metadata matching
   - **SaaS** (Salesforce, Okta) -- API-based record retrieval
   - **MongoDB** -- Document queries against classified fields
4. Results are aggregated into a unified view.

### Discovery Status

| Status | Meaning |
|--------|---------|
| Pending | Discovery not yet started |
| In Progress | Searches running across connectors |
| Partial | Some connectors completed, others still running |
| Complete | All connectors have returned results |
| Failed | One or more connectors encountered errors (review error details) |

### Reviewing Progress

Navigate to the **Data Discovery** tab on the DSAR detail page to monitor progress. Each connector shows its status, record count, and any errors.

---

## Reviewing Discovery Results

After discovery completes:

1. Navigate to the **Review** tab on the DSAR detail page.
2. The review interface displays discovered data organized by:
   - **Data Source** -- Which connector/database the data was found in
   - **Data Category** -- Classification label (email, name, phone, financial, health, etc.)
   - **Record Count** -- Number of records found per source
3. For each data source, you can:
   - **Preview** the discovered records (with PII redaction applied to third-party data)
   - **Include** or **Exclude** specific records from the response package
   - **Flag** records for additional review by the DPO
4. Add **reviewer notes** explaining inclusion/exclusion decisions.

### Data Categories in Results

| Category | Examples |
|----------|---------|
| Identity Data | Name, email, phone, address, date of birth |
| Financial Data | Payment history, account balances, transaction records |
| Activity Data | Login history, usage logs, support tickets |
| Consent Records | Consent history, preference changes, withdrawal records |
| Communications | Email correspondence, chat transcripts, support interactions |
| Health Data | Medical records (HIPAA-scoped connectors only) |

---

## PII Redaction

PrivacyOps automatically redacts third-party personal data from DSAR response packages to prevent unauthorized disclosure of other individuals' information.

### How Redaction Works

1. The Redaction Engine scans all discovered data before it is included in the response package.
2. It detects 12 PII pattern types: names, emails, phone numbers, addresses, SSNs, credit card numbers, dates of birth, IP addresses, passport numbers, driver's license numbers, bank account numbers, and health identifiers.
3. Third-party PII (data belonging to individuals other than the requesting subject) is automatically masked with placeholder tokens (e.g., `[REDACTED-EMAIL]`, `[REDACTED-NAME]`).
4. The requesting subject's own data is preserved unredacted.

### Manual Redaction Review

1. Navigate to the **Redaction Review** tab.
2. Review auto-redacted items. For each redaction:
   - **Confirm** -- Accept the redaction
   - **Override** -- Remove the redaction (with justification, e.g., data belongs to the subject)
   - **Add Redaction** -- Manually redact additional content not caught by automation
3. All redaction decisions are logged in the audit trail.

---

## Legal Hold Interactions

When a DSAR involves data that is subject to a legal hold, special handling is required.

### Legal Hold Detection

1. During data discovery, the system checks each discovered record against active legal hold orders.
2. Records under legal hold are flagged with a **Legal Hold** indicator on the review screen.
3. The DSAR processor is notified that legal hold data is involved.

### Handling Legal Hold Data

| Request Type | Legal Hold Impact |
|-------------|------------------|
| Access | Data can be included in the response package (legal hold does not prevent disclosure to the subject) |
| Erasure | Data **cannot** be deleted while under legal hold. The system blocks erasure and notifies the processor with the reason. |
| Rectification | Corrections are applied but original data is preserved under hold |
| Portability | Data can be exported |

### Escalation

If a legal hold conflicts with a DSAR obligation:

1. The system automatically escalates to the DPO.
2. The DPO reviews the conflict and decides on a resolution.
3. The resolution and rationale are documented in the DSAR record.

---

## Export and Download

After review and redaction are complete:

### Generating the Response Package

1. Navigate to the **Export** tab on the DSAR detail page.
2. Select the export format:
   - **PDF** -- Formatted report with data tables and classification labels
   - **CSV** -- Tabular data export for portability requests
   - **JSON** -- Machine-readable format for portability requests
   - **ZIP** -- Combined package with all formats and supporting documents
3. Click **Generate Package**. The system compiles all included data, applies redactions, and creates the downloadable file.
4. Click **Download** to retrieve the package, or send it directly to the data subject via the response workflow.

### Package Contents

- Cover page with request details and processing summary
- Data inventory listing all sources where subject data was found
- Data tables organized by source and category
- Redaction summary listing all redactions applied
- Processing timeline with key dates

---

## Response Letter Generation

PrivacyOps generates regulation-compliant response letters for each DSAR.

### Generating a Response Letter

1. Navigate to the **Response** tab on the DSAR detail page.
2. Click **Generate Response Letter**.
3. The system creates a letter based on:
   - The request type and applicable regulation
   - Your organization's name and DPO contact information
   - The processing outcome (fulfilled, partially fulfilled, denied)
   - Applicable regulatory citations
4. Review and edit the generated letter.
5. Attach the response package (if applicable).
6. Choose the delivery method:
   - **Email** -- Send directly to the subject's email address
   - **Portal** -- Make available for download in the self-service portal
   - **Manual** -- Download the letter for offline delivery (postal mail, hand delivery)
7. Click **Send Response**. The DSAR is marked as responded.

### Response Templates

Admins can customize response letter templates in **Settings > DSAR > Templates** for each request type and regulation.

---

## SLA Tracking and Compliance

PrivacyOps tracks SLA deadlines based on the applicable regulation.

### Default SLA Timelines

| Regulation | Standard Deadline | Extension Allowed |
|-----------|-------------------|-------------------|
| GDPR | 30 calendar days | Up to 60 additional days (with notification to subject) |
| CCPA/CPRA | 45 calendar days | Up to 45 additional days (with notification) |
| HIPAA | 30 calendar days | Up to 30 additional days |
| LGPD | 15 business days | No standard extension |
| POPIA | 30 calendar days | Reasonable extension with justification |
| PIPL | 30 calendar days | Extension with notification |

### SLA Dashboard

Navigate to **DSAR > Dashboard** to view:

- Total open requests and their SLA status
- Requests approaching deadline (warning at 50%, 75%, 90% of SLA)
- Overdue requests highlighted in red
- Average processing time by request type
- Completion rate and trends over time

### SLA Notifications

Automated notifications are sent at configurable thresholds:

- **50% of SLA elapsed** -- Informational reminder to the assigned processor
- **75% of SLA elapsed** -- Warning to the processor and their manager
- **90% of SLA elapsed** -- Urgent alert to the processor, manager, and DPO
- **SLA breached** -- Escalation to Admin and DPO with overdue flag

---

## DSAR Lifecycle and Status Tracking

Each DSAR moves through a defined lifecycle:

| Status | Description |
|--------|-------------|
| **Submitted** | Request received and awaiting verification |
| **Verification Pending** | Identity verification in progress |
| **Verified** | Identity confirmed, awaiting data discovery |
| **Discovery In Progress** | Automated data search running across connectors |
| **Review** | Discovered data ready for review and redaction |
| **Pending Approval** | Response package awaiting DPO or manager approval |
| **Approved** | Response approved, ready for delivery |
| **Responded** | Response delivered to the data subject |
| **Closed** | Request fully resolved and archived |
| **Rejected** | Request denied (identity not verified, exemption applies) |
| **On Hold** | Request paused due to legal hold or pending clarification |

### Assigning and Transferring Requests

- Click **Assign** on a DSAR to assign it to a specific Privacy Officer or team member.
- Click **Transfer** to reassign to a different processor (e.g., for vacation coverage).
- Assignment history is maintained in the DSAR audit trail.

---

## Bulk DSAR Operations

For organizations receiving high volumes of DSARs:

1. Navigate to **DSAR > Requests**.
2. Use checkboxes to select multiple requests.
3. Available bulk actions:
   - **Bulk Assign** -- Assign selected requests to a processor
   - **Bulk Verify** -- Mark multiple requests as verified (after external verification)
   - **Bulk Export** -- Download a summary report of selected requests
   - **Bulk Close** -- Close completed requests in batch

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
