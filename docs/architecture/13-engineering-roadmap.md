# Section 13 — Engineering Roadmap

## Phase 1 — Foundation + DSPM (90 days)

### Weeks 1-2: Platform Foundation
- Monorepo setup (Turborepo)
- NestJS backend scaffold with module structure
- Next.js frontend scaffold with design system
- PostgreSQL schema + Prisma setup
- Authentication (Keycloak) integration
- Multi-tenancy middleware + RLS
- RBAC framework
- Audit logging service
- CI/CD pipeline (GitHub Actions)
- Docker Compose for local development
- Development environment documentation

### Weeks 3-5: Core DSPM
- Connector framework (IConnector interface)
- First 3 connectors: AWS S3, PostgreSQL, MySQL
- Discovery pipeline (asset enumeration, schema extraction)
- Content sampling engine
- Classification engine (regex + dictionary patterns)
- India-specific patterns (Aadhaar, PAN, GSTIN, mobile)
- Risk scoring engine
- Findings management (CRUD + status workflow)

### Weeks 6-7: Data Map & Dashboard
- Asset catalog UI
- Data source management UI
- Scan job management
- Interactive data map visualization
- Findings list with filters
- Finding detail view
- DSPM dashboard
- Executive dashboard (basic)

### Weeks 8-10: Additional Connectors + Classification
- Connectors: MongoDB, Azure Blob, GCP Storage, SQL Server
- Classification review queue
- Custom label management
- Classification policy builder
- OpenSearch integration (search across assets/findings)
- Notification engine (email + in-app)

### Weeks 11-12: Hardening + Beta
- Integration testing
- Security review
- Performance testing
- Documentation
- Demo tenant setup
- Beta deployment

### Phase 1 Deliverables
- Working multi-tenant platform with auth + RBAC
- 7+ data source connectors
- Automated data discovery + classification
- Risk scoring and findings management
- Interactive data map
- Executive and DSPM dashboards
- Audit logging
- API documentation

## Phase 2 — Privacy Operations (90 days)

### Weeks 1-3: Consent Management
- Consent notice designer
- Consent capture API + JS SDK
- Consent ledger
- Preference center widget
- Revocation workflow
- Consent analytics

### Weeks 4-6: DSAR + Breach
- DSAR intake portal
- Identity verification workflow
- DSAR routing and data collection
- Review and redaction interface
- Response package generation
- SLA tracking
- Incident intake and triage
- Breach qualification workflow
- Notification timeline tracker

### Weeks 7-9: Risk + Governance
- DPIA assessment templates + workflow (Temporal)
- Risk scoring and heatmap
- Retention policy engine
- Legal hold management
- Disposition workflow
- RoPA CRUD + approval workflow
- RoPA export

### Weeks 10-12: Compliance + Integration
- Regulation library (DPDP Act, GDPR preloaded)
- Control library
- Obligation → control mapping
- Gap analysis
- Compliance scorecard
- Evidence repository
- Webhook engine
- Additional connectors: Snowflake, BigQuery, Google Drive, OneDrive

## Phase 3 — Scale & Intelligence (Ongoing)

- SaaS connectors: Salesforce, Jira, GitHub, Slack, M365, SharePoint
- Third-Party Risk Management module
- AI Compliance Engine
- Cross-border transfer governance
- Privacy-by-Design workflow
- AI augmentation layer (classification suggestions, DPIA summaries, breach drafts)
- Advanced DSPM: lineage, toxic combinations, attack paths
- Custom report builder
- SCIM provisioning
- ABAC authorization
- Multi-region deployment
- Self-hosted (Helm chart) release
- SOC 2 Type II preparation

## Team Structure

### Phase 1 (10 people)
| Role | Count | Focus |
|---|---|---|
| Tech Lead / Architect | 1 | Architecture, code review, security |
| Senior Backend Engineer | 2 | NestJS services, connectors, scanning |
| Senior Frontend Engineer | 2 | Next.js, dashboard, data viz |
| Platform Engineer | 1 | Infra, CI/CD, Kubernetes, observability |
| Security Engineer | 1 | Auth, encryption, security review |
| Product Manager | 1 | Requirements, prioritization, customer |
| UI/UX Designer | 1 | Design system, screens, workflows |
| QA Engineer | 1 | Test automation, manual testing |
| Privacy/Legal SME | 0.5 | Part-time: regulatory mapping, DPDP Act |

### Phase 2 additions
- +1 Backend Engineer (privacy ops modules)
- +1 Frontend Engineer (consent, DSAR UIs)
- +1 QA Engineer

### Phase 3 additions
- +2 Backend Engineers (connectors, AI layer)
- +1 ML Engineer (classification models)
- +1 SRE (scaling, multi-region)
- +1 Technical Writer

## Major Risks

| Risk | Impact | Mitigation |
|---|---|---|
| DPDP Act rules not yet finalized | Medium | Design for flexibility, flag assumptions |
| Connector auth complexity | High | Invest in testing, use SDKs over raw APIs |
| Multi-tenancy bugs (cross-tenant leaks) | Critical | RLS, automated tenant isolation tests |
| Scope creep across 18 modules | High | Strict phase gating, MVP focus |
| Performance at scale | Medium | Load testing early, index optimization |
| AI hallucinations in compliance context | High | Mandatory HITL, confidence thresholds |

## What to Postpone

- Graph database for lineage (use JSONB relationships first)
- Custom ML classification models (use regex/dictionary first)
- Multi-region deployment (single region for Phase 1-2)
- Self-hosted release (SaaS-first)
- Advanced ABAC (RBAC is sufficient for Phase 1)
- Real-time streaming from connectors (batch scanning is fine)
- Mobile app (responsive web is sufficient)
