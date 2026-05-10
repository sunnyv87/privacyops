# TechD PrivacyOps + DSPM Platform -- Encryption Standards

**Document ID:** TECHD-ENC-003
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Security Engineering Lead
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This document defines encryption standards for the TechD PrivacyOps + DSPM platform across all layers: data at rest, data in transit, application-level cryptographic operations, and key management. These standards apply to the platform's core infrastructure, all 43 registered connectors, and the data flowing through the Temporal workflow engine and NATS JetStream event bus.

---

## 2. Approved Cryptographic Algorithms

### 2.1 Symmetric Encryption

| Algorithm | Key Size | Use Case | Status |
|-----------|----------|----------|--------|
| AES-256-GCM | 256-bit | Data at rest, field-level encryption | Approved |
| AES-256-CBC | 256-bit | Legacy compatibility only | Approved (deprecation planned) |
| ChaCha20-Poly1305 | 256-bit | Alternative where AES-NI unavailable | Approved |

### 2.2 Asymmetric Encryption

| Algorithm | Key Size | Use Case | Status |
|-----------|----------|----------|--------|
| RSA | 4096-bit | JWT signing (legacy), certificate operations | Approved |
| ECDSA (P-256, P-384) | 256/384-bit | JWT signing (preferred), TLS certificates | Approved |
| Ed25519 | 256-bit | Internal service authentication | Approved |

### 2.3 Hash Functions

| Algorithm | Use Case | Status |
|-----------|----------|--------|
| SHA-256 | Audit log hash chain, HMAC signing | Approved |
| SHA-384 | TLS cipher suites | Approved |
| SHA-512 | Password hashing (with bcrypt/argon2) | Approved |
| bcrypt (cost 12+) | User password storage | Approved |
| Argon2id | User password storage (preferred) | Approved |
| MD5 | Prohibited for all security purposes | Prohibited |
| SHA-1 | Prohibited for all security purposes | Prohibited |

### 2.4 HMAC

| Algorithm | Use Case | Status |
|-----------|----------|--------|
| HMAC-SHA256 | NATS JetStream event signing, webhook verification | Approved |
| HMAC-SHA512 | API request signing (external integrations) | Approved |

---

## 3. Encryption at Rest

### 3.1 PostgreSQL Database

**Method:** Transparent Data Encryption (TDE) at the storage layer.

- All PostgreSQL volumes use dm-crypt/LUKS with AES-256-XTS.
- Prisma ORM connection strings enforce `sslmode=verify-full`.
- Sensitive columns (connector credentials, API keys, MFA secrets from otplib) use application-level AES-256-GCM encryption before storage.
- Encryption keys for column-level encryption are stored in an external key management service, never in the database.
- Backup encryption: all pg_dump outputs encrypted with AES-256-GCM before storage.

### 3.2 Redis Cache

- Redis persistence files (RDB/AOF) stored on encrypted volumes (AES-256-XTS).
- TLS required for all Redis connections (`tls: true` in connection config).
- Sensitive cached data (session tokens, temporary DSAR payloads) have TTL limits and are encrypted at the application layer before caching.

### 3.3 Connector-Specific Encryption at Rest

| Connector | Encryption Method | Key Management | Platform Verification |
|-----------|------------------|----------------|----------------------|
| aws_s3 | SSE-S3 (AES-256) or SSE-KMS | AWS KMS | SCAN queue checks `ServerSideEncryption` header |
| azure_blob | Azure Storage Service Encryption (AES-256) | Azure Key Vault | SCAN queue checks encryption properties |
| gcp_storage | Google-managed or CMEK (AES-256-GCM) | Cloud KMS | SCAN queue checks bucket encryption config |
| snowflake | AES-256-GCM (automatic, always-on) | Snowflake-managed, tri-secret secure option | Verified via account parameters |
| bigquery | Google-managed AES-256 or CMEK | Cloud KMS | Verified via dataset encryption config |
| postgresql | TDE / volume encryption | Provider-managed or CMEK | Connection test validates SSL |
| mysql | InnoDB tablespace encryption (AES-256) | keyring plugin | Connection test validates SSL |
| sqlserver | TDE (AES-256) | SQL Server certificate hierarchy | Connection test validates encryption |
| mongodb | WiredTiger encryption at rest | KMIP or local keyfile | Connection test validates TLS |
| salesforce | Platform encryption (AES-256) | Salesforce Shield | API query checks encryption status |
| okta | Platform-managed encryption | Okta-managed | N/A (SaaS provider responsibility) |

