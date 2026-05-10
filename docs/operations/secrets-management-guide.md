# TechD PrivacyOps + DSPM Platform -- Secrets Management Guide

**Owner:** Security Engineering + Platform Engineering
**Review Cycle:** Quarterly
**Last Updated:** 2026-05-10
**Classification:** Internal -- Restricted

---

## 1. Overview

This document defines how secrets are classified, stored, accessed, rotated, and emergency-rotated across the TechD PrivacyOps platform. All secrets handling must comply with the principle of least privilege and defense in depth.

---

## 2. Secret Types and Classification

### 2.1 Secret Inventory

| Secret                    | Classification | Storage          | Rotation Cycle | Used By                        |
|---------------------------|---------------|------------------|----------------|--------------------------------|
| JWT_SECRET                | Critical      | Vault + K8s      | 90 days        | NestJS API (auth guard)        |
| JWT_REFRESH_SECRET        | Critical      | Vault + K8s      | 90 days        | NestJS API (token refresh)     |
| DATABASE_URL              | Critical      | Vault + K8s      | 180 days       | Prisma ORM, PgBouncer          |
| DB_PASSWORD               | Critical      | Vault + K8s      | 180 days       | PostgreSQL direct access       |
| REDIS_PASSWORD            | High          | Vault + K8s      | 180 days       | IORedis, BullMQ, Socket.IO     |
| STRIPE_SECRET_KEY         | Critical      | Vault + K8s      | 365 days       | BillingService                 |
| STRIPE_WEBHOOK_SECRET     | High          | Vault + K8s      | 365 days       | Stripe webhook handler         |
| NATS_AUTH_TOKEN            | Critical      | Vault + K8s      | 90 days        | NATS client connections        |
| NATS_NKEY_SEED            | Critical      | Vault + K8s      | 180 days       | NATS NKey authentication       |
| HMAC_SIGNING_KEY          | Critical      | Vault + K8s      | 90 days        | NATS event HMAC signing        |
| TEMPORAL_NAMESPACE_KEY    | High          | Vault + K8s      | 180 days       | Temporal SDK                   |
| OTEL_EXPORTER_HEADERS     | Medium        | K8s Secret       | 365 days       | OpenTelemetry OTLP exporter    |
| LLM_API_KEY               | High          | Vault + K8s      | 90 days        | AI co-pilot service            |
| ENCRYPTION_MASTER_KEY     | Critical      | AWS KMS          | Never (managed)| Data encryption at rest        |
| OKTA_CLIENT_SECRET        | High          | Vault + K8s      | 365 days       | SSO/OIDC integration           |
| SMTP_PASSWORD             | Medium        | K8s Secret       | 365 days       | Email notifications            |
| S3_ACCESS_KEY_ID          | High          | IAM Role         | Auto-rotated   | Report storage, backups        |
| S3_SECRET_ACCESS_KEY      | High          | IAM Role         | Auto-rotated   | Report storage, backups        |

### 2.2 Connector Credentials (Per-Tenant)

Each of the 43 registered connectors may have tenant-specific credentials:

| Credential Type          | Classification | Storage              | Rotation      |
|--------------------------|---------------|----------------------|---------------|
| OAuth Access Token       | High          | Encrypted in DB      | Auto-refresh  |
| OAuth Refresh Token      | Critical      | Encrypted in DB      | Provider-set  |
| API Key                  | High          | Encrypted in DB      | Manual        |
| Service Account Key      | Critical      | Vault (per-tenant)   | 90 days       |
| Database Credentials     | Critical      | Vault (per-tenant)   | 180 days      |
| SSH Key                  | Critical      | Vault (per-tenant)   | 365 days      |

**Connector credentials are encrypted at rest using the ENCRYPTION_MASTER_KEY via AWS KMS envelope encryption.** RLS ensures credentials are accessible only within the owning tenant's context.

---

## 3. Storage Architecture

### 3.1 HashiCorp Vault

**Primary secret store for all Critical and High classification secrets.**

