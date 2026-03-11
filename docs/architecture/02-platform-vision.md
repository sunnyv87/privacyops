# Section 2 — Platform Vision

## Core Problem

Enterprises face fragmented tooling for data security, privacy compliance, and data governance. Indian enterprises additionally lack products built for DPDP Act compliance with India data residency.

## Solution

A single platform where:
1. **Data Discovery** finds all personal/sensitive data across cloud, SaaS, databases, endpoints
2. **Data Classification** labels data by sensitivity, regulatory category, business context
3. **DSPM** continuously monitors security posture of discovered data
4. **Privacy Ops** manages consent, DSAR, DPIA, breach, retention operationally
5. **Compliance Automation** maps controls to regulations and tracks evidence
6. **AI Augmentation** accelerates manual work with LLM-powered suggestions

## Architecture Philosophy

### Modular Monolith First
Start as a well-structured modular monolith (single deployable, internal module boundaries). Extract to microservices only when scale demands it. This avoids premature distributed systems complexity while maintaining clean boundaries.

### Shared Data Fabric
All modules share:
- **Asset Registry**: Single source of truth for all data sources and assets
- **Data Catalog**: Unified view of discovered datasets, tables, objects
- **Classification Engine**: Shared labeling and sensitivity scoring
- **Identity Graph**: Unified data subject identity across modules
- **Policy Engine**: Shared rule evaluation
- **Audit Trail**: Unified tamper-evident logging

### Event-Driven Integration
Modules communicate via events for loose coupling:
- `data.source.connected` → triggers discovery
- `scan.completed` → triggers classification
- `classification.completed` → triggers risk scoring
- `risk.finding.created` → feeds dashboard
- `consent.revoked` → triggers data deletion workflow
- `dsar.submitted` → triggers data collection across connectors
- `breach.detected` → triggers notification workflow

### Multi-Tenancy Model
- **Database**: Shared database, tenant-scoped via `tenant_id` column + Row Level Security (RLS)
- **Compute**: Shared application layer with tenant context propagation
- **Storage**: Tenant-prefixed object storage paths
- **Isolation**: Logical isolation by default, physical isolation available for enterprise tier
- **Encryption**: Per-tenant encryption keys via KMS

## Data Flow Architecture

```
[Data Sources] → [Connectors] → [Discovery Engine] → [Classification Engine]
                                       ↓                       ↓
                                [Asset Registry] ←→ [Data Catalog]
                                       ↓
                              [Risk Scoring Engine]
                                       ↓
                    [DSPM Dashboard] + [Privacy Ops Modules]
                                       ↓
                         [Compliance Evidence Store]
```

## Deployment Models

### SaaS (Primary)
- Multi-tenant, TechD-managed
- India region (AWS Mumbai / Azure Central India)
- Data residency guarantees

### Customer-Managed
- Helm chart deployment to customer's Kubernetes
- Customer provides database, storage, KMS
- TechD provides license server + update channel
- Air-gapped option for government/defense customers

## Licensing Model (Assumption)

Modular licensing per module per data source count:
- **Foundation** (required): Platform core, RBAC, audit, dashboard
- **DSPM**: Per cloud account / data source
- **Privacy Suite**: Consent + DSAR + DPIA + RoPA
- **Governance Suite**: Retention + Classification + Policy
- **Risk Suite**: TPRM + Breach + Compliance Automation
- **AI Add-on**: AI Compliance Engine + AI augmentation features
