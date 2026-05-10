# TechD PrivacyOps -- Authentication Setup Guide

## Overview

PrivacyOps implements a 7-layer guard pipeline that executes in order for every protected HTTP request. The authentication and authorization system supports local JWT auth, SAML SSO, OIDC (Keycloak), TOTP MFA, RBAC, and ABAC.

### Guard Pipeline Execution Order

```
Request
  |-> 1. CsrfGuard         (apps/api/src/core/security/csrf.guard.ts)
  |-> 2. JwtAuthGuard       (apps/api/src/core/auth/guards/jwt-auth.guard.ts)
  |-> 3. TenantGuard        (apps/api/src/core/tenant/guards/tenant.guard.ts)
  |-> 4. PermissionsGuard   (apps/api/src/core/auth/guards/permissions.guard.ts)
  |-> 5. FeatureGateGuard   (apps/api/src/core/licensing/guards/feature-gate.guard.ts)
  |-> 6. AbacGuard          (apps/api/src/core/auth/guards/abac.guard.ts)
  |-> 7. ApprovalGuard      (apps/api/src/core/auth/guards/approval.guard.ts)
  |-> Handler
```

Each layer can short-circuit the request with a 401 or 403 response. Public endpoints bypass the pipeline via the `@Public()` decorator.

---

## 1. JWT Authentication

### Configuration

```bash
# .env
JWT_SECRET=<min-32-chars-12-distinct-characters>
JWT_ACCESS_TTL=900       # 15 minutes
JWT_REFRESH_TTL=604800   # 7 days
```

### JWT Strategy

`apps/api/src/core/auth/strategies/jwt.strategy.ts` implements a Passport JWT strategy:

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
```

### JWT Payload Structure

```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "email": "user@example.com",
  "roles": ["admin", "dpo"],
  "permissions": ["data_source.read", "scan.execute", "dsar.manage"],
  "iat": 1715350000,
  "exp": 1715350900
}
```

### Startup Validation

`apps/api/src/main.ts` validates `JWT_SECRET` strength at startup. Rejection criteria:
- Length < 32 characters
- Fewer than 12 distinct characters
- Contains forbidden substrings: `change`, `changeme`, `dev-secret`, `development`, `example`, `placeholder`, `insecure`, `replace`, `default`, `todo`, `fixme`, `test-secret`
- Exact matches: `secret`, `password`, `jwt`, `jwtsecret`, `test`, `123`

In production (`NODE_ENV=production`), weak secrets cause a hard startup failure. In development, a warning is logged.

---

## 2. OIDC Authentication (Keycloak)

### Keycloak Setup

```bash
# Docker Compose
keycloak:
  image: quay.io/keycloak/keycloak:24.0
  ports:
    - '8080:8080'
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
  command: start-dev