```
Vault Mount Structure:
secret/
├── privacyops/
│   ├── production/
│   │   ├── jwt                    # JWT_SECRET, JWT_REFRESH_SECRET
│   │   ├── database               # DATABASE_URL, DB_PASSWORD
│   │   ├── redis                  # REDIS_PASSWORD
│   │   ├── stripe                 # STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
│   │   ├── nats                   # NATS_AUTH_TOKEN, NATS_NKEY_SEED, HMAC_SIGNING_KEY
│   │   ├── temporal               # TEMPORAL_NAMESPACE_KEY
│   │   ├── llm                    # LLM_API_KEY
│   │   └── okta                   # OKTA_CLIENT_SECRET
│   ├── staging/
│   │   └── (same structure)
│   └── connectors/
│       ├── tenant-{uuid}/
│       │   ├── salesforce          # OAuth tokens, instance URL
│       │   ├── hubspot             # API key, tokens
│       │   └── ...                 # Per-connector credentials
│       └── ...
```

### 3.2 Kubernetes Secrets

**Synced from Vault via the Vault Secrets Operator (VSO).**

```yaml
apiVersion: secrets.hashicorp.com/v1beta1
kind: VaultStaticSecret
metadata:
  name: privacyops-secrets
  namespace: privacyops
spec:
  vaultAuthRef: vault-auth
  mount: secret
  path: privacyops/production/jwt
  type: kv-v2
  refreshAfter: 60s
  destination:
    name: privacyops-secrets
    create: true
```

The VSO syncs Vault secrets to Kubernetes Secrets every 60 seconds. Application pods mount the Kubernetes Secret as environment variables.

### 3.3 AWS KMS

**Used exclusively for the ENCRYPTION_MASTER_KEY.**

```
KMS Key: alias/privacyops-master-key
  - Key Spec: AES_256
  - Key Usage: ENCRYPT_DECRYPT
  - Key Rotation: Automatic (AWS-managed, annual)
  - Key Policy: Restricted to privacyops service account IAM role
```

Connector credentials stored in PostgreSQL are encrypted using envelope encryption:
1. Generate a Data Encryption Key (DEK) via KMS
2. Encrypt the credential with the DEK
3. Store the encrypted DEK alongside the encrypted credential
4. On read, decrypt the DEK via KMS, then decrypt the credential

---

## 4. Access Control

### 4.1 Vault Access Policies

```hcl
# Application read-only policy
path "secret/data/privacyops/production/*" {
  capabilities = ["read"]
}

# Connector credential access (tenant-scoped)
path "secret/data/privacyops/connectors/tenant-{{identity.entity.metadata.tenant_id}}/*" {
  capabilities = ["read", "create", "update"]
}

# Secret rotation policy (operations team only)
path "secret/data/privacyops/production/*" {
  capabilities = ["read", "create", "update"]
}

# No delete capability -- secrets are versioned, not deleted
```

### 4.2 Kubernetes RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
  namespace: privacyops
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["privacyops-secrets"]
    verbs: ["get"]

# Only the API and worker service accounts can read secrets
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-secret-binding
  namespace: privacyops
subjects:
  - kind: ServiceAccount
    name: privacyops-api
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### 4.3 Human Access

| Role                    | Vault Access                              | K8s Secret Access |
|-------------------------|-------------------------------------------|-------------------|
| Platform Engineer       | Read production secrets                   | kubectl get secret|
| Security Engineer       | Read + write all secrets                  | Full access       |
| On-Call Engineer        | Read production secrets (break-glass)     | Read-only         |
| Developer               | Read staging secrets only                 | No production     |
| DevOps / SRE            | Read + write production secrets           | Full access       |

**Break-glass procedure:** On-call engineers can access production secrets via a time-limited Vault token (TTL: 4 hours) issued through the PagerDuty-Vault integration. All access is logged in the Vault audit log.

---

## 5. Rotation Procedures

### 5.1 JWT_SECRET Rotation

