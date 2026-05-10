# TechD PrivacyOps + DSPM -- Getting Started Guide

Welcome to TechD PrivacyOps, the unified platform for privacy operations and data security posture management. This guide walks you through your first session: logging in, configuring your tenant, connecting your first data source, running your first scan, and understanding your dashboard.

---

## Prerequisites

Before you begin, confirm the following with your TechD account team:

- Your tenant has been provisioned and you have received a welcome email
- You have the URL for your PrivacyOps instance (e.g., `https://yourcompany.privacyops.techd.io`)
- You have credentials for at least one data source you intend to connect (database host, credentials, or cloud IAM role)
- Your browser is a current version of Chrome, Firefox, Edge, or Safari

---

## Step 1: First Login

1. Open your browser and navigate to your PrivacyOps instance URL.
2. Enter the email address and temporary password from your welcome email.
3. You will be prompted to set a permanent password. Passwords must be at least 12 characters and include uppercase, lowercase, numeric, and special characters.
4. If your organization requires multi-factor authentication (MFA), you will be prompted to enroll an authenticator app (Google Authenticator, Authy, Microsoft Authenticator). Scan the QR code and enter the six-digit verification code.
5. After successful authentication, you land on the **Dashboard**.

> **Tip:** Save the recovery codes displayed during MFA enrollment in a secure location. These are single-use codes for account recovery if you lose your authenticator device.

---

## Step 2: Understand Key Concepts

Before configuring the platform, familiarize yourself with these core concepts:

| Concept | Description |
|---------|-------------|
| **Tenant** | Your isolated organizational workspace. All data, users, and configurations are scoped to your tenant. Other tenants cannot see your data. |
| **Connector** | A configured connection to an external data source (database, cloud storage, SaaS application). PrivacyOps supports 43 connector types. |
| **Scan** | An automated discovery process that inventories data assets (schemas, tables, columns, files) within a connected data source. |
| **Classification** | Labels applied to discovered data elements identifying their sensitivity (e.g., Email Address, SSN, Credit Card Number). |
| **Finding** | A security or privacy issue detected by DSPM scanning -- for example, unencrypted PII or overly permissive access controls. |
| **Remediation** | A corrective action to resolve a finding. Actions can be native (automated), catalog_update (metadata-only), or manual (guidance-based). |
| **DSAR** | Data Subject Access Request -- a formal request from an individual to access, correct, delete, or port their personal data. |
| **Consent Record** | A documented record of an individual's consent (or withdrawal) for a specific processing purpose. |
| **RBAC** | Role-Based Access Control. Users are assigned roles (Admin, Privacy Officer, DPO, Security Analyst, Compliance Manager, Viewer) that determine what they can see and do. |

---

## Step 3: Configure Your Tenant

Navigate to **Settings > Tenant** to complete your organization profile.

1. **Organization Name** -- Enter your company's legal name.
2. **Domain** -- Your primary email domain (e.g., `yourcompany.com`). This is used for user invitation validation.
3. **Data Residency Region** -- Select the geographic region where your PrivacyOps data is stored (US, EU, APAC). This cannot be changed after initial setup.
4. **Timezone** -- Set the timezone used for SLA calculations, report timestamps, and scheduled scan windows.
5. **Regulatory Framework** -- Select the regulations that apply to your organization: GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, PIPL. You can select multiple. This drives compliance scoring and DSAR SLA defaults.
6. Click **Save Configuration**.

---

## Step 4: Invite Your Team

Navigate to **Settings > Users** and invite key stakeholders:

1. Click **Invite User**.
2. Enter the user's email address.
3. Assign a role:
   - **Admin** -- Full tenant administration and configuration
   - **Privacy Officer / DPO** -- DSAR management, consent, compliance, classification review
   - **Security Analyst** -- DSPM findings, remediation, incident management
   - **Compliance Manager** -- Regulatory mapping, risk assessments, ROPA
   - **Viewer** -- Read-only access across all modules
4. Click **Send Invitation**. The user receives an email with a link to set their password.

> **Best Practice:** Assign the DPO role to your Data Protection Officer immediately. Many compliance workflows require DPO approval.

---

## Step 5: Add Your First Connector

Navigate to **Discovery > Connectors** and click **Add Connector**.

1. Select a connector type from the catalog. Common starting points:
   - **PostgreSQL** or **MySQL** for relational databases
   - **AWS S3** for cloud object storage
   - **Snowflake** for data warehouses
   - **Salesforce** for CRM data
2. Enter connection details:
   - For databases: host, port, database name, username, and password
   - For cloud storage: region, bucket/container name, and IAM credentials or service account key
   - For SaaS: OAuth authorization or API key
3. Click **Test Connection** to verify connectivity. A green checkmark confirms success. If the test fails, check credentials, network access (firewall/VPN), and TLS requirements.
4. Configure scan scope:
   - Select specific schemas, tables, or buckets to include or exclude
   - Set sampling rate for large data sources (10%, 25%, 50%, 100%)
