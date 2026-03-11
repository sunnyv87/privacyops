# Sections 16-17 — Risks, Assumptions, Open Questions & Next Steps

## Assumptions Made

| # | Assumption | Impact if Wrong |
|---|-----------|----------------|
| 1 | DPDP Act rules will specify 30-day DSAR response timeline | DSAR SLA logic needs updating |
| 2 | DPDP Act breach notification will align with CERT-In 6-hour requirement | Breach workflow timers need adjustment |
| 3 | India data residency can be satisfied by AWS/Azure Mumbai region | May need government cloud if stricter rules emerge |
| 4 | NestJS modular monolith will handle up to ~100 tenants before needing extraction | Premature microservices if overestimated |
| 5 | NATS JetStream is sufficient for event volume (<10K events/minute initially) | Migrate to Kafka if volume exceeds expectations |
| 6 | PostgreSQL with RLS provides sufficient tenant isolation for most customers | Need dedicated schemas/databases for government/enterprise tier |
| 7 | Regex + dictionary classification is sufficient for MVP (ML in Phase 2) | Accuracy may be lower for unstructured data |
| 8 | Keycloak is acceptable for enterprise SSO | Some enterprises may require direct SAML/OIDC without Keycloak |
| 9 | Team of 10 can deliver Phase 1 in 90 days | Requires experienced engineers, no significant scope changes |

## Open Questions

1. **DPDP Act Rules**: When will the specific rules be notified? Platform design accommodates uncertainty but specific SLAs and templates need legal review once rules are final.

2. **Pricing Model**: Module-based pricing assumed. Need product/business decision on: per-data-source, per-user, per-scan, or flat-tier pricing.

3. **AI Model Hosting**: Use Anthropic API (Claude) or self-hosted models? Decision impacts latency, cost, and air-gap capability. Current design supports both.

4. **Graph Database**: Is Neo4j/Apache AGE warranted for data lineage in Phase 2, or can JSONB relationships suffice longer?

5. **SOC 2 Timeline**: When does TechD plan SOC 2 Type II certification? This affects security engineering priorities.

6. **Multi-Region**: When is multi-region deployment needed? Current design is single-region (Mumbai). Multi-region adds significant complexity.

7. **On-Premise Release**: When do we need the Helm-based self-hosted release? Current focus is SaaS-first.

## Major Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Cross-tenant data leak | Low | Critical | RLS, automated isolation tests, security reviews |
| DPDP rules change platform assumptions | Medium | High | Modular design, configurable SLAs/templates |
| Connector credential compromise | Low | Critical | KMS encryption, vault, rotation, minimal permissions |
| Scale issues with single PostgreSQL | Medium | Medium | Partitioning strategy ready, can split to per-tenant DBs |
| AI hallucinations in compliance context | Medium | High | Mandatory HITL, confidence thresholds, disclaimers |
| Scope creep across 18 modules | High | High | Strict phase gating, MVP focus, product owner discipline |

## Immediate Next Build Steps

### Week 1 — Foundation Sprint
1. Initialize the monorepo with `pnpm` and Turborepo
2. Set up `docker-compose.yml` and verify all services start
3. Run `prisma migrate dev` to create database schema
4. Run `prisma db seed` to populate classification labels, roles, regulations
5. Implement JWT auth flow (dev mode with local credentials, Keycloak placeholder)
6. Implement tenant middleware with RLS
7. Implement RBAC guard with permission checking
8. Build audit logging service
9. Verify health endpoints work
10. Set up CI pipeline on GitHub Actions

### Week 2 — First Connector
1. Implement AWS S3 connector (full: discovery, sampling, access analysis)
2. Implement PostgreSQL connector (full: schema extraction, content sampling)
3. Build scan job orchestration (BullMQ or direct)
4. Wire classification engine to scan pipeline
5. Generate findings from scan results
6. Build findings API (CRUD + filters)

### Week 3 — Frontend Foundation
1. Set up Next.js app with Tailwind + Shadcn/ui
2. Build app shell (sidebar, header, layout)
3. Build dashboard page with stat cards and charts
4. Build data sources list page
5. Build "add data source" wizard
6. Build findings list page with filters
7. Build finding detail page

### Week 4 — Integration & Polish
1. Connect frontend to backend APIs
2. Implement real-time scan status updates (polling or WebSocket)
3. Build data map visualization (basic)
4. Add OpenSearch indexing for assets and findings
5. Build global search
6. Security hardening review
7. Write integration tests for connector → scan → classify → finding flow
