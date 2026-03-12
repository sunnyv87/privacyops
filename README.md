# TechD PrivacyOps

Enterprise Privacy Operations, Data Security Posture Management (DSPM), and Data Governance Platform.

---

## Overview

TechD PrivacyOps is a comprehensive platform that helps organizations manage data privacy, security posture, and regulatory compliance. It provides automated data discovery, classification, risk assessment, and compliance management across cloud and on-premises data sources.

### Key Capabilities

| Area | Features |
|------|----------|
| **DSPM** | Data security posture scoring, findings management, automated remediation |
| **Data Discovery** | Scan and catalog data assets across PostgreSQL, MySQL, MSSQL, MongoDB, BigQuery, Snowflake, S3, Azure Blob |
| **Classification** | Rule-based + ML-powered data classification with India-first labels (Aadhaar, PAN, GSTIN) and global PII/PFI/PHI |
| **Data Lineage** | Column-level lineage tracking, impact analysis, visual lineage graphs |
| **Data Graph** | Relationship mapping between data assets, owners, and regulations |
| **ROPA** | Records of Processing Activities (GDPR/DPDP Article 30) |
| **Consent Management** | Consent collection, withdrawal, purpose tracking |
| **DSAR** | Data Subject Access Request intake, routing, and fulfillment workflows |
| **Breach/Incident Management** | Incident lifecycle, breach notification tracking, timeline |
| **Risk Assessments** | Privacy Impact Assessments (PIA/DPIA), risk scoring |
| **Compliance** | DPDP 2023, GDPR, ISO 27701, PCI-DSS obligation mapping and gap analysis |
| **Retention Policies** | Data retention rules, automated enforcement |
| **Vendor Management** | Third-party risk, DPA tracking |
| **AI Governance** | Model inventory, bias detection, AI risk assessment |
| **Attack Path Analysis** | Data exposure path detection |
| **Shadow Data Detection** | Unmanaged data store identification |
| **Threat Hunting** | Proactive data threat investigation |
| **AI Co-Pilot** | Natural language privacy queries powered by Claude |
| **Adaptive Policies** | Context-aware, auto-adjusting data policies |

### Supported Regulations

- **DPDP 2023** (Digital Personal Data Protection Act, India)
- **GDPR** (General Data Protection Regulation, EU)
- **ISO/IEC 27701:2019** (Privacy Information Management)
- **PCI-DSS** (Payment Card Industry)
- **CCPA** (California Consumer Privacy Act)

---

## Architecture

```
                        +------------------+
                        |   Next.js Web    |
                        |   (Port 3000)    |
                        +--------+---------+
                                 |
                        +--------v---------+
                        |  NestJS API      |
                        |  (Port 4000)     |
                        +--+----+----+---+-+
                           |    |    |   |
              +------------+    |    |   +------------+
              |                 |    |                |
     +--------v---+   +--------v-+  +v---------+  +--v--------+
     | PostgreSQL  |   |  Redis   |  | OpenSearch|  |   NATS    |
     | (RLS+Audit) |   | (Cache)  |  | (Search)  |  | (Events)  |
     +-------------+   +----------+  +----------+  +-----------+
                                                         |
                        +------------------+    +--------v---------+
                        |  Temporal Server |    | Temporal Workers  |
                        |  (Workflows)     |    | (Scan/DSAR/etc)  |
                        +------------------+    +------------------+
                                |
              +-----------------+-----------------+
              |                 |                 |
     +--------v---+   +--------v---+   +---------v--+
     |   MinIO/S3  |   |    KMS     |   |  Keycloak  |
     |  (Storage)  |   | (Encrypt)  |   |   (OIDC)   |
     +-------------+   +------------+   +------------+
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | NestJS 10.3, TypeScript 5.4, Prisma ORM |
| **Web** | Next.js 14.2, React 18.3, Tailwind CSS, Radix UI, Zustand |
| **Database** | PostgreSQL 16 with Row-Level Security |
| **Cache** | Redis 7 (sessions, rate limiting, pub/sub) |
| **Search** | OpenSearch 2.12 |
| **Messaging** | NATS 2.10 with JetStream |
| **Workflows** | Temporal 1.23 |
| **Auth** | JWT + Keycloak OIDC + SAML 2.0 + MFA (TOTP) |
| **Encryption** | AES-256-GCM envelope encryption with KMS |
| **Storage** | S3-compatible (AWS S3 / MinIO) |
| **AI** | Anthropic Claude API |
| **Observability** | OpenTelemetry, Prometheus, Jaeger, Grafana |
| **Infrastructure** | Kubernetes (EKS), Helm, Terraform |
| **CI/CD** | GitHub Actions |
| **Monorepo** | pnpm workspaces + Turborepo |

### Multi-Tenancy

All data is tenant-isolated using PostgreSQL Row-Level Security (RLS). Every table with tenant-scoped data has RLS policies enforced at the database level. The API sets the tenant context via `SET LOCAL app.current_tenant_id` before every query.

### Security

- Envelope encryption (AES-256-GCM + KMS) for sensitive fields
- Deterministic encryption for searchable encrypted fields
- MFA secrets and recovery codes encrypted at rest
- SCIM 2.0 provisioning with typed/validated DTOs
- Redis-backed distributed rate limiting
- CORS, Helmet, global validation pipes
- Kubernetes security contexts (non-root, read-only FS, no privilege escalation)
- Audit log immutability (database triggers prevent modification)
- Session management with rotation and revocation

---

## Project Structure

```
privacyops/
  apps/
    api/                    # NestJS backend (port 4000)
      prisma/               # Prisma schema, migrations, seed
      src/
        core/               # Auth, crypto, security, telemetry, tenant, notifications
        modules/            # 28 feature modules (dspm, discovery, classification, ...)
    web/                    # Next.js frontend (port 3000)
      src/
        app/                # App router pages
        components/         # React components
        stores/             # Zustand state stores
        lib/                # API client, utilities
  packages/
    shared-types/           # Shared TypeScript types
  infra/
    helm/                   # Kubernetes Helm charts
    terraform/              # AWS infrastructure (EKS, RDS, ElastiCache, S3, KMS)
    grafana/                # Dashboard JSON + provisioning
    prometheus/             # Prometheus configuration
  scripts/                  # DB init, security hardening, dev setup
  docs/
    architecture/           # Architecture decision records
