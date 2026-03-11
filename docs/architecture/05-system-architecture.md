# Section 5 — System Architecture

## Stack Decision: Why NestJS + TypeScript

**Choice**: NestJS (TypeScript) over FastAPI (Python)

**Rationale**:
1. **Shared language with frontend** — TypeScript end-to-end reduces context switching and enables shared types/validation (Zod schemas shared between frontend and backend)
2. **NestJS module system** — Natural fit for modular monolith architecture. Each platform module maps to a NestJS module with clear boundaries
3. **Enterprise patterns built-in** — Dependency injection, guards, interceptors, pipes, middleware — all patterns needed for multi-tenant enterprise SaaS
4. **Prisma ecosystem** — Excellent TypeScript ORM with type-safe queries, migrations, and PostgreSQL RLS support
5. **Temporal SDK** — First-class TypeScript SDK for workflow orchestration
6. **Performance** — Node.js is sufficient for this workload (I/O-bound, not CPU-bound). CPU-intensive tasks (ML classification) can be offloaded to Python microservices later
7. **Hiring** — TypeScript full-stack engineers are more available in India than Python + TypeScript split teams

**Where Python is used**: ML classification service (Phase 2) as a separate microservice.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌───────────────┐  │
│  │Auth  │ │Dashboard │ │Modules │ │Admin │ │Public Portal  │  │
│  └──────┘ └──────────┘ └────────┘ └──────┘ └───────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS / REST + WebSocket
┌─────────────────────────┴───────────────────────────────────────┐
│                      API GATEWAY (Kong / Nginx)                  │
│            Rate limiting, Auth, Tenant routing                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                    APPLICATION LAYER (NestJS)                    │
│                                                                  │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────────────┐   │
│  │ Auth Module  │ │ Tenant Module  │ │ RBAC/ABAC Module     │   │
│  └─────────────┘ └────────────────┘ └──────────────────────┘   │
│                                                                  │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────────────┐   │
│  │ DSPM Module │ │Discovery Module│ │Classification Module │   │
│  └─────────────┘ └────────────────┘ └──────────────────────┘   │
│                                                                  │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────────────┐   │
│  │Consent Mod. │ │  DSAR Module   │ │  DPIA Module         │   │
│  └─────────────┘ └────────────────┘ └──────────────────────┘   │
│                                                                  │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────────────┐   │
│  │Breach Module│ │Retention Module│ │ Compliance Module    │   │
│  └─────────────┘ └────────────────┘ └──────────────────────┘   │
│                                                                  │
│  ┌─────────────┐ ┌────────────────┐ ┌──────────────────────┐   │
│  │ TPRM Module │ │  RoPA Module   │ │ Policy Module        │   │
│  └─────────────┘ └────────────────┘ └──────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SHARED SERVICES LAYER                       │    │
│  │  Audit │ Events │ Notifications │ Search │ AI │ Workflow │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
  ┌────┴───┐ ┌───┴────┐ ┌──┴───┐ ┌───┴────┐ ┌──┴──────┐
  │PostgreSQL│ │OpenSearch│ │Redis │ │  NATS  │ │Temporal │
  └────────┘ └────────┘ └──────┘ └────────┘ └─────────┘
                                                  │
                                          ┌───────┴────────┐
                                          │  Object Storage │
                                          │   (S3/MinIO)    │
                                          └────────────────┘
