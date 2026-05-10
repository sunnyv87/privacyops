# TechD PrivacyOps + DSPM -- Admin Configuration Guide

This guide covers tenant administration, user management, role assignment, security settings, branding, SSO/SAML configuration, feature gates, and notification preferences. You need the **Admin** role to perform most actions described here.

---

## Table of Contents

1. [Tenant Settings](#tenant-settings)
2. [User Management](#user-management)
3. [Role Assignment and RBAC](#role-assignment-and-rbac)
4. [SSO and SAML Configuration](#sso-and-saml-configuration)
5. [SCIM User Provisioning](#scim-user-provisioning)
6. [Feature Gates](#feature-gates)
7. [Notification Preferences](#notification-preferences)
8. [Branding and Customization](#branding-and-customization)
9. [Security Policies](#security-policies)
10. [Audit Logging](#audit-logging)

---

## Tenant Settings

Navigate to **Settings > Tenant** to manage your organization's core configuration.

### Organization Profile

| Setting | Description | Editable After Setup |
|---------|-------------|---------------------|
| Organization Name | Your company's legal name displayed across the platform | Yes |
| Domain | Primary email domain for user invitation validation | Yes |
| Data Residency Region | Geographic region for data storage (US, EU, APAC) | No |
| Timezone | Default timezone for SLA calculations and timestamps | Yes |
| Regulatory Frameworks | Active regulations: GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, PIPL | Yes |
| Default Language | Interface language for new users | Yes |

### Data Retention Settings

Configure how long PrivacyOps retains operational data within the platform itself:

- **Scan History** -- Number of days to retain completed scan records (default: 365 days)
- **Audit Logs** -- Retention period for audit trail entries (default: 730 days, minimum: 365 days for compliance)
- **DSAR Archives** -- Retention for completed DSAR packages (configurable per regulation)
- **Incident Records** -- Breach and incident records (default: retained indefinitely)

---

## User Management

Navigate to **Settings > Users** to manage platform access.

### Inviting Users

1. Click **Invite User**.
2. Enter the user's email address. The domain must match your configured tenant domain or an approved external domain.
3. Select a role (see Role Assignment below).
4. Optionally assign the user to specific teams or departments.
5. Click **Send Invitation**. The invitation expires after 72 hours.

### Managing Existing Users

| Action | How To |
|--------|--------|
| View user details | Click the user's name in the user list |
| Change role | Click **Edit Role** on the user detail page |
| Deactivate user | Click **Deactivate** -- the user can no longer log in but their audit history is preserved |
| Reactivate user | Click **Reactivate** on a deactivated user |
| Reset password | Click **Send Password Reset** -- the user receives an email link |
| Force MFA enrollment | Enable **Require MFA** in Security Policies (applies tenant-wide) |
| Revoke sessions | Click **Revoke All Sessions** to force re-authentication |

### Bulk User Operations

For organizations with many users:

1. Click **Import Users** to upload a CSV file with columns: email, first_name, last_name, role.
2. The system validates email formats and domain restrictions before processing.
3. All imported users receive invitation emails.

---

## Role Assignment and RBAC

PrivacyOps uses role-based access control (RBAC) to enforce the principle of least privilege. Each user is assigned exactly one role.

### Available Roles

| Role | Description | Module Access |
|------|-------------|---------------|
| **Admin** | Full tenant administration | All modules, all settings, user management |
| **Privacy Officer** | Day-to-day privacy operations | Classification, Consent, DSAR, Compliance, ROPA, Reports |
| **DPO** | Data Protection Officer with approval authority | Everything Privacy Officer has, plus approval workflows, breach notification sign-off |
| **Security Analyst** | Security-focused operations | DSPM, Discovery, Remediation, Breach/Incident, Attack Paths |
| **Compliance Manager** | Regulatory and risk management | Compliance, Risk Assessments, ROPA, Vendor Management, Reports |
| **Viewer** | Read-only access for auditors and stakeholders | Read access across all modules, no create/edit/delete |

### Permission Boundaries

- Users can only see data within their own tenant (multi-tenant isolation).
- Admins cannot access the Super Admin panel or other tenants.
- Viewers cannot initiate scans, create DSARs, or execute remediations.
- DPO approval is required for breach notifications and certain DSAR escalations.

### Changing a User's Role

1. Navigate to **Settings > Users**.
2. Click the user whose role you want to change.
3. Click **Edit Role** and select the new role.
4. Click **Save**. The change takes effect on the user's next page load or API call.

---

## SSO and SAML Configuration

PrivacyOps supports SAML 2.0 single sign-on for enterprise identity providers.

### Supported Identity Providers

- Okta
- Azure Active Directory (Entra ID)
- Google Workspace
- OneLogin
- PingFederate
- Any SAML 2.0-compliant IdP

### SAML Setup Steps

1. Navigate to **Settings > Security > Single Sign-On**.
2. Click **Configure SAML**.
3. Enter the following from your IdP:
   - **IdP Entity ID** -- The unique identifier for your identity provider
   - **SSO Login URL** -- The URL where PrivacyOps sends SAML authentication requests
   - **IdP Certificate** -- The X.509 certificate used to verify SAML assertions (paste the PEM-encoded certificate)
4. Copy the following from PrivacyOps to your IdP configuration:
   - **SP Entity ID** -- `https://yourcompany.privacyops.techd.io/saml/metadata`
   - **ACS URL** -- `https://yourcompany.privacyops.techd.io/api/v1/auth/saml/callback`
   - **SLO URL** -- `https://yourcompany.privacyops.techd.io/api/v1/auth/saml/logout`
5. Configure attribute mapping in your IdP:
   - `email` (required) -- Maps to PrivacyOps user email
   - `firstName` (required) -- User's first name
   - `lastName` (required) -- User's last name
   - `role` (optional) -- Maps to a PrivacyOps role name for auto-assignment
6. Click **Test Connection** to validate the SAML flow with a test assertion.
7. Click **Enable SSO**.

### SSO Enforcement

After enabling SSO, you can optionally enforce it:

- **SSO Optional** -- Users can log in with email/password or SSO
- **SSO Required** -- All users must log in via SSO (password login disabled). At least one Admin must retain password access as a break-glass account.

---

## SCIM User Provisioning

Automate user lifecycle management with SCIM 2.0.

1. Navigate to **Settings > Security > SCIM Provisioning**.
2. Click **Generate SCIM Token**. Copy and store the bearer token securely -- it is shown only once.
3. In your IdP, configure PrivacyOps as a SCIM application:
   - **Base URL:** `https://yourcompany.privacyops.techd.io/api/v1/scim/v2`
   - **Authentication:** Bearer token
4. Map user attributes: `userName`, `emails`, `name.givenName`, `name.familyName`, `active`.
5. Map group assignments to PrivacyOps roles.
6. Enable provisioning. Users created/updated/deactivated in your IdP are automatically synced.

---

## Feature Gates

Feature gates allow Admins to enable or disable specific platform modules for their tenant.

Navigate to **Settings > Features** to manage feature availability.

| Feature Gate | Description | Default |
|-------------|-------------|---------|
| `dspm_scanning` | DSPM security posture scanning and findings | Enabled |
| `dsar_management` | Data Subject Access Request workflows | Enabled |
| `consent_management` | Consent tracking and preference center | Enabled |
| `remediation_engine` | Automated remediation actions | Enabled |
| `incident_management` | Breach and incident management | Enabled |
| `legal_hold` | Legal hold enforcement on DSAR data | Enabled |
| `vendor_risk` | Vendor risk management module | Enabled |
| `ai_copilot` | AI Co-pilot natural language interface | Enabled |
| `ai_llm_enrichment` | LLM-powered narratives and explanations | Disabled |
| `attack_path_analysis` | Advanced attack path detection | Disabled |
| `data_lineage` | Column-level data lineage tracking | Enabled |
| `custom_classification` | Tenant-defined classification labels | Enabled |

Disabled features are hidden from the navigation sidebar and inaccessible via API.

---

## Notification Preferences

Navigate to **Settings > Notifications** to configure how your team receives alerts.

### Notification Channels

| Channel | Configuration |
|---------|---------------|
| **Email** | Enabled per user. Each user can set email preferences in their profile. |
| **Webhook** | Tenant-wide. Configure endpoint URL, authentication headers, and payload format. |
| **Slack** | Add the PrivacyOps Slack app and select channels per alert category. |
| **Microsoft Teams** | Configure an incoming webhook URL in your Teams channel. |
| **PagerDuty** | Enter your PagerDuty integration key for critical alerts. |

### Alert Categories

| Category | Triggers |
|----------|----------|
| Scan Events | Scan started, completed, failed |
| DSPM Findings | New critical or high-severity findings |
| DSAR Lifecycle | New request, SLA warning (at 50%, 75%, 90% of deadline), overdue |
| Consent Changes | Bulk withdrawal events, consent sync failures |
| Incidents | New incident reported, severity escalation, breach notification due |
| Remediation | Remediation action failed, approval required |
| System | Connector health check failure, scheduled maintenance |

### Digest Options

- **Real-time** -- Immediate notification for each event
- **Hourly Digest** -- Aggregated summary every hour
- **Daily Summary** -- Single daily email at a configured time

---

## Branding and Customization

Navigate to **Settings > Branding** to customize the platform appearance for your organization.

| Setting | Description |
|---------|-------------|
| Logo | Upload your company logo (PNG or SVG, max 2 MB). Displayed in the sidebar and login page. |
| Favicon | Upload a custom favicon (ICO or PNG, 32x32 pixels). |
| Primary Color | Hex color code for buttons, links, and accents. |
| Login Page Message | Custom welcome message displayed on the login screen. |
| Support Contact | Custom support email and phone number displayed in the help menu. |
| Custom Domain | Configure a CNAME to serve PrivacyOps on your own subdomain (e.g., `privacy.yourcompany.com`). Contact TechD support to enable. |

---

## Security Policies

Navigate to **Settings > Security** to configure tenant-wide security policies.

### Password Policy

| Setting | Options | Default |
|---------|---------|---------|
| Minimum Length | 8-32 characters | 12 |
| Complexity Requirements | Uppercase, lowercase, numeric, special | All required |
| Password Expiration | 30, 60, 90, 180 days, or never | 90 days |
| Password History | Prevent reuse of last N passwords (1-24) | 12 |

### Session Policy

| Setting | Options | Default |
|---------|---------|---------|
| Session Timeout | 15 min to 24 hours | 60 minutes |
| Concurrent Sessions | 1-10 or unlimited | 5 |
| Idle Timeout | 5-60 minutes | 15 minutes |

### MFA Policy

- **Optional** -- Users can choose to enable MFA
- **Required for Admins** -- Only Admin role users must enable MFA
- **Required for All** -- Every user must enroll in MFA

### IP Allowlist

Restrict platform access to specific IP addresses or CIDR ranges:

1. Navigate to **Settings > Security > IP Allowlist**.
2. Add trusted IP ranges.
3. Enable enforcement. Users connecting from non-allowed IPs are denied access.

---

## Audit Logging

All administrative actions are recorded in an immutable audit log.

Navigate to **Settings > Audit Log** to review activity.

### Logged Events

- User login/logout (including failed attempts)
- Role changes and user invitations
- Connector creation, modification, and deletion
- Scan initiation and schedule changes
- DSAR creation and status changes
- Remediation action execution
- Settings changes (security, notifications, features)
- Data export and download events

### Filtering and Export

- Filter by date range, user, event type, or module
- Search by keyword
- Export audit logs in CSV or JSON format for external SIEM integration
- Logs are retained according to the configured Audit Log retention policy (minimum 365 days)

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