```

---

## Quick Start

See the [Installation & Configuration Guide](docs/INSTALLATION.md) for detailed setup instructions.

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

# 1. Clone and install
git clone <repo-url> && cd privacyops
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start infrastructure
docker compose up -d

# 4. Set up database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start development servers
pnpm dev
```

- **API**: http://localhost:4000
- **API Docs (Swagger)**: http://localhost:4000/api/docs
- **Web UI**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin / privacyops)
- **Temporal UI**: http://localhost:8233
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation & Configuration Guide](docs/INSTALLATION.md) | Setup, environment variables, deployment |
| [User Guide](docs/USER_GUIDE.md) | Feature walkthrough and usage instructions |
| [Architecture Docs](docs/architecture/) | ADRs and system design documents |

---

## API Endpoints

All API endpoints are prefixed with `/api/v1/`. Swagger documentation is available at `/api/docs` in non-production environments.

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/auth` | Login, MFA, OIDC, SAML, sessions |
| Users | `/users` | User management, profiles, roles |
| DSPM | `/dspm` | Security posture, findings, scores |
| Discovery | `/discovery` | Asset scanning and cataloging |
| Classification | `/classification` | Data classification labels and reviews |
| Connectors | `/connectors` | Data source connections |
| Lineage | `/lineage` | Data lineage tracking |
| Data Graph | `/data-graph` | Data relationship mapping |
| ROPA | `/ropa` | Records of Processing Activities |
| Consent | `/consent` | Consent management |
| DSAR | `/dsar` | Data Subject Access Requests |
| Incidents | `/incidents` | Breach and incident management |
| Compliance | `/compliance` | Regulation mapping and gap analysis |
| Risk/Assessments | `/assessments` | Privacy impact assessments |
| Retention | `/retention` | Data retention policies |
| Vendors | `/vendors` | Third-party vendor management |
| AI Governance | `/ai-governance` | AI model governance |
| Co-Pilot | `/co-pilot` | AI-powered privacy assistant |
| Dashboard | `/dashboard` | Analytics and metrics |
| SCIM | `/scim/v2` | SCIM 2.0 user provisioning |
| Observability | `/metrics`, `/health` | Prometheus metrics, health checks |

---

## Scripts

```bash
pnpm dev              # Start all apps in development mode
pnpm build            # Build all apps
pnpm lint             # Lint all packages
pnpm test             # Run all tests
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database with demo data
pnpm docker:build     # Build Docker images
pnpm docker:up        # Start Docker infrastructure
pnpm docker:down      # Stop Docker infrastructure
```

---

## License

Proprietary. Copyright TechD.