**Frequency:** Every 90 days
**Impact:** All existing JWTs are invalidated. Users must re-authenticate.
**Procedure:**

1. Generate new secret:
   ```bash
   NEW_SECRET=$(openssl rand -base64 64)
   ```

2. Update Vault (new version):
   ```bash
   vault kv put secret/privacyops/production/jwt \
     JWT_SECRET="$NEW_SECRET" \
     JWT_REFRESH_SECRET="$(openssl rand -base64 64)"
   ```

3. Wait for VSO sync (60 seconds max)

4. Perform rolling restart of API pods:
   ```bash
   kubectl rollout restart deployment api -n privacyops
   ```

5. Monitor auth errors in logs for 15 minutes. Expect a spike as users re-authenticate.

6. Verify:
   ```bash
   curl -sf https://api.privacyops.techd.io/health | jq .
   ```

### 5.2 DATABASE_URL / DB_PASSWORD Rotation

**Frequency:** Every 180 days
**Impact:** Brief connection interruption during rotation.
**Procedure:**

1. Create new PostgreSQL user with new password (keep old user active):
   ```sql
   ALTER USER privacyops_app PASSWORD 'new_password_here';
   ```

2. Update Vault:
   ```bash
   vault kv put secret/privacyops/production/database \
     DATABASE_URL="postgresql://privacyops_app:new_password@pgbouncer:6432/privacyops?pgbouncer=true&connection_limit=20" \
     DB_PASSWORD="new_password_here"
   ```

3. Update PgBouncer userlist:
   ```bash
   # Update pgbouncer userlist.txt and reload
   kubectl exec -n privacyops-data pgbouncer-0 -- pgbouncer -R
   ```

4. Rolling restart of API pods
5. Verify database connectivity via `/health/deep`
6. Monitor `pg_stat_activity` for connections using old credentials (should drop to 0)

### 5.3 NATS_AUTH_TOKEN and HMAC_SIGNING_KEY Rotation

**Frequency:** Every 90 days
**Impact:** Event publishing and consuming briefly interrupted.
**Procedure:**

1. Update NATS server config with new auth token (support dual tokens during transition):
   ```bash
   # NATS server supports authorization block with multiple tokens
   nats-server --signal reload
   ```

2. Update Vault with new token and HMAC key:
   ```bash
   vault kv put secret/privacyops/production/nats \
     NATS_AUTH_TOKEN="$(openssl rand -hex 32)" \
     HMAC_SIGNING_KEY="$(openssl rand -hex 32)"
   ```

3. Rolling restart API pods (publishers) first
4. Rolling restart Temporal workers (consumers) second
5. Verify event flow:
   ```bash
   nats sub "privacyops.events.>" --count=5
   ```
6. Remove old token from NATS server config after all services are using new token

### 5.4 STRIPE_SECRET_KEY Rotation

**Frequency:** Every 365 days
**Impact:** Billing operations briefly interrupted.
**Procedure:**

1. Generate new API key in Stripe Dashboard (Developers > API Keys > Roll Key)
2. Stripe provides a grace period where both old and new keys work
3. Update Vault:
   ```bash
   vault kv put secret/privacyops/production/stripe \
     STRIPE_SECRET_KEY="sk_live_new_key" \
     STRIPE_WEBHOOK_SECRET="whsec_new_secret"
   ```
4. Rolling restart API pods
5. Verify billing status:
   ```bash
   curl -sf https://api.privacyops.techd.io/admin/billing/status \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
6. Revoke old key in Stripe Dashboard after confirming new key works

### 5.5 Connector Credential Rotation

**Per-tenant, per-connector. Handled via admin UI or API.**

```bash
# Trigger re-authorization for a specific connector
curl -sf -X POST https://api.privacyops.techd.io/admin/connectors/{id}/reauthorize \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

For OAuth connectors, the refresh token is used to obtain new access tokens automatically. For API key connectors, the tenant admin must provide the new key.

---

## 6. Emergency Rotation

