# TechD PrivacyOps + DSPM Platform -- Access Control Policy

**Document ID:** TECHD-ACP-004
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Security Engineering Lead
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy defines the access control framework for the TechD PrivacyOps + DSPM platform, including the 7-layer authentication and authorization guard pipeline, role-based access control (RBAC) definitions, attribute-based access control (ABAC) policies, tenant isolation mechanisms, and privileged access management. It applies to all platform users, service accounts, API integrations, and administrative access.

---

## 2. Access Control Principles

- **Least Privilege:** Users and service accounts receive only the minimum permissions required for their function.
- **Separation of Duties:** Critical operations (data deletion, credential rotation, legal hold management) require multi-party approval.
- **Defense in Depth:** Seven sequential guard layers ensure no single control failure grants unauthorized access.
- **Fail-Closed:** All guard layers deny access by default. Access is granted only when all applicable guards pass.
- **Tenant Isolation:** Every data access operation is scoped to a tenant boundary enforced at the database level via RLS.

---

## 3. The 7-Layer Guard Pipeline

Every API request traverses seven sequential guards. Failure at any layer immediately terminates the request with an appropriate HTTP error code.

### 3.1 Layer 1 -- CSRF Guard

**Purpose:** Prevents cross-site request forgery attacks on state-changing operations.

- Validates CSRF token on POST, PUT, PATCH, DELETE requests.
- Token generated per session and bound to the authenticated user.
- Safe methods (GET, HEAD, OPTIONS) are exempt.
- Failure response: `403 Forbidden` with `CSRF_VALIDATION_FAILED` error code.

### 3.2 Layer 2 -- JWT Guard (passport-jwt)

**Purpose:** Authenticates the request by validating the JWT Bearer token.

- Extracts token from `Authorization: Bearer <token>` header.
- Validates token signature using ECDSA (ES256) with rotating key pairs.
- Checks token expiration (`exp`), not-before (`nbf`), and issuer (`iss`) claims.
- Validates audience (`aud`) claim matches the platform API identifier.
- Failure response: `401 Unauthorized` with `TOKEN_INVALID`, `TOKEN_EXPIRED`, or `TOKEN_MISSING` error code.

**Token Lifecycle:**
| Token Type | Lifetime | Refresh | Storage |
|------------|----------|---------|---------|
| Access Token | 15 minutes | Via refresh token | Client memory only (never localStorage) |
| Refresh Token | 7 days | One-time use, rotation on each refresh | Encrypted in PostgreSQL, httpOnly cookie |
| API Key | 1 year (configurable) | Manual rotation | Hashed (SHA-256) in PostgreSQL |

### 3.3 Layer 3 -- Tenant Guard

**Purpose:** Establishes tenant context for the request and validates tenant membership.

- Extracts tenant identifier from JWT `tenant_id` claim.
- Validates tenant exists and is in `active` status.
- Sets the PostgreSQL session variable for RLS enforcement: `SET app.current_tenant_id = '<tenant_id>'`.
- Blocks requests from suspended or deprovisioned tenants.
- Failure response: `403 Forbidden` with `TENANT_INVALID`, `TENANT_SUSPENDED`, or `TENANT_NOT_FOUND` error code.

### 3.4 Layer 4 -- Permissions Guard (RBAC)

**Purpose:** Evaluates whether the authenticated user's role grants the required permission for the requested resource and action.

- Permission model: `resource:action` (e.g., `connectors:create`, `dsar:approve`, `audit_log:read`).
- Role-permission mappings loaded from database, cached per tenant with TTL invalidation.
- Supports hierarchical permissions: `connectors:*` grants all connector actions.
- Failure response: `403 Forbidden` with `PERMISSION_DENIED` error code.

### 3.5 Layer 5 -- FeatureGate Guard

**Purpose:** Checks whether the requested feature is enabled for the tenant.

- Feature gates are tenant-level boolean flags stored in the tenant configuration.
- Key feature gates:
  - `ai_llm_enrichment`: Controls access to Anthropic Claude AI co-pilot features.
  - `advanced_remediation`: Controls access to automated remediation actions.
  - `cross_border_transfer`: Controls cross-border data transfer capabilities.
  - `legal_hold_management`: Controls legal hold create/release operations.
- Failure response: `403 Forbidden` with `FEATURE_NOT_ENABLED` error code.

### 3.6 Layer 6 -- ABAC Guard