5. Click **Save Connector**.

> **Security Note:** All credentials are encrypted at rest using envelope encryption. Database connections enforce TLS verification.

---

## Step 6: Run Your First Scan

After saving a connector:

1. Click **Run Scan** on the connector detail page, or navigate to **Discovery > Connectors**, select the connector, and click **Run Scan**.
2. The scan begins and its progress is displayed in real time. Scans discover:
   - Schemas and databases
   - Tables and columns (for structured sources)
   - Files and object metadata (for storage sources)
   - Data types and sample values (for classification)
3. Scan duration depends on the size of the data source. A typical scan of a 500-table database completes in 5-15 minutes.
4. When the scan completes, navigate to **Discovery > Assets** to view the discovered inventory.

### Schedule Recurring Scans

For continuous monitoring:

1. Open the connector's detail page.
2. Click **Schedule**.
3. Set the frequency: daily, weekly, or monthly.
4. Choose a preferred scan window (e.g., off-peak hours).
5. Save the schedule.

---

## Step 7: Review Classification Results

After the scan completes, PrivacyOps automatically classifies discovered data elements.

1. Navigate to **Classification > Reviews**.
2. Review auto-classified items. Each item shows:
   - The data asset (table.column or file path)
   - The proposed classification label (e.g., Email Address, SSN, Credit Card Number)
   - The confidence score
   - The detection method (regex pattern match, ML model, or keyword match)
3. For each item, you can:
   - **Confirm** the classification
   - **Change** to a different label
   - **Reject** if the classification is incorrect
4. Unclassified items can be manually labeled.

---

## Step 8: Explore the Dashboard

Navigate to **Dashboard** to see your privacy and security posture at a glance.

| Widget | What It Shows |
|--------|---------------|
| **Compliance Score** | Overall compliance percentage across your selected regulations |
| **Open Findings** | Count of unresolved DSPM findings grouped by severity (Critical, High, Medium, Low) |
| **Active DSARs** | Number of pending data subject requests with SLA countdown timers |
| **Recent Incidents** | Latest breach or incident reports and their current status |
| **Data Asset Summary** | Total discovered assets, classified vs. unclassified breakdown |
| **Risk Heatmap** | Visual risk distribution across data categories and regulations |

The dashboard updates in real time via WebSocket. Widgets are customizable per role -- the DPO view emphasizes compliance and DSAR metrics, while the Security Analyst view highlights DSPM findings and incidents.

---

## Step 9: Configure Notifications

Navigate to **Settings > Notifications** to stay informed:

1. **Email Notifications** -- Enable alerts for scan completions, new findings, DSAR assignments, SLA warnings, and incident reports.
2. **Webhook Integrations** -- Send alerts to Slack, Microsoft Teams, PagerDuty, or custom endpoints.
3. **Alert Thresholds** -- Configure severity thresholds (e.g., only notify on Critical and High findings).
4. **Digest Frequency** -- Choose real-time alerts, hourly digest, or daily summary.

---

## Step 10: Explore the AI Co-pilot

Navigate to **Co-Pilot** or click the chat widget in the bottom-right corner.

Ask natural language questions to quickly orient yourself:

- "What are my top risks?"
- "Which data sources have unencrypted PII?"
- "Show me open remediation actions"
- "Are we compliant with GDPR?"
- "Which assets lack classification?"

The AI Co-pilot analyzes your tenant's data in real time and returns actionable insights. All data sent to the AI model is pre-scrubbed by the Redaction Engine to protect sensitive information.

---

## What to Do Next

Now that your tenant is configured and your first scan is complete, explore these capabilities:

| Task | Where to Go | Supplemental Guide |
|------|-------------|---------------------|
| Connect additional data sources | Discovery > Connectors | [Connector Setup Guide](connector-setup-guide.md) |
| Configure advanced tenant settings | Settings | [Admin Configuration Guide](admin-configuration-guide.md) |
| Process a data subject request | DSAR > Requests | [DSAR User Guide](dsar-user-guide.md) |
| Remediate security findings | DSPM > Remediation | [Remediation User Guide](remediation-user-guide.md) |
| Build compliance reports | Reports | [Reporting & Analytics Guide](reporting-analytics-guide.md) |
| Integrate via API | API Documentation | [API Reference Guide](api-reference-guide.md) |
| Troubleshoot issues | -- | [FAQ & Troubleshooting](faq-troubleshooting.md) |

---

## Support

If you encounter issues during setup:

- **In-app help:** Use the AI Co-pilot for contextual guidance
- **Knowledge base:** Access the full documentation at your instance's `/docs` path
- **Support portal:** Submit a ticket at `https://support.techd.io`
- **Emergency:** For production-blocking issues, contact your TechD Customer Success Manager directly

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
