# Section 11 — Security Architecture

## Authentication

### Primary: Keycloak (OIDC)
- Self-hosted Keycloak for identity management
- Tenant-specific realms for SSO isolation
- JWT tokens with short expiry (15 min access, 7 day refresh)
- Token contains: `sub`, `tenant_id`, `roles`, `permissions`

### SSO / SAML / OIDC
- Enterprise SSO via Keycloak identity brokering
- Support SAML 2.0 and OIDC for customer IdPs
- Per-tenant SSO configuration
- JIT (Just-in-Time) user provisioning

### MFA
- TOTP-based MFA (Google Authenticator, Authy)
- Enforced for Super Admin and Tenant Admin by default
- Configurable enforcement per role

### SCIM Provisioning
- SCIM 2.0 endpoint for automated user lifecycle management
- Sync users and groups from customer IdP
- Deprovisioning removes access immediately

## Authorization

### RBAC Implementation
```typescript
// Permission format: module:resource:action
type Permission = `${Module}:${Resource}:${Action}`;

// Examples
const permissions = [
  'dspm:findings:read',
  'dspm:findings:update',
  'dspm:connectors:create',
  'consent:records:read',
  'consent:notices:publish',
  'dsar:requests:approve',
  'admin:users:manage',
  'admin:tenant:configure',
];

// Guard implementation
@UseGuards(PermissionGuard)
@RequirePermissions('dspm:findings:read')
@Get('findings')
async listFindings() { ... }
```

### ABAC (Phase 2)
Attribute-based rules for fine-grained access:
- Business unit scoping: "User can only see findings for their business unit"
- Sensitivity restriction: "User can only see findings up to 'medium' sensitivity"
- Geographic restriction: "User can only access data from India region"

## Tenant Isolation

### Database Level
- `tenant_id` column on every table (NOT NULL)
- PostgreSQL Row Level Security (RLS):
```sql
CREATE POLICY tenant_isolation ON assets
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
```
- Application sets tenant context on every DB connection:
```sql
SET app.current_tenant = '<tenant_id>';
```

### Application Level
- Tenant context extracted from JWT and propagated through request lifecycle
- NestJS interceptor sets tenant context on every request
- All repository queries automatically scoped to tenant

### Storage Level
- Object storage paths: `/{tenant_id}/{module}/{...}`
- Tenant-specific encryption keys (KMS)
- No cross-tenant data access possible at storage layer

### Network Level (Enterprise Tier)
- Dedicated database schema or instance per tenant
- VPC peering for customer-managed deployments
- IP allowlisting for API access

## Encryption

### In Transit
- TLS 1.3 for all external communication
- mTLS between internal services (within Kubernetes)
- Certificate management via cert-manager

### At Rest
- PostgreSQL: Transparent Data Encryption (TDE) or volume encryption
- Object Storage: SSE-S3 or SSE-KMS
- Redis: TLS + AUTH
- OpenSearch: TLS + node-level encryption

### Field-Level Encryption
Highly sensitive fields encrypted at application level before storage:
- `data_subjects.identity_attributes` — AES-256-GCM
- `credentials.encrypted_value` — AES-256-GCM
- `dsar_requests.requestor_info` — AES-256-GCM
- `consent_records.ip_address` — AES-256-GCM

Key hierarchy:
```
Master Key (KMS) → Tenant Key → Field Encryption Key
```

### KMS Integration
- AWS KMS, Azure Key Vault, or GCP KMS
- Per-tenant customer-managed keys (BYOK) for enterprise tier
- Key rotation: Annual automatic rotation with re-encryption job

## Global Guard Chain

Every HTTP request passes through a 7-guard chain registered as `APP_GUARD` providers in `app.module.ts`, executed in registration order:

| Order | Guard | Purpose |
|---|---|---|
| 1 | `CsrfGuard` | Validates CSRF tokens on state-changing requests |
| 2 | `JwtAuthGuard` | Validates JWT; skipped for `@Public()` endpoints |
| 3 | `TenantGuard` | Extracts and validates `tenant_id` from token |
| 4 | `PermissionsGuard` | Checks `module:resource:action` permissions via `@RequirePermissions()` |
| 5 | `FeatureGateGuard` | Verifies tenant has licensed feature via `@RequireFeature()` |
| 6 | `AbacGuard` | Attribute-based access control (business unit, sensitivity, geography) |
| 7 | `ApprovalGuard` | Enforces approval workflow requirements for sensitive operations |

