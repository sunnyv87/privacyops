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

## API Security

- JWT validation on every request
- Rate limiting per API key / user
- Request size limits (10MB default, 100MB for file uploads)
- Input validation (Zod/class-validator)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (React auto-escaping + CSP headers)
- CSRF protection (SameSite cookies + CSRF token)
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
| Privilege escalation | High | RBAC guards, permission validation |
| DSAR data leakage | High | Field encryption, signed URLs, access logging |
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
