# Section 10 — UI/UX Architecture

## Route Map

```
/                                    → Redirect to /dashboard
/login                               → Login page
/setup                               → Tenant onboarding wizard

/dashboard                           → Role-based dashboard
/dashboard/executive                 → Executive summary

/dspm                                → DSPM overview
/dspm/data-map                       → Interactive data map
/dspm/findings                       → Findings list
/dspm/findings/:id                   → Finding detail

/discovery                           → Data catalog
/discovery/assets                    → Asset list
/discovery/assets/:id                → Asset detail (schema, classifications, risks)
/discovery/sources                   → Data source list
/discovery/sources/:id               → Data source detail
/discovery/sources/new               → Add data source wizard
/discovery/scans                     → Scan job history
/discovery/scans/:id                 → Scan detail

/classification                      → Classification overview
/classification/labels               → Label taxonomy management
/classification/policies             → Classification policies
/classification/review               → Review queue

/consent                             → Consent overview
/consent/notices                     → Notice list
/consent/notices/:id                 → Notice designer
/consent/notices/new                 → Create notice
/consent/records                     → Consent records
/consent/purposes                    → Purpose management
/consent/analytics                   → Consent analytics
/consent/preferences                 → Preference center config

/dsar                                → DSAR overview
/dsar/requests                       → Request list
/dsar/requests/:id                   → Request detail + workflow
/dsar/settings                       → DSAR portal settings

/risk                                → Risk overview
/risk/assessments                    → Assessment list
/risk/assessments/:id                → Assessment detail
/risk/assessments/new                → Create assessment
/risk/heatmap                        → Risk heatmap

/breach                              → Incident overview
/breach/incidents                    → Incident list
/breach/incidents/:id                → Incident detail + timeline
/breach/incidents/new                → Report incident

/retention                           → Retention overview
/retention/policies                  → Policy list
/retention/policies/new              → Create policy
/retention/holds                     → Legal holds
/retention/dispositions              → Disposition queue
/retention/certificates              → Deletion certificates

/vendors                             → Vendor overview
/vendors/list                        → Vendor list
/vendors/:id                         → Vendor detail
/vendors/new                         → Add vendor
/vendors/assessments                 → Assessment pipeline

/compliance                          → Compliance overview
/compliance/regulations              → Regulation browser
/compliance/controls                 → Control library
/compliance/gaps                     → Gap analysis
/compliance/scorecard                → Compliance scorecard
/compliance/evidence                 → Evidence repository

/ropa                                → RoPA list
/ropa/:id                            → RoPA entry detail
/ropa/new                            → Create RoPA entry
/ropa/export                         → Export

/ai-governance                       → AI system inventory (Phase 2)

/settings                            → Settings
/settings/profile                    → User profile
/settings/tenant                     → Tenant settings
/settings/users                      → User management
/settings/roles                      → Role management
/settings/integrations               → Integration settings
/settings/notifications              → Notification preferences
/settings/api-keys                   → API key management
/settings/webhooks                   → Webhook configuration
/settings/audit-log                  → Audit log viewer
```

## Navigation Structure

### Primary Sidebar
```
[Logo]
Dashboard
─────────────
DATA SECURITY
  Data Map & DSPM
  Data Sources
  Findings
─────────────
DATA INTELLIGENCE
  Data Catalog
  Classification
  Scans
─────────────
PRIVACY OPS
  Consent
  DSAR
  RoPA
  Breach & Incidents
─────────────
RISK & COMPLIANCE
  Risk Assessments
  Vendors
  Compliance
  Controls & Evidence
─────────────
GOVERNANCE
  Retention
  Policies
  AI Governance
─────────────
[Settings gear icon]
```

### Role-Based Menu Variations

| Menu Item | Super Admin | Tenant Admin | DPO | CISO | Compliance | Security Analyst | Data Steward | Auditor |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data Map & DSPM | ✓ | ✓ | ✓ | ✓ | R | ✓ | R | R |
| Data Sources | ✓ | ✓ | R | ✓ | R | ✓ | R | R |
| Findings | ✓ | ✓ | ✓ | ✓ | R | ✓ | R | R |
| Data Catalog | ✓ | ✓ | ✓ | ✓ | R | ✓ | ✓ | R |
| Classification | ✓ | ✓ | ✓ | ✓ | R | ✓ | ✓ | R |
| Consent | ✓ | ✓ | ✓ | | ✓ | | | R |
| DSAR | ✓ | ✓ | ✓ | | ✓ | | ✓ | R |
| RoPA | ✓ | ✓ | ✓ | | ✓ | | | R |
| Breach | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | R |
| Risk Assessments | ✓ | ✓ | ✓ | ✓ | ✓ | | | R |
| Vendors | ✓ | ✓ | ✓ | | ✓ | | | R |
| Compliance | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ |
| Retention | ✓ | ✓ | ✓ | | ✓ | | ✓ | R |
| Settings | ✓ | ✓ | Limited | Limited | Limited | Limited | Limited | |