Endpoints decorated with `@Public()` bypass the JWT guard (e.g., consent public ingest, health checks).

## API Security

- JWT validation on every request (via global guard chain)
- Rate limiting per API key / user
- Request size limits (10MB default, 100MB for file uploads)
- Input validation (Zod/class-validator)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (React auto-escaping + CSP headers)
- CSRF protection (SameSite cookies + CSRF token, CsrfGuard in guard chain)
- CORS configuration per tenant
- API key scoping (read-only, specific modules)

## Audit Integrity

### Tamper-Evident Audit Logs
```typescript
// Each audit log entry includes a hash chain
const entry = {
  id: uuid(),
  action: 'finding.status.changed',
  changes: { before: { status: 'open' }, after: { status: 'mitigated' } },
  timestamp: new Date(),
  integrity_hash: sha256(
    previous_entry.integrity_hash +
    JSON.stringify({ action, changes, timestamp })
  )
};
```

- Hash chain verification: Any tampering breaks the chain
- Periodic integrity verification job
- Audit logs stored in separate table with restricted access
- No UPDATE or DELETE on audit_logs table (enforced via DB permissions)

## Secure File Handling

- File upload scanning via ClamAV (Docker sidecar)
- File type validation (magic bytes, not just extension)
- Maximum file size: 100MB
- Allowed types: PDF, DOC/DOCX, XLS/XLSX, CSV, PNG, JPG, ZIP
- Files stored in object storage with signed URLs (15-minute expiry)
- No direct file serving from application server

## Session Management

- JWT access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, rotated on use
- Session revocation: Token blacklist in Redis
- Concurrent session limit: Configurable per tenant (default 5)
- Session activity timeout: 30 minutes of inactivity
- Forced logout on password change or role change

## Data Masking in UI

- Sensitive fields masked by default in lists (e.g., email → p***@example.com)
- "Reveal" button with additional permission check
- Audit logged when sensitive data is revealed
- Configurable masking rules per field type

## Privacy-Preserving Logs

- No PII in application logs
- Structured logging with sanitization middleware
- Log fields: request_id, tenant_id, user_id, action, status_code, duration
- Never log: request bodies with PII, passwords, tokens, credentials

## PII Redaction Engine

The `RedactionService` (`modules/redaction-engine/`) provides deterministic PII detection and replacement, used for:
- Pre-send scrubbing before data reaches external LLMs
- Third-party PII removal in DSAR response packages

### Supported PII Patterns (13 types)

| Pattern | Example | Validation |
|---|---|---|
| `email` | user@example.com | RFC-style regex |
| `phone` | +91 123-456-7890 | International formats |
| `ssn` | 123-45-6789 | US format |
| `credit_card` | 4111 1111 1111 1111 | Luhn algorithm validation |
| `ipv4` | 192.168.1.1 | Dotted quad |
| `ipv6` | 2001:0db8:85a3:... | Full hex notation |
| `iban` | GB29NWBK60161331926819 | Country + check digits |
| `aadhaar` | 9876 5432 1098 | 12-digit Indian ID |
| `pan` | ABCDE1234F | Indian PAN format |
| `passport` | A1234567 | Standard passport |
| `national_id` | Various | Configurable |
| `mac_address` | 00:1A:2B:3C:4D:5E | Colon/dash separated |
| `date_of_birth` | 15/03/1990 | DD/MM/YYYY, DD-MM-YYYY |

Replacement format: `[REDACTED:TYPE]` (e.g., `[REDACTED:EMAIL]`, `[REDACTED:AADHAAR]`)

### Security Properties

- **Fail-closed**: If redaction throws, the AI provider sends `[REDACTED:ENGINE_ERROR]` — raw text never reaches the LLM
- **Non-destructive**: Never mutates input; returns new string
- **Overlap-safe**: Right-to-left replacement with overlap detection
- **Bounded**: 5 MB text input cap with truncation warning
- **Subject preservation**: DSAR callers can pass the subject's own identifiers to avoid masking their data

## LLM Security Controls

### Circuit Breaker (`ClaudeAIProvider`)
- 5 consecutive failures opens the circuit for 60 seconds
- While open, `isAvailable()` returns `false` — no network calls attempted
- State tracked via `ai_circuit_state` Prometheus gauge
- Automatic recovery after cooldown expires

### Per-Call Timeout
- `AbortSignal` with configurable timeout (`CLAUDE_TIMEOUT_MS`, default 10s)
- Prevents indefinite hangs on LLM API calls