```

### Configuration

```bash
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=privacyops
KEYCLOAK_CLIENT_ID=privacyops-api
KEYCLOAK_CLIENT_SECRET=<client-secret>
```

### Strategy Implementation

`apps/api/src/core/auth/strategies/oidc.strategy.ts` uses `passport-openidconnect`:

```typescript
super({
  issuer: `${baseUrl}/realms/${realm}`,
  authorizationURL: `${issuer}/protocol/openid-connect/auth`,
  tokenURL: `${issuer}/protocol/openid-connect/token`,
  userInfoURL: `${issuer}/protocol/openid-connect/userinfo`,
  clientID: config.get('KEYCLOAK_CLIENT_ID'),
  clientSecret: config.get('KEYCLOAK_CLIENT_SECRET'),
  callbackURL: '/api/v1/auth/oidc/callback',
  scope: 'openid profile email',
  pkce: true,    // PKCE protection
  state: true,   // CSRF protection
});
```

### Security Features

- **PKCE enabled**: Prevents authorization code interception
- **Email verification required**: Rejects logins where `email_verified` is not `true`
- **Tenant resolution by domain**: Email domain is mapped to tenant before any user lookup
- **No email-based matching**: Users are looked up by `(externalId, authProvider, tenantId)` only -- prevents IdP compromise from hijacking existing accounts
- **Collision detection**: If a local account with the same email exists, OIDC auto-provisioning is blocked; admin must manually link

---

## 3. SAML SSO

### Configuration

```bash
SAML_ENTRY_POINT=https://idp.example.com/sso
SAML_ISSUER=privacyops-sp
SAML_CERT=<base64-x509-cert>
SAML_CALLBACK_URL=/api/v1/auth/saml/callback
SAML_AUDIENCE=privacyops-sp
```

### Strategy Implementation

`apps/api/src/core/auth/strategies/saml.strategy.ts` uses `@node-saml/passport-saml`:

```typescript
super({
  entryPoint: config.get('SAML_ENTRY_POINT'),
  issuer: config.get('SAML_ISSUER', 'privacyops-sp'),
  cert: config.get('SAML_CERT'),
  callbackUrl: config.get('SAML_CALLBACK_URL'),
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,
  wantLogoutRequestsSigned: true,
  disableRequestedAuthnContext: false,
  audience: config.get('SAML_AUDIENCE', 'privacyops-sp'),
});
```

### Security Features

- **Signed assertions required** (`wantAssertionsSigned: true`)
- **Signed responses required** (`wantAuthnResponseSigned: true`)
- **Signed logout requests required** (`wantLogoutRequestsSigned: true`)
- **Audience restriction enforced**
- **Tenant-first resolution**: Tenant is resolved from email domain before user lookup
- **Account collision protection**: Existing local accounts block SAML auto-provisioning

---

## 4. Multi-Factor Authentication (MFA)

### Implementation

`apps/api/src/core/auth/services/mfa.service.ts` uses `otplib` and `qrcode`:

```typescript
@Injectable()
export class MfaService {
  private readonly APP_NAME = 'TechD PrivacyOps';

