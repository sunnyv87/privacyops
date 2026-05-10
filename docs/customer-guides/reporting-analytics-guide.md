# TechD PrivacyOps + DSPM -- Reporting & Analytics Guide

This guide covers the reporting and analytics capabilities of TechD PrivacyOps, including real-time dashboards, compliance posture reports, DSAR metrics, scan coverage analysis, risk heatmaps, scheduled reports, export formats, and the custom report builder.

---

## Table of Contents

1. [Reporting Overview](#reporting-overview)
2. [Dashboard Overview](#dashboard-overview)
3. [Compliance Posture Reports](#compliance-posture-reports)
4. [DSAR Metrics and Reports](#dsar-metrics-and-reports)
5. [Scan Coverage Reports](#scan-coverage-reports)
6. [Risk Heatmaps](#risk-heatmaps)
7. [DSPM Findings Reports](#dspm-findings-reports)
8. [Remediation Reports](#remediation-reports)
9. [Consent Analytics](#consent-analytics)
10. [Scheduled Reports](#scheduled-reports)
11. [Export Formats](#export-formats)
12. [Custom Report Builder](#custom-report-builder)

---

## Reporting Overview

TechD PrivacyOps provides real-time dashboards and configurable reports across all platform modules. Dashboards update in real time via WebSocket connections, and reports can be generated on demand or scheduled for automatic delivery.

### Accessing Reports

- **Dashboards:** Navigate to the module-specific dashboard (e.g., DSPM Dashboard, DSAR Dashboard)
- **Reports:** Navigate to **Reports** in the sidebar for the central reporting hub
- **Quick Export:** Most data tables throughout the platform include an **Export** button for ad hoc downloads

### Role-Based Views

Dashboards and reports respect RBAC permissions. Each role sees data relevant to their responsibilities:

| Role | Default Dashboard View |
|------|----------------------|
| Admin | Full platform overview with all modules |
| DPO / Privacy Officer | Compliance scores, DSAR status, consent metrics |
| Security Analyst | DSPM findings, remediation progress, incident status |
| Compliance Manager | Regulatory compliance gaps, risk assessments, vendor risk |
| Viewer | Read-only version of the Admin dashboard |

---

## Dashboard Overview

The main dashboard provides an at-a-glance view of your privacy and security posture.

### Dashboard Widgets

| Widget | Description | Update Frequency |
|--------|-------------|-----------------|
| **Compliance Score** | Aggregate compliance percentage across all active regulations | Real-time |
| **Open Findings by Severity** | Bar chart of unresolved DSPM findings: Critical, High, Medium, Low | Real-time |
| **Active DSARs** | Count of open DSARs with SLA countdown indicators | Real-time |
| **Recent Incidents** | Timeline of the latest 10 breach/incident reports | Real-time |
| **Data Asset Summary** | Total discovered assets, classified vs. unclassified | Updated after each scan |
| **Risk Heatmap** | Visual risk distribution by data category and regulation | Daily recalculation |
| **Remediation Velocity** | Trend chart showing remediation completion rate over time | Daily |
| **Consent Overview** | Active consents, recent withdrawals, pending verifications | Real-time |

### Customizing the Dashboard

1. Click the **Customize** button in the top-right corner of the dashboard.
2. Add, remove, or rearrange widgets using drag-and-drop.
3. Configure widget-specific settings (date range, data source filter, severity filter).
4. Click **Save Layout**. Your layout is saved per user and persists across sessions.

### Date Range Selector

All dashboard widgets and reports support a global date range selector:

- **Today** / **Last 7 Days** / **Last 30 Days** / **Last 90 Days** / **Last 12 Months**
- **Custom Range** -- Select specific start and end dates
- The selected range applies to all widgets on the dashboard

---

## Compliance Posture Reports

Navigate to **Reports > Compliance** or **Compliance > Dashboard**.

### Compliance Score Breakdown

The compliance posture report provides:

- **Overall Score** -- Weighted average across all active regulations (0-100%)
- **Per-Regulation Score** -- Individual scores for GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, PIPL
- **Control Coverage** -- Percentage of regulatory obligations mapped to organizational controls
- **Gap Summary** -- Number of unaddressed obligations per regulation

### Compliance Trend Analysis

- Line chart showing compliance score trajectory over time (weekly, monthly, quarterly)
- Identify improvement trends or regression after system changes
- Compare scores across regulations side-by-side

### Obligation Detail Report

For each regulation, drill down into:

- Article/section reference
- Obligation description
- Mapped control and its status (Implemented, Partially Implemented, Not Implemented)
- Evidence status (attached, pending, missing)
- Risk level for unaddressed obligations

---

## DSAR Metrics and Reports

Navigate to **Reports > DSAR** or **DSAR > Dashboard**.

### Key DSAR Metrics

| Metric | Description |
|--------|-------------|
| **Total Requests** | Count of DSARs received in the selected period |
| **By Type** | Breakdown by request type (Access, Erasure, Portability, etc.) |
| **By Status** | Distribution across lifecycle stages (Submitted, In Progress, Responded, Closed) |
| **SLA Compliance Rate** | Percentage of DSARs completed within the regulatory deadline |
| **Average Processing Time** | Mean time from request submission to response delivery |
| **Overdue Requests** | Count of DSARs that have exceeded their SLA deadline |
| **By Regulation** | Request volume grouped by the applicable regulation |

### DSAR Trend Charts

- Volume trend: requests received per week/month over time
- SLA compliance trend: percentage of on-time completions
- Processing time distribution: histogram of completion times

### SLA Aging Report

Lists all open DSARs sorted by SLA urgency:

- Days remaining until deadline
- Current processing stage
- Assigned processor
- Bottleneck identification (which stage is consuming the most time)

---

## Scan Coverage Reports

Navigate to **Reports > Scan Coverage** or **Discovery > Dashboard**.

### Coverage Metrics

| Metric | Description |
|--------|-------------|
| **Total Connectors** | Number of configured data source connections |
| **Active Connectors** | Connectors with healthy status |
| **Last Scan Date** | Most recent scan completion per connector |
| **Scan Frequency** | Configured schedule for each connector |
| **Asset Coverage** | Percentage of known data assets that have been scanned |
| **Classification Coverage** | Percentage of discovered assets with classification labels applied |

### Coverage Gap Analysis

Identifies areas where scanning may be insufficient:

- Connectors not scanned in the last 30 days
- Data sources with no scheduled scans
- Schemas or tables excluded from scan scope
- New assets discovered but not yet classified

### Scan Performance Report

- Average scan duration by connector type
- Scan failure rate and common error categories
- Data volume scanned (rows, objects, bytes) per scan cycle

---

## Risk Heatmaps

Navigate to **Reports > Risk** or the dashboard Risk Heatmap widget.

### Heatmap Dimensions

The risk heatmap visualizes risk distribution across two configurable axes:

| Axis Option | Values |
|------------|--------|
| **Data Category** | Identity, Financial, Health, Credentials, Activity, Communications |
| **Regulation** | GDPR, CCPA/CPRA, HIPAA, LGPD, POPIA, PIPL |
| **Data Source** | Individual connectors or connector types |
| **Finding Severity** | Critical, High, Medium, Low |
| **Department** | Organizational units (if configured) |

### Reading the Heatmap

- **Color intensity** corresponds to risk level: green (low) through yellow (medium) to red (critical)
- Click any cell to drill down into the specific findings driving the risk score
- Hover over a cell to see the finding count and average severity

### Risk Trend Report

- Track risk scores over time by category, regulation, or data source
- Identify whether remediation efforts are reducing overall risk
- Compare risk levels before and after major remediation campaigns

---

## DSPM Findings Reports

Navigate to **Reports > DSPM Findings**.

### Findings Summary Report

- Total findings by severity (Critical, High, Medium, Low)
- Findings by category (Access Control, Encryption, Exposure, Configuration)
- Findings by connector type
- New findings vs. resolved findings over time
- Mean Time to Remediate (MTTR) by severity

### Findings Detail Report

Exportable table of all findings with columns:

- Finding ID, title, severity, category
- Affected data source and asset
- Detection date, resolution date (if resolved)
- Current status and assigned owner
- Remediation action type and execution mode

---

## Remediation Reports

Navigate to **Reports > Remediation**.

### Remediation Metrics

| Metric | Description |
|--------|-------------|
| **Total Actions** | Count of remediation actions taken in the period |
| **By Action Type** | Breakdown across the 12 action types |
| **By Execution Mode** | Distribution of native, catalog_update, and manual actions |
| **Success Rate** | Percentage of actions completed successfully |
| **MTTR** | Mean Time to Remediate from finding detection to resolution |
| **Pending Approvals** | Count of actions awaiting approval |

### Remediation Velocity Chart

- Line chart showing remediation completions per week/month
- Separate lines for each severity level
- Goal line overlay showing your target remediation rate

---

## Consent Analytics

Navigate to **Reports > Consent** or **Consent > Dashboard**.

### Consent Metrics

| Metric | Description |
|--------|-------------|
| **Active Consents** | Total consent records with status "Given" |
| **Withdrawals** | Consent withdrawals in the selected period |
| **By Purpose** | Consent distribution across processing purposes |
| **Opt-in Rate** | Percentage of subjects who provided consent (by purpose) |
| **Withdrawal Rate** | Percentage of subjects who withdrew consent (by purpose) |
| **Consent Source** | Breakdown by collection channel (web form, API, manual) |

### Consent Trend Charts

- Consent volume over time (new consents vs. withdrawals)
- Opt-in rate trends by purpose
- Geographic distribution of consent records (if location data is captured)

---

## Scheduled Reports

Automate report generation and delivery on a recurring schedule.

### Creating a Scheduled Report

1. Navigate to **Reports > Scheduled**.
2. Click **New Scheduled Report**.
3. Configure:
   - **Report Type** -- Select from any of the report types described above
   - **Filters** -- Apply the same filters available in the on-demand report
   - **Frequency** -- Daily, Weekly (select day), Monthly (select date), Quarterly
   - **Delivery Time** -- Time of day (in your tenant timezone)
   - **Format** -- PDF, CSV, XLSX, or JSON
   - **Recipients** -- Email addresses of report recipients (must be platform users)
4. Click **Save Schedule**.

### Managing Scheduled Reports

- View all scheduled reports and their next run time
- Edit schedule, filters, or recipients
- Pause or delete a scheduled report
- View the history of past deliveries and download previous reports

---

## Export Formats

All reports support the following export formats:

| Format | Best For | Details |
|--------|----------|---------|
| **PDF** | Executive summaries, board presentations, regulatory submissions | Formatted with charts, tables, headers, and your organization's branding |
| **CSV** | Data analysis, spreadsheet import, further processing | Raw tabular data with headers |
| **XLSX** | Excel-based analysis, pivot tables, sharing with non-technical stakeholders | Formatted Excel workbook with multiple sheets for different report sections |
| **JSON** | API integration, programmatic consumption, data pipeline import | Structured JSON with consistent schema |

### Exporting a Report

1. Generate or navigate to any report.
2. Click **Export** in the top-right corner.
3. Select the desired format.
4. The file downloads to your browser. For large reports, a download link is emailed to you.

---

## Custom Report Builder

For reports not covered by the pre-built templates, use the Custom Report Builder.

### Building a Custom Report

1. Navigate to **Reports > Custom**.
2. Click **New Report**.
3. **Select Data Sources** -- Choose which modules to pull data from:
   - DSPM Findings
   - DSAR Requests
   - Consent Records
   - Scan Results
   - Compliance Controls
   - Remediation Actions
   - Incidents
   - Vendor Risk Assessments
4. **Define Columns** -- Select the fields to include in the report.
5. **Apply Filters** -- Set conditions to narrow the data (e.g., severity = Critical, date range, connector type).
6. **Configure Grouping** -- Group rows by a field (e.g., group findings by connector, group DSARs by regulation).
7. **Add Aggregations** -- Apply count, sum, average, min, or max to numeric fields.
8. **Add Visualizations** -- Optionally add charts (bar, line, pie, heatmap) to the report.
9. **Preview** -- Click **Preview** to see the report with live data.
10. **Save** -- Name the report and save it. Saved reports appear in your report library.

### Sharing Custom Reports

- Share a custom report with other users in your tenant by clicking **Share** and selecting recipients.
- Shared reports appear in the recipient's report library.
- Recipients can view and export but not edit your custom report. They can clone it to create their own version.

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