### Fail-Closed Behavior
- Missing SDK → provider inert (returns `null`)
- Missing API key → provider inert
- Circuit open → returns `null` (template fallback)
- Redaction failure → sends `[REDACTED:ENGINE_ERROR]` instead of raw text
- Licensing check failure → template response (no external call)

### Licensing Gate
- Per-tenant `ai_llm_enrichment` feature flag checked before any LLM call
- Tenants without the flag get deterministic template responses — no data sent externally
- Separate from the `ai_copilot` flag that gates the entire endpoint

### Observability
- `ai_call_total` counter: tracks calls by tenant, provider, method, status
- `ai_call_duration_seconds` histogram: latency distribution
- `ai_circuit_state` gauge: circuit breaker open/closed state

## HMAC-SHA256 Public Endpoint Authentication

The public consent ingest endpoint (`POST /consent/public/record`) uses HMAC-SHA256 instead of JWT, allowing anonymous browser clients (via the Consent SDK) to submit consent records:

### Authentication Flow
1. Client sends `X-Tenant-Id` and `X-Consent-Signature` headers
2. Server resolves the shared secret (per-tenant override → derived key fallback)
3. Server computes `HMAC-SHA256(canonical_json, derived_key)`
4. Constant-time comparison via `crypto.timingSafeEqual`

### Key Derivation
```
Per-tenant override: CONSENT_PUBLIC_SECRET_<TENANTID> (min 32 chars)
Derived key:         HMAC-SHA256(CONSENT_PUBLIC_SHARED_SECRET, tenantId)
```

### Security Properties
- Timing-safe comparison prevents timing attacks
- Canonical JSON serialization prevents signature bypass via field reordering
- Minimum key length enforcement (32 characters)
- `@Public()` decorator bypasses JWT guard but HMAC is enforced in controller

## Product Threat Model

### Assets
1. Tenant configuration and credentials
2. Discovered data metadata and classifications
3. Consent records and data subject information
4. Audit logs
5. Scan results and risk findings
6. Evidence artifacts and compliance documents

### Threat Categories
| Threat | Impact | Mitigation |
|---|---|---|
| Cross-tenant data access | Critical | RLS, tenant isolation, integration tests |
| Connector credential theft | Critical | KMS encryption, vault, rotation |
| Audit log tampering | High | Hash chain, separate DB user, no UPDATE/DELETE |
| Privilege escalation | High | 7-guard chain, RBAC + ABAC, permission validation |
| DSAR data leakage | High | Field encryption, signed URLs, access logging, RedactionService |
| LLM data exfiltration | High | Pre-send PII redaction (12 patterns), fail-closed on error, per-tenant licensing gate |
| LLM prompt injection | Medium | No user-facing free-form prompts, system prompt boundaries, output validation |
| LLM availability cascade | Medium | Circuit breaker (5 fail / 60s cooldown), per-call timeout, template fallback |
| HMAC signature bypass | Medium | Constant-time comparison, canonical JSON, min key length |
| API abuse | Medium | Rate limiting, API key scoping |
| Session hijacking | Medium | Short-lived JWTs, refresh rotation, IP binding |
| Malicious file upload | Medium | ClamAV scan, type validation, sandboxed storage |

### Abuse Cases
1. Tenant admin tries to access other tenant's data → Blocked by RLS
2. Attacker compromises API key → Scoped permissions, rate limiting, key rotation
3. Insider modifies audit logs → Hash chain breaks, detected by integrity check
4. DDoS on public DSAR portal → Rate limiting, CAPTCHA, WAF

## Secure SDLC Expectations

1. **Code Review**: All PRs require security-focused review
2. **SAST**: SonarQube or Semgrep in CI pipeline
3. **SCA**: npm audit / Snyk for dependency vulnerabilities
4. **DAST**: OWASP ZAP in staging pipeline
5. **Secret Scanning**: GitLeaks or TruffleHog in pre-commit
6. **Container Scanning**: Trivy for Docker image vulnerabilities
7. **Penetration Testing**: Annual third-party pentest
8. **Bug Bounty**: Consider after product maturity (Phase 3)

## Backup & Disaster Recovery

- **RPO**: 1 hour (point-in-time recovery)
- **RTO**: 4 hours
- **Backup**: Automated daily snapshots + continuous WAL archiving
- **Cross-region**: Backup replication to secondary region
- **Tested**: Quarterly DR drill
- **Backup encryption**: Same KMS keys as primary