### 3.4 Encryption Enforcement via RemediationExecutorService

The `enforce_encryption` action type in the RemediationExecutorService can be triggered when the SCAN queue detects unencrypted data in connected sources:

- **Native mode:** Enables encryption directly on the connector (e.g., enables SSE on an S3 bucket).
- **Catalog update mode:** Flags the asset as non-compliant in the data catalog when native enforcement is unavailable.
- **Unsupported mode:** Generates a remediation ticket for manual intervention.

---

## 4. Encryption in Transit

### 4.1 TLS Configuration

**Minimum Version:** TLS 1.2 (TLS 1.3 preferred where supported).

**Approved Cipher Suites (TLS 1.3):**
- TLS_AES_256_GCM_SHA384
- TLS_CHACHA20_POLY1305_SHA256
- TLS_AES_128_GCM_SHA256

**Approved Cipher Suites (TLS 1.2):**
- ECDHE-ECDSA-AES256-GCM-SHA384
- ECDHE-RSA-AES256-GCM-SHA384
- ECDHE-ECDSA-AES128-GCM-SHA256
- ECDHE-RSA-AES128-GCM-SHA256

**Prohibited:**
- SSLv2, SSLv3, TLS 1.0, TLS 1.1
- RC4, DES, 3DES, NULL ciphers
- Static RSA key exchange (no forward secrecy)

### 4.2 Platform Component TLS Requirements