**Purpose:** Applies fine-grained, attribute-based access control policies using request context, resource attributes, and environmental conditions.

**Policy Attributes:**

| Attribute Category | Examples |
|-------------------|----------|
| Subject Attributes | user.role, user.department, user.mfa_verified, user.ip_address |
| Resource Attributes | resource.classification, resource.connector_type, resource.tenant_id |
| Action Attributes | action.type, action.is_destructive, action.requires_approval |
| Environment Attributes | env.time_of_day, env.request_origin, env.risk_score |

**Example ABAC Policies:**
- Users without MFA verified cannot access PII or PHI classified data.
- Data deletion actions on PCI-classified data require the `data_admin` role AND `compliance_officer` department.
- Connector credential access is restricted to business hours for non-admin users.
- Cross-border data transfers require explicit `cross_border_transfer` attribute on the user.

- Failure response: `403 Forbidden` with `ABAC_POLICY_DENIED` error code and policy reference.

### 3.7 Layer 7 -- Approval Guard

**Purpose:** Enforces multi-party approval workflows for sensitive operations.

- Operations requiring approval are routed to the APPROVAL task queue in Temporal.
- Approval workflows support configurable quorum (default: 2 approvers).
- Approvers cannot approve their own requests.
- Approval requests expire after a configurable timeout (default: 48 hours).
- Approved operations receive a time-limited approval token (default: 1 hour).

**Operations Requiring Approval:**
| Operation | Minimum Approvers | Approval Timeout |
|-----------|-------------------|------------------|
| Bulk data deletion | 2 | 48 hours |
| Connector credential rotation | 1 | 24 hours |
| Legal hold release | 2 | 72 hours |
| DSAR data export (>10K records) | 1 | 24 hours |
| Tenant deprovisioning | 2 | 72 hours |
| RLS policy modification | 2 | 48 hours |

- Failure response: `403 Forbidden` with `APPROVAL_REQUIRED` or `APPROVAL_EXPIRED` error code.

---

## 4. RBAC Role Definitions

### 4.1 Platform Roles

| Role | Description | Key Permissions |
|------|-------------|----------------|
| `platform_admin` | TechD internal platform administration | Full platform access, tenant provisioning, system configuration |
| `platform_support` | TechD customer support | Read-only tenant access, DSAR status viewing, log access |

### 4.2 Tenant Roles

| Role | Description | Key Permissions |
|------|-------------|----------------|
| `tenant_owner` | Tenant organization owner | Full tenant access, user management, billing, connector management |
| `tenant_admin` | Tenant administrator | User management, connector management, policy configuration |
| `data_admin` | Data governance administrator | Data classification, retention policies, legal holds, DSAR management |
| `security_admin` | Security administrator | Audit log access, remediation management, security policy configuration |
| `compliance_officer` | Compliance management | Compliance dashboard, evidence collection, PIA management, DSAR approval |
| `analyst` | Data analyst | Read-only data catalog, classification viewing, report generation |
| `connector_operator` | Connector management | Connector CRUD, scan scheduling, connector health monitoring |
| `viewer` | Read-only access | Dashboard viewing, report viewing |

### 4.3 Service Account Roles

| Role | Description | Scope |
|------|-------------|-------|
| `scan_worker` | SCAN task queue worker | Read access to connected data sources, write to data catalog |
| `dsar_worker` | DSAR task queue worker | Read/redact access to tenant data, DSAR record management |
| `remediation_worker` | REMEDIATION task queue worker | Execute remediation actions per CAPABILITY_MATRIX |
| `event_publisher` | NATS event publisher | Publish HMAC-signed events to JetStream subjects |
| `billing_service` | Stripe integration service | Usage metering, subscription management |

---

## 5. Tenant Isolation via Row-Level Security

### 5.1 RLS Implementation