R = Read-only access

## Dashboard Layouts

### Executive Dashboard
```
┌──────────────────────────────────────────────────────────────┐
│  Privacy Health Score: 72/100          [Last 30 days ▼]      │
├────────────────┬────────────────┬────────────────────────────┤
│ Risk Findings  │ DSAR SLA       │ Compliance Score           │
│ ●3 Critical    │ 94% on-time    │ DPDP: 78%                 │
│ ●8 High        │ 2 overdue      │ GDPR: 82%                 │
│ ●15 Medium     │                │ ISO 27701: 65%             │
├────────────────┴────────────────┴────────────────────────────┤
│ Risk Trend (line chart, 90 days)                             │
├─────────────────────────────────┬────────────────────────────┤
│ Data Exposure Summary           │ Active Incidents            │
│ [bar chart by category]         │ 1 breach in progress       │
│                                 │ 0 notifications pending    │
├─────────────────────────────────┴────────────────────────────┤
│ Top Risky Data Stores (table, top 5)                         │
└──────────────────────────────────────────────────────────────┘
```

### DPO Dashboard
```
┌──────────────────────────────────────────────────────────────┐
│  My Tasks: 12 pending    Overdue: 3         [This week ▼]    │
├────────────────┬────────────────┬────────────────────────────┤
│ DSAR Pipeline  │ Consent Stats  │ RoPA Status                │
│ 5 submitted    │ 12.4K active   │ 85% coverage               │
│ 3 in progress  │ 234 revoked    │ 3 pending review           │
│ 2 overdue      │ 98% rate       │                            │
├────────────────┴────────────────┴────────────────────────────┤
│ Upcoming Deadlines                                           │
│ [timeline view of DSARs, DPIAs, vendor reviews due]          │
├──────────────────────────────────────────────────────────────┤
│ Recent Activity Feed                                         │
└──────────────────────────────────────────────────────────────┘
```

## Reusable Component Inventory

### Layout Components
- `AppShell` — Main layout with sidebar, header, content area
- `Sidebar` — Collapsible navigation sidebar
- `PageHeader` — Page title, breadcrumbs, action buttons
- `PageContent` — Content area with optional sidebar
- `TabLayout` — Tabbed content sections

### Data Display
- `DataTable` — Sortable, filterable table with column visibility, bulk actions, export
- `DetailPanel` — Entity detail view with sections
- `StatCard` — Metric card with value, trend, icon
- `StatusBadge` — Color-coded status indicator
- `SeverityBadge` — Severity level indicator
- `Timeline` — Vertical timeline for entity history
- `ActivityFeed` — Recent activity list

### Charts
- `DonutChart` — Distribution visualization
- `BarChart` — Comparison charts
- `LineChart` — Trend charts
- `HeatmapChart` — Risk heatmap
- `TreeMap` — Hierarchical data visualization

### Forms
- `FormWizard` — Multi-step form with validation
- `FormSection` — Collapsible form section
- `SearchableSelect` — Dropdown with search
- `TagInput` — Multi-value tag input
- `DateRangePicker` — Date range selection
- `RichTextEditor` — For notice/policy content
- `FileUpload` — Drag-and-drop file upload with preview
- `JSONEditor` — For advanced config editing

### Workflow
- `WorkflowStepper` — Visual workflow step indicator
- `ApprovalPanel` — Approve/reject with comments
- `AssigneeSelector` — User assignment dropdown
- `SLAIndicator` — Countdown timer with color coding
- `ReviewQueue` — Queue of items needing review

### Navigation
- `Breadcrumbs` — Path breadcrumbs
- `CommandPalette` — Cmd+K search across all entities
- `FilterBar` — Multi-filter bar with saved filters
- `BulkActionBar` — Floating bar for bulk operations

### Feedback
- `EmptyState` — Illustrated empty state with CTA
- `LoadingSkeleton` — Content placeholder during load
- `ErrorState` — Error with retry action
- `Toast` — Notification toasts
- `ConfirmDialog` — Confirmation modal

## UX Patterns

### Empty States
Each module has a contextual empty state:
- **Data Sources**: "Connect your first data source to start discovering sensitive data" + [Add Data Source] button
- **Findings**: "No findings yet. Run your first scan to discover data risks" + [Launch Scan] button
- **DSAR**: "No requests received yet. Configure your intake portal to start receiving requests" + [Configure Portal] button

### Loading States
- Skeleton loaders for tables and cards
- Progress bars for long-running operations (scans)
- Optimistic updates for quick actions (status changes)

### Error States
- Inline form validation errors
- API error toasts with retry option
- Full-page error for route-level failures
- Graceful degradation for widget-level failures (show error in widget, rest of dashboard works)

### Accessibility
- WCAG 2.1 AA compliance target
- Keyboard navigation for all interactive elements
- Screen reader labels for all icons and charts
- Color-blind friendly palette (don't rely solely on color)
- Focus management for modals and dialogs
- Skip navigation links
- Reduced motion support