### 6.1 When to Invoke Emergency Rotation

- Secret found in application logs
- Secret committed to version control
- Secret exposed in error messages or stack traces
- Suspected unauthorized access to Vault or K8s secrets
- Compromised developer workstation with secret access
- Third-party breach affecting shared credentials

### 6.2 Emergency Rotation Procedure

**This is a P1 procedure. Engage Security On-Call before starting.**

1. **Identify scope:** Which secrets are compromised?
2. **Revoke immediately:** If possible, revoke the compromised credential at the provider level (e.g., revoke Stripe key, revoke OAuth token)
3. **Generate new secret:** Using the standard rotation procedure for that secret type
4. **Update Vault:** Write new secret version
5. **Force restart all affected services:** (not rolling -- simultaneous restart to minimize window)
   ```bash
   kubectl rollout restart deployment --all -n privacyops
   ```
6. **Verify:** All services healthy, no auth errors
7. **Audit:** Review Vault audit logs for unauthorized access
8. **Notify:** Per escalation matrix (Security On-Call > CISO > VP Engineering)
9. **Post-incident:** Document in incident timeline, update rotation schedule

### 6.3 Emergency: JWT_SECRET Compromised

If JWT_SECRET is compromised, an attacker can forge valid tokens for any tenant and user.

1. Immediately rotate JWT_SECRET (see 5.1)
2. Force restart all API pods simultaneously
3. Invalidate all active sessions in Redis:
   ```bash
   redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD keys "session:*" | xargs redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD del
   ```
4. All users must re-authenticate (expected)
5. Review audit logs for suspicious activity during the exposure window
6. Check for tenant boundary violations via RLS audit

### 6.4 Emergency: HMAC_SIGNING_KEY Compromised

If the HMAC key is compromised, an attacker could forge NATS events.

1. Immediately rotate HMAC_SIGNING_KEY
2. Pause all NATS consumers temporarily
3. Restart publishers with new key
4. Restart consumers with new key
5. Review DLQ for any events with invalid HMAC signatures that passed validation
6. Audit the event stream for forged events during the exposure window

---

## 7. Secret Hygiene Rules

### 7.1 Do NOT

- Store secrets in environment variables in Dockerfiles
- Commit secrets to Git (even in private repos)
- Log secrets at any log level (the logging pipeline redacts known patterns, but do not rely on this)
- Pass secrets as command-line arguments (visible in `/proc`)
- Store secrets in ConfigMaps (use Secrets with encryption at rest)
- Share secrets via Slack, email, or any unencrypted channel
- Use the same secret across environments (staging/production)
- Hardcode secrets in application code

### 7.2 DO

- Use Vault for all Critical and High secrets
- Use Kubernetes Secrets (synced from Vault) for pod injection
- Use IAM roles instead of static keys for AWS services
- Enable Vault audit logging for all secret access
- Use short-lived tokens (Vault dynamic secrets where possible)
- Encrypt all secrets at rest (K8s Secret encryption, EBS encryption)
- Monitor for secret exposure in logs via automated scanning
- Document all secret rotation in the operations changelog

### 7.3 Pre-Commit Secret Scanning

```bash
# .pre-commit-config.yaml includes secret detection
# Blocks commits containing patterns matching known secret formats
# Patterns: AWS keys, Stripe keys, JWT tokens, database URIs, private keys
```

CI/CD pipeline also runs secret scanning on every pull request. Any detection blocks the merge.

---

## 8. Vault Health and Availability

```bash
# Check Vault status
vault status

# Verify auto-unseal is functioning
vault status | grep "Sealed"
# Must show: Sealed: false

# Check Vault audit log is active
vault audit list
```

If Vault is sealed or unavailable:
1. The VSO cannot sync new secrets to Kubernetes
2. Existing K8s Secrets remain valid (pods continue running)
3. Secret rotation is blocked
4. New connector credential storage is blocked
5. Escalate as P2 (P1 if rotation is urgently needed)