- RLS policies are defined in `scripts/rls-extension.sql` and applied to 60 tables.
- Every table containing tenant data includes a `tenant_id` column with a NOT NULL constraint.
- RLS policy: `CREATE POLICY tenant_isolation ON <table> USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
- RLS is enforced at the PostgreSQL level, providing isolation independent of application logic.
- The Tenant Guard (Layer 3) sets `app.current_tenant_id` before any query execution.

### 5.2 RLS Bypass Prevention

- Application database user does NOT have `BYPASSRLS` privilege.
- Only the migration user (used exclusively in CI/CD) has schema modification privileges.
- Prisma ORM queries are automatically scoped by the RLS policy; no application-level tenant filtering is required (defense in depth: application filters are also applied).
- Direct database access (psql, pgAdmin) by engineers requires a separate connection with explicit tenant context and is logged.

### 5.3 Legal Hold RLS Extension

Legal holds add additional RLS filtering:
- `released_at IS NULL OR released_at > NOW()`: Active holds prevent data modification and deletion.
- `expires_at IS NULL OR expires_at > NOW()`: Holds with expiration are automatically released.
- LegalHold RLS interacts with `tenant_id` filtering to scope holds to the correct tenant.

---

## 6. Authentication Methods

### 6.1 Primary Authentication

| Method | Implementation | Use Case |
|--------|---------------|----------|
| Email + Password | bcrypt/Argon2id hashed, rate-limited | Default user authentication |
| SAML 2.0 | passport-saml | Enterprise SSO integration |
| OpenID Connect | passport-openidconnect | Enterprise SSO integration |
| API Key | SHA-256 hashed, scoped to specific permissions | Machine-to-machine access |

### 6.2 Multi-Factor Authentication (MFA)

- **Implementation:** TOTP via otplib with QR code provisioning.
- **MFA Enforcement Rules:**
  - Required for `tenant_owner`, `tenant_admin`, `data_admin`, `security_admin` roles.
  - Required for all users accessing PII/PHI/PCI classified data (enforced via ABAC).
  - Optional but recommended for `analyst` and `viewer` roles.
- **Recovery:** 10 single-use recovery codes generated at MFA setup, hashed with bcrypt.
- **Backup:** Admin-initiated MFA reset requires identity verification and is logged in audit chain.

---

## 7. Session Management

- Session tokens are stateless JWTs with 15-minute lifetime.
- Concurrent session limit: configurable per tenant (default: 5 sessions per user).
- Session revocation: refresh token invalidation in database propagates within token lifetime.
- Idle timeout: configurable per tenant (default: 30 minutes of inactivity).
- Absolute timeout: 12 hours regardless of activity.
- Session binding: tokens are bound to user-agent and IP range (configurable strictness).

---

## 8. Privileged Access Management

### 8.1 Platform Administrator Access

- Platform admin access requires VPN + MFA + hardware security key.
- All platform admin actions are logged in a separate audit chain.
- Platform admin sessions have a 1-hour absolute timeout.
- Break-glass procedure: documented for emergency access with post-incident review requirement.

### 8.2 Database Access

- Direct database access is prohibited in production outside of break-glass procedures.
- All schema changes are applied through Prisma migrations in CI/CD pipeline.
- Query access for debugging requires a time-limited credential from the vault with full audit logging.

### 8.3 Connector Credential Access

- Connector credentials are accessible only to the `connector_operator` role and service accounts.
- Credential viewing is masked by default; full credential access requires the Approval Guard.
- The `rotate_credentials` remediation action is available for automated credential rotation.

---

## 9. Access Review and Recertification

- **Quarterly:** All tenant role assignments reviewed by tenant_owner.
- **Semi-annually:** All platform roles reviewed by CISO.
- **Annually:** RBAC permission matrix reviewed by Security Review Board.
- **On termination:** Immediate revocation of all access (refresh tokens invalidated, API keys revoked).
- **On role change:** Previous role permissions revoked, new role permissions granted atomically.

---

## 10. Access Control Monitoring

- All guard pipeline rejections are logged with full request context in the SHA256 hash chain.
- Failed authentication attempts trigger progressive rate limiting: 5 failures = 15-minute lockout, 10 failures = 1-hour lockout, 20 failures = account lock requiring admin reset.
- Anomalous access patterns (unusual hours, new IP ranges, geographic anomalies) trigger NATS events for SIEM integration.
- ABAC policy evaluation metrics are tracked for performance and security analysis.

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Encryption Standards | TECHD-ENC-003 |
| Audit Logging Policy | TECHD-ALP-005 |
| Penetration Testing Policy | TECHD-PTP-008 |
| Compliance Matrix | TECHD-CM-012 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Security Engineering Lead | Initial release |
| 2.0 | 2026-05-10 | Security Engineering Lead | Added 7-layer guard detail, ABAC policies, Legal Hold RLS, MFA enforcement rules, approval workflows |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