```

## Modular Monolith Strategy

### Phase 1: Single Deployable
- All NestJS modules in one application
- Shared PostgreSQL database
- Internal module communication via direct function calls and in-process events
- Single deployment unit

### Phase 2: Extract Scanning Workers
- Connector/scanning logic moves to separate worker processes
- Communication via NATS + Temporal
- Main app remains monolithic

### Phase 3: Extract by Scale Need
- Only extract modules that need independent scaling
- Candidates: Scanning workers, Notification service, AI service
- Keep tightly coupled modules together

### Module Boundaries (Internal)
Each NestJS module has:
```
src/modules/<module-name>/
├── <module-name>.module.ts          # NestJS module definition
├── <module-name>.controller.ts      # HTTP endpoints
├── <module-name>.service.ts         # Business logic
├── <module-name>.repository.ts      # Data access (Prisma)
├── dto/                             # Request/response DTOs
├── entities/                        # Domain entities
├── events/                          # Event definitions
├── guards/                          # Module-specific guards
└── interfaces/                      # Module interfaces
```

Modules interact via:
1. **Service injection** — For synchronous, in-process calls
2. **Event bus (NATS)** — For async, decoupled communication
3. **Temporal workflows** — For long-running multi-step processes

## Component Deep Dive

### Frontend Architecture
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui component library
- **State Management**: Zustand (global UI state), TanStack Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts or Tremor
- **Tables**: TanStack Table
- **Auth**: NextAuth.js with Keycloak provider
- **API Client**: Generated from OpenAPI spec (openapi-typescript-codegen)

### Backend Architecture
- **Framework**: NestJS 10+
- **ORM**: Prisma 5+
- **Validation**: class-validator + class-transformer (DTOs), Zod (shared schemas)
- **Auth**: Passport.js (JWT + SAML strategies)
- **API Documentation**: Swagger/OpenAPI via @nestjs/swagger
- **Background Jobs**: BullMQ (Redis-backed) for simple jobs, Temporal for workflows
- **File Parsing**: Apache Tika (via Docker sidecar) for document extraction
- **PDF Generation**: Puppeteer or PDFKit

### Connector Framework
- Plugin-based architecture
- Each connector implements `IConnector` interface
- Connectors run in isolated worker processes (BullMQ workers)
- Connectors handle: auth, metadata pull, content sampling, schema extraction

### Workflow Engine (Temporal)
- DSAR fulfillment workflows
- Breach response workflows
- DPIA review/approval workflows
- Retention disposition workflows
- Vendor assessment workflows
- Scan orchestration workflows

### Notification Engine
- Multi-channel: Email, in-app, webhook, Slack (Phase 2)
- Template-based with variable substitution
- Notification preferences per user
- Digest mode for high-frequency notifications
- Provider: SendGrid / AWS SES for email

### Rule Engine
- Policy evaluation for classification, retention, risk scoring
- JSON-based rule definitions stored in database
- Evaluated server-side (no external rule engine needed for MVP)
- Structure: `{conditions: [{field, operator, value}], actions: [{type, params}]}`

### Policy Engine
- Shared across modules
- Evaluates: retention policies, classification policies, access policies, consent validation
- Cacheable policy evaluation with Redis

### AI Orchestration Layer
- Abstraction over LLM providers (Claude primary)
- PII redaction before external LLM calls
- Prompt template management
- Response caching for identical queries
- Audit trail for all AI interactions
- Human-in-the-loop approval for AI-generated content

### Reporting Layer
- Pre-built report templates (PDF, CSV, Excel)
- Custom report builder (Phase 2)
- Scheduled report delivery
- Report generation via background jobs

### Search Layer
- OpenSearch for full-text search across all entities
- Auto-sync from PostgreSQL via change data capture (Debezium) or application-level sync
- Faceted search, aggregations, suggestions

### RBAC / ABAC Authorization
```
Permission format: <module>:<resource>:<action>
Examples:
- dspm:findings:read
- dspm:findings:update
- consent:records:create
- dsar:requests:approve
- admin:users:manage
```

ABAC rules (Phase 2):
- Business unit scoping
- Data sensitivity level restrictions
- Geographic restrictions

### Audit Trail Service
- Every API mutation logged
- Hash chain for tamper evidence
- Separate append-only table
- Replicated to OpenSearch for search
- Exportable for external audit tools

### Secrets Handling
- Application secrets: Kubernetes Secrets + sealed-secrets
- Connector credentials: Encrypted in DB with tenant KMS key
- Optional: HashiCorp Vault integration for enterprise tier
- Secret rotation support

### Observability
- **Tracing**: OpenTelemetry → Jaeger/Tempo
- **Metrics**: Prometheus + Grafana
- **Logging**: Structured JSON logs → Fluentd → OpenSearch
- **Alerting**: Grafana alerting + PagerDuty/OpsGenie integration
- **Health checks**: /health, /ready endpoints per service

### Message Bus: Why NATS JetStream

**Over Kafka**: Simpler operations, lower resource footprint, sufficient for this scale. JetStream provides persistence, replay, and consumer groups.
**Over RabbitMQ**: Better performance, simpler clustering, built-in JetStream persistence.

Kafka makes sense when processing >100K events/second consistently. Start with NATS, migrate to Kafka only if needed.

### Cache Strategy (Redis)
- Session tokens
- RBAC permission cache (per user, TTL 5 minutes)
- API response cache (tenant-scoped)
- Rate limiting counters
- BullMQ job queues
- Distributed locks

### Object Storage
- S3-compatible API (AWS S3, MinIO for self-hosted)
- Tenant-prefixed paths: `/{tenant_id}/{module}/{entity_id}/{filename}`
- Signed URLs for secure access (15-minute expiry)
- Server-side encryption (SSE-S3 or SSE-KMS)
- Lifecycle policies for temp files

### Deployment Model

```
Kubernetes Cluster
├── Namespace: privacyops-app
│   ├── Deployment: api-server (NestJS, 3+ replicas)
│   ├── Deployment: web-frontend (Next.js, 2+ replicas)
│   ├── Deployment: scan-worker (connector workers, auto-scaled)
│   ├── Deployment: temporal-worker (workflow workers, 2+ replicas)
│   ├── Deployment: notification-worker (1+ replicas)
│   └── CronJob: scheduled-scans, report-generation
├── Namespace: privacyops-infra
│   ├── StatefulSet: postgresql (or managed RDS)
│   ├── StatefulSet: opensearch (or managed)
│   ├── StatefulSet: redis (or managed ElastiCache)
│   ├── Deployment: nats (or managed)
│   ├── Deployment: temporal-server
│   ├── Deployment: keycloak
│   └── Deployment: minio (self-hosted only)
└── Namespace: privacyops-monitoring
    ├── Deployment: prometheus
    ├── Deployment: grafana
    ├── Deployment: jaeger
    └── DaemonSet: fluentd
```

## Monolith-First Recommendation

**Strongly recommended**. Reasons:
1. Team is small (Phase 1)
2. Module boundaries are not yet battle-tested
3. Shared database simplifies transactions and consistency
4. Deployment and debugging are dramatically simpler
5. NestJS modules give microservice-like boundaries without the overhead

**What to avoid over-engineering**:
- Don't set up Kafka for <1000 events/minute
- Don't build a custom API gateway; use nginx/Kong
- Don't build a custom identity provider; use Keycloak
- Don't build a custom workflow engine; use Temporal
- Don't build a custom search engine; use OpenSearch
- Don't pre-optimize for millions of tenants; optimize for 10-100 first