  async generateSecret(email: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, this.APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  verifyToken(secret: string, token: string): boolean {
    return authenticator.verify({ token, secret });
  }

  generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(randomBytes(16).toString('hex'));
    }
    return codes;
  }
}
```

### Security Details

- **8 recovery codes** generated as 32-character hex strings
- **Timing-safe comparison** for recovery codes to prevent timing attacks
- **Constant-time scan**: All stored codes are compared even after a match to prevent timing leaks
- **MFA state stored in User model**: `mfaEnabled`, `mfaSecret` (encrypted), `mfaRecoveryCodes` (encrypted JSON array)

### Enabling MFA Flow

1. `POST /api/v1/auth/mfa/setup` -- Returns QR code and recovery codes
2. User scans QR code with authenticator app
3. `POST /api/v1/auth/mfa/verify` -- Confirms setup with a TOTP token
4. Recovery codes are stored encrypted via `CryptoService`

---

## 5. Tenant Isolation Guard

`apps/api/src/core/tenant/guards/tenant.guard.ts` extracts the tenant from the JWT and sets the PostgreSQL session variable for RLS:

```typescript
// Sets RLS context for the current request
await prisma.$executeRawUnsafe(
  `SET LOCAL app.current_tenant_id = '${user.tenantId}'`
);
```

The `TenantInterceptor` (`apps/api/src/core/tenant/interceptors/tenant.interceptor.ts`) propagates the tenant context to downstream services and event publications.

---

## 6. RBAC (Role-Based Access Control)

### Permission Model

Roles are stored in the `roles` table with a JSON `permissions` array:

```json
{
  "slug": "dpo",
  "permissions": [
    "data_source.read",
    "data_source.write",
    "scan.execute",
    "dsar.manage",
    "incident.manage",
    "assessment.manage",
    "audit.read",
    "vendor.manage",
    "compliance.read"
  ]
}
```

### PermissionsGuard

`apps/api/src/core/auth/guards/permissions.guard.ts` checks that the user's roles include all required permissions:

```typescript
@Permissions('scan.execute', 'data_source.read')
@Post('scan')
async startScan() { ... }
```

---

## 7. ABAC (Attribute-Based Access Control)

### Overview

The `AbacGuard` (`apps/api/src/core/auth/guards/abac.guard.ts`) evaluates policies based on user attributes, resource attributes, action, and environment context.

### AbacContext Structure

```typescript
interface AbacContext {
  user: {
    id: string;
    tenantId: string;
    email: string;
    roles: string[];
    permissions: string[];
    department?: string;
    clearanceLevel?: number;
  };
  resource: {
    type: string;          // e.g., 'DataSource', 'DsarRequest'
    id?: string;
    tenantId?: string;
    ownerId?: string;
    classification?: string;
    sensitivity?: number;
    department?: string;
  };
  action: string;          // e.g., 'read', 'write', 'delete', 'export'
  environment: {
    ip?: string;
    time?: Date;
    riskLevel?: string;
  };
}
```

### Usage with Decorator

```typescript
@RequireAbacPolicy({
  resourceType: 'DsarRequest',
  action: 'read',
  resourceIdParam: 'id',
  ownerField: 'assigneeId',
  classificationField: 'metadata.sensitivity',
})
@Get(':id')
async getDsarRequest(@Param('id') id: string) { ... }
```

### Prisma Model Map

The ABAC guard dynamically loads resources from Prisma using a model map with 23 supported resource types:

```typescript
const PRISMA_MODEL_MAP: Record<string, string> = {
  DataSource: 'dataSource',
  Asset: 'asset',
  DsarRequest: 'dsarRequest',
  Incident: 'incident',
  Vendor: 'vendor',
  User: 'user',
  // ... 17 more models
};
```

### Denied Access Audit Logging

All ABAC denials are logged as security audit events via `AuditService`:

```typescript
await this.auditService.log({
  tenantId: ctx.user.tenantId,
  actorId: ctx.user.id,
  action: 'security.abac.denied',
  entityType: ctx.resource.type,
  changes: {
    after: {
      attemptedAction: ctx.action,
      reason: result.reason,
      matchedPolicy: result.matchedPolicy,
    },
  },
});
```

---

## 8. Feature Gate Guard

`apps/api/src/core/licensing/guards/feature-gate.guard.ts` checks tenant-level feature flags:

```typescript
@RequireFeature('ai_llm_enrichment')
@Post('co-pilot/query')
async queryCoPilot() { ... }
```

Feature flags are managed by `LicensingService` (`apps/api/src/core/licensing/licensing.service.ts`) with per-tenant overrides stored in the `feature_overrides` table.

---

## 9. Approval Guard

`apps/api/src/core/auth/guards/approval.guard.ts` enforces multi-level approval for destructive operations:

```typescript
@RequireApproval({ approverRoles: ['dpo', 'admin'], minApprovals: 2 })
@Delete(':id')
async deleteDataSource(@Param('id') id: string) { ... }
```

The approval workflow is orchestrated via Temporal on the `approval-queue`.

---

## 10. Account Security

### Account Lockout

The User model tracks failed login attempts:

```prisma
model User {
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
}
```

After 5 failed attempts, the account is locked for 30 minutes. A `security.account_locked` audit event is logged.

### Session Management

`apps/api/src/core/auth/services/session.service.ts` manages active sessions with Redis-backed storage. Admins can revoke sessions, triggering a `security.session_revoked` event.

### SCIM Provisioning

`apps/api/src/modules/scim/scim.controller.ts` implements SCIM 2.0 for automated user lifecycle management with identity providers. Protected by `ScimAuthGuard` using bearer token authentication.

---

## 11. Security Headers

The API server applies Helmet middleware (`apps/api/src/main.ts`):

```typescript
app.use(helmet());
```

This sets: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, and `Content-Security-Policy` headers.

---

## 12. Rate Limiting

`apps/api/src/core/auth/guards/rate-limit.guard.ts` and `apps/api/src/core/security/rate-limiter.service.ts` implement per-tenant, per-IP rate limiting using Redis sliding window counters. Rate limit exceeded events are published to NATS as `security.rate_limit_exceeded`.
