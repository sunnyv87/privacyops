# TechD PrivacyOps Platform — Executive Summary

## What This Is

TechD PrivacyOps is a modular, multi-tenant, AI-augmented enterprise SaaS platform combining **Data Security Posture Management (DSPM)**, **Privacy Operations**, and **Data Governance** into a single operational console. Built India-first, designed for global compliance.

## Market Position

Competes with: Securiti.ai, BigID, OneTrust, Sentra, Wiz DSPM, Laminar, Forcepoint DSPM.

Differentiators:
- **India-first**: Native DPDP Act support, CERT-In readiness, India data residency
- **Unified platform**: DSPM + PrivacyOps + Governance in one product (most competitors are point solutions)
- **AI-augmented, not AI-dependent**: LLM assistance with mandatory human-in-the-loop for sensitive decisions
- **Modular licensing**: Customers buy what they need, modules share a common data fabric
- **Deployment flexibility**: SaaS or customer-managed (on-prem/VPC)

## Platform Modules (18)

| # | Module | Category |
|---|--------|----------|
| 1 | DSPM | Data Security |
| 2 | Data Discovery | Data Intelligence |
| 3 | Data Classification | Data Intelligence |
| 4 | Consent Management | Privacy Ops |
| 5 | Data Subject Rights (DSAR) | Privacy Ops |
| 6 | Privacy Risk / DPIA | Risk |
| 7 | Data Breach Monitoring | Incident Response |
| 8 | Data Governance & Retention | Governance |
| 9 | Third-Party Risk Management | Risk |
| 10 | Compliance Automation | Compliance |
| 11 | AI Compliance Engine | AI Governance |
| 12 | Policy & Control Management | Governance |
| 13 | RoPA | Compliance |
| 14 | Cross-border Transfer Governance | Compliance |
| 15 | Privacy-by-Design Workflow | Engineering |
| 16 | Incident & Regulatory Response | Incident Response |
| 17 | Privacy Intelligence Dashboard | Analytics |
| 18 | Evidence Repository & Audit Readiness | Audit |

## Target Users

CISOs, DPOs, Compliance Managers, Legal Counsel, Security Analysts, Data Stewards, Business Unit Owners, Auditors, SOC Analysts, Vendor Risk Reviewers.

## Technical Stack (Summary)

- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand
- **Backend**: NestJS (TypeScript), modular monolith evolving to microservices
- **Database**: PostgreSQL (primary), Redis (cache/queues), OpenSearch (search/analytics)
- **Workflow**: Temporal
- **Events**: NATS JetStream
- **Infra**: Kubernetes, Docker, Terraform, Helm, GitHub Actions
- **AI**: Claude API (primary), with abstraction for model routing
- **Auth**: OIDC/SAML via Keycloak, SCIM provisioning

## Build Phases

- **Phase 1 (90 days)**: Core platform, DSPM, Discovery, Classification, Dashboard, RBAC
- **Phase 2 (90 days)**: Consent, DSAR, DPIA, Breach, Retention, RoPA, Compliance Engine
- **Phase 3 (ongoing)**: TPRM, AI Compliance, Cross-border, Privacy-by-Design, advanced AI features

## Team Required (Phase 1)

- 2 Senior Backend Engineers
- 2 Senior Frontend Engineers
- 1 Platform/Infra Engineer
- 1 Security Engineer
- 1 Product Manager
- 1 Designer
- 1 QA Engineer
- Part-time: Privacy/Legal SME