| Component | TLS Requirement | Certificate Type |
|-----------|----------------|-----------------|
| NestJS API (external) | TLS 1.2+ mandatory | Public CA (Let's Encrypt or commercial) |
| NestJS API (internal) | TLS 1.2+ mandatory | Internal CA |
| PostgreSQL connections | `sslmode=verify-full` | Internal CA |
| Redis connections | TLS 1.2+ mandatory | Internal CA |
| NATS JetStream | TLS 1.2+ mandatory | Internal CA with mutual TLS |
| Temporal server | TLS 1.2+ mandatory | Internal CA with mutual TLS |
| Connector outbound | TLS 1.2+ mandatory | Validated against public CAs |
| Anthropic Claude API | TLS 1.3 (provider-enforced) | Anthropic CA |
| Stripe API | TLS 1.2+ (provider-enforced) | Stripe CA |
| SAML/OIDC endpoints | TLS 1.2+ mandatory | Per IdP configuration |

### 4.3 HTTP Security Headers (Helmet)

The platform uses Helmet middleware to enforce:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (CSP preferred over X-XSS-Protection)
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 5. Application-Level Encryption

### 5.1 NATS JetStream Event Signing

All messages published to NATS JetStream are signed using HMAC-SHA256:

- **Signing key:** Per-tenant signing key derived from a master key via HKDF.
- **Signed payload:** Message body + timestamp + sequence number + tenant_id.
- **Signature header:** Attached as `X-HMAC-Signature` in NATS message headers.
- **Verification:** All consumers verify HMAC before processing. Invalid signatures route to DLQ.
- **Key rotation:** Signing keys rotated quarterly. Old keys retained for 90 days for DLQ reprocessing.

### 5.2 SHA256 Hash Chain for Audit Logging

The audit logging system uses a SHA256 hash chain for tamper evidence:

- Each audit entry includes: `hash = SHA256(previous_hash + event_data + timestamp + sequence_id)`.
- Postgres advisory locks ensure sequential hash chain integrity during concurrent writes.
- Hash chain verification runs on a configurable schedule (default: hourly).
- Chain breaks are reported as SEV-1 security incidents.

### 5.3 JWT Token Encryption

- Access tokens signed with ECDSA (ES256) using rotating key pairs.
- Refresh tokens encrypted with AES-256-GCM before storage.
- Token signing key rotation: every 24 hours with 48-hour overlap for graceful transition.

### 5.4 Connector Credential Encryption

- All connector credentials (OAuth tokens, API keys, database passwords) encrypted with AES-256-GCM before storage in PostgreSQL.
- Envelope encryption: data encryption key (DEK) encrypted by a key encryption key (KEK) from the key management service.
- Credentials decrypted only at the moment of connector use, held in memory for the duration of the operation, then zeroed.

### 5.5 MFA Secret Encryption

- TOTP secrets generated by otplib are encrypted with AES-256-GCM before storage.
- QR code generation occurs in-memory; QR code images are never persisted.
- Recovery codes are hashed with bcrypt (cost 12) and stored; plaintext shown once at generation.

---

## 6. Key Management

### 6.1 Key Hierarchy

```
Root Key (HSM-protected)
 |
 +-- Master Encryption Key (KEK)
 |    |
 |    +-- Tenant Data Encryption Keys (DEKs)
 |    +-- Connector Credential DEKs
 |    +-- MFA Secret DEKs
 |
 +-- Master Signing Key
 |    |
 |    +-- JWT Signing Key Pairs (rotating)
 |    +-- NATS HMAC Signing Keys (per-tenant)
 |    +-- Audit Hash Chain Keys
 |
 +-- TLS Certificate Private Keys
```

### 6.2 Key Lifecycle

| Key Type | Rotation Period | Retention After Rotation | Storage |
|----------|----------------|------------------------|---------|
| Root Key | Annual | Permanent (archived) | HSM |
| Master KEK | Semi-annual | 1 year | KMS |
| Tenant DEKs | Quarterly | 1 year | KMS (encrypted by KEK) |
| JWT Signing Keys | 24 hours | 48 hours (overlap) | KMS |
| NATS HMAC Keys | Quarterly | 90 days | KMS (encrypted by KEK) |
| TLS Certificates | Annual (90-day for Let's Encrypt) | Until expiry | Certificate store |

### 6.3 Key Compromise Response

If a key compromise is suspected:

1. Immediate rotation of the compromised key.
2. Re-encryption of all data protected by the compromised key.
3. Revocation of all tokens signed with the compromised key.
4. Incident logged in audit chain and escalated per TECHD-ISP-001 incident procedures.
5. BREACH task queue workflow initiated for data breach assessment.

---

## 7. Per-Connector Encryption Capability Matrix

| Connector | enforce_encryption | encrypt (data) | Native Support |
|-----------|--------------------|----------------|----------------|
| aws_s3 | native | native | SSE-S3, SSE-KMS, SSE-C |
| azure_blob | native | native | Azure SSE, client-side |
| gcp_storage | native | native | Google-managed, CMEK |
| snowflake | unsupported (always-on) | unsupported (always-on) | Built-in AES-256 |
| bigquery | native (CMEK) | unsupported (always-on) | Google-managed, CMEK |
| postgresql | catalog_update | catalog_update | TDE (provider-dependent) |
| mysql | catalog_update | catalog_update | InnoDB encryption |
| sqlserver | catalog_update | catalog_update | TDE |
| mongodb | catalog_update | catalog_update | WiredTiger encryption |
| salesforce | unsupported | unsupported | Salesforce Shield |
| okta | unsupported | unsupported | Provider-managed |

---

## 8. Compliance Mapping

| Standard | Encryption Requirement | Platform Control |
|----------|----------------------|-----------------|
| GDPR Art. 32 | Encryption of personal data | AES-256 at rest + TLS 1.2+ in transit |
| HIPAA 164.312(a)(2)(iv) | Encryption of ePHI | AES-256 + column-level encryption for PHI |
| PCI DSS 3.4 | Render PAN unreadable | AES-256-GCM field-level encryption |
| PCI DSS 4.1 | Strong cryptography in transit | TLS 1.2+ with approved cipher suites |
| SOC 2 CC6.1 | Logical access + encryption | Full key hierarchy + TLS + at-rest encryption |
| ISO 27001 A.10 | Cryptographic controls | This document (TECHD-ENC-003) |

---

## 9. Prohibited Practices

- Storing encryption keys in application source code, environment variables (without vault backing), or configuration files.
- Using deprecated algorithms (MD5, SHA-1, RC4, DES, 3DES) for any security purpose.
- Disabling TLS verification for connector outbound connections in production.
- Transmitting unencrypted PII, PHI, or PCI data over any network.
- Hardcoding HMAC signing keys in NATS publisher or consumer code.
- Using the same encryption key for multiple tenants without key derivation.

---

## 10. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Data Classification Policy | TECHD-DCP-002 |
| Access Control Policy | TECHD-ACP-004 |
| Audit Logging Policy | TECHD-ALP-005 |
| Compliance Matrix | TECHD-CM-012 |

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Security Engineering Lead | Initial release |
| 2.0 | 2026-05-10 | Security Engineering Lead | Added per-connector encryption matrix, NATS HMAC details, MFA encryption, AI co-pilot data handling, key hierarchy diagram |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
