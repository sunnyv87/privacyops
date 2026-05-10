# TechD PrivacyOps + DSPM Platform -- Audit Logging Policy

**Document ID:** TECHD-ALP-005
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Security Engineering Lead
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This policy defines the audit logging framework for the TechD PrivacyOps + DSPM platform, including the SHA256 hash chain design, Postgres advisory lock mechanism, log event taxonomy, retention requirements, tamper detection procedures, and compliance evidence generation. It applies to all platform components, user actions, system events, and data access operations.

---

## 2. Audit Logging Architecture

### 2.1 Design Principles

- **Tamper Evidence:** SHA256 hash chain ensures any modification to historical log entries is detectable.
- **Sequential Integrity:** Postgres advisory locks guarantee strict ordering of audit events.
- **Completeness:** All security-relevant events are logged without exception.
- **Immutability:** Audit log entries are append-only; no UPDATE or DELETE operations are permitted on the audit table.
- **Tenant Isolation:** Audit logs are scoped by tenant_id and protected by RLS.
- **Non-Repudiation:** Audit entries include authenticated user identity, timestamp, and cryptographic chain linkage.

### 2.2 SHA256 Hash Chain Design

Each audit log entry contains a cryptographic hash that chains it to the previous entry:

```
hash_n = SHA256(hash_{n-1} || tenant_id || event_type || actor_id || resource_id || action || timestamp || sequence_id || payload_hash)
```

**Chain Components:**
| Component | Description |
|-----------|-------------|
| `hash_{n-1}` | SHA256 hash of the previous audit entry (genesis entry uses a configured seed) |
| `tenant_id` | UUID of the tenant (ensures cross-tenant chain independence) |
| `event_type` | Categorical event type from the taxonomy (Section 4) |
| `actor_id` | UUID of the user or service account that triggered the event |
| `resource_id` | Identifier of the affected resource |
| `action` | Specific action performed |
| `timestamp` | ISO 8601 timestamp with microsecond precision |
| `sequence_id` | Monotonically increasing sequence number per tenant chain |
| `payload_hash` | SHA256 hash of the full event payload (stored separately for large payloads) |

### 2.3 Per-Tenant Chain Isolation

Each tenant maintains an independent hash chain. This design ensures:

- Tenant A's audit integrity is not affected by operations in Tenant B.
- Chain verification can be performed per-tenant without scanning the entire audit table.
- RLS enforcement prevents cross-tenant chain access.
- The genesis hash for each tenant chain is generated at tenant provisioning and stored in the tenant configuration.

---

## 3. Postgres Advisory Lock Mechanism

### 3.1 Purpose

PostgreSQL advisory locks ensure that audit log entries are written sequentially within each tenant's hash chain, preventing race conditions that would break chain integrity.

### 3.2 Implementation

1. **Lock Acquisition:** Before writing an audit entry, the service acquires a Postgres advisory lock keyed on the tenant_id hash: `pg_advisory_xact_lock(hashtext(tenant_id))`.
2. **Previous Hash Retrieval:** Within the lock, the service reads the hash of the most recent entry for the tenant.
3. **Hash Computation:** The new entry's hash is computed using the previous hash and the current event data.
4. **Entry Write:** The audit entry (including computed hash and incremented sequence_id) is inserted.
5. **Lock Release:** The advisory lock is automatically released at transaction commit.

### 3.3 Performance Considerations

- Advisory locks are transaction-scoped (`pg_advisory_xact_lock`), not session-scoped, to prevent lock leaks.
- Lock contention is bounded per-tenant; cross-tenant audit writes are fully parallel.
- High-throughput tenants may experience audit write serialization; this is an accepted tradeoff for chain integrity.
- Batch audit writes (e.g., SCAN results) use a single lock acquisition for the batch, computing intermediate hashes in-memory.

---

## 4. Audit Event Taxonomy

### 4.1 Authentication Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `auth.login.success` | Successful user authentication | Info |
| `auth.login.failure` | Failed authentication attempt | Warning |
| `auth.login.mfa_challenge` | MFA challenge issued | Info |
| `auth.login.mfa_success` | MFA verification passed | Info |
| `auth.login.mfa_failure` | MFA verification failed | Warning |
| `auth.logout` | User logout | Info |
| `auth.token.refresh` | Token refresh operation | Info |
| `auth.token.revoke` | Token revocation | Info |
| `auth.account.locked` | Account locked due to failed attempts | Warning |
| `auth.saml.assertion` | SAML assertion processed | Info |
| `auth.oidc.callback` | OIDC callback processed | Info |

### 4.2 Authorization Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `authz.guard.csrf_rejected` | CSRF validation failed | Warning |
| `authz.guard.jwt_rejected` | JWT validation failed | Warning |
| `authz.guard.tenant_rejected` | Tenant validation failed | Warning |
| `authz.guard.permission_denied` | RBAC permission check failed | Warning |
| `authz.guard.feature_gate_blocked` | Feature gate check failed | Info |
| `authz.guard.abac_denied` | ABAC policy evaluation denied | Warning |
| `authz.guard.approval_required` | Operation requires approval | Info |
| `authz.guard.approval_granted` | Approval workflow completed | Info |
| `authz.guard.approval_denied` | Approval workflow denied | Warning |

### 4.3 Data Access Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `data.read` | Data read operation | Info |
| `data.create` | Data creation | Info |
| `data.update` | Data modification | Info |
| `data.delete` | Data deletion | Warning |
| `data.export` | Data export/download | Warning |
| `data.classification.change` | Data classification modified | Warning |
| `data.classification.override` | Manual classification override | Warning |

### 4.4 DSAR Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `dsar.request.created` | New DSAR request submitted | Info |
| `dsar.request.processing` | DSAR processing started | Info |
| `dsar.request.completed` | DSAR processing completed | Info |
| `dsar.redaction.success` | PII redaction succeeded | Info |
| `dsar.redaction.failed` | PII redaction failed (fail-closed) | Critical |
| `dsar.download.blocked` | Download blocked due to redaction failure | Critical |
| `dsar.export.generated` | DSAR export package generated | Info |

### 4.5 Connector Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `connector.created` | New connector registered | Info |
| `connector.updated` | Connector configuration changed | Info |
| `connector.deleted` | Connector removed | Warning |
| `connector.scan.started` | Scan initiated | Info |
| `connector.scan.completed` | Scan completed | Info |
| `connector.scan.failed` | Scan failed | Warning |
| `connector.credential.rotated` | Credential rotation performed | Info |
| `connector.credential.accessed` | Credential viewed/used | Warning |

### 4.6 Remediation Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `remediation.action.initiated` | Remediation action started | Info |
| `remediation.action.completed` | Remediation action succeeded | Info |
| `remediation.action.failed` | Remediation action failed | Warning |
| `remediation.revoke_access` | Access revocation executed | Warning |
| `remediation.delete_data` | Data deletion executed | Critical |
| `remediation.rotate_credentials` | Credential rotation executed | Warning |
| `remediation.enforce_encryption` | Encryption enforcement executed | Info |

### 4.7 System Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `system.workflow.started` | Temporal workflow initiated | Info |
| `system.workflow.completed` | Temporal workflow completed | Info |
| `system.workflow.failed` | Temporal workflow failed | Warning |
| `system.event.dlq` | NATS event routed to DLQ | Warning |
| `system.event.hmac_invalid` | HMAC signature validation failed | Critical |
| `system.circuit_breaker.open` | Circuit breaker opened (e.g., AI co-pilot) | Warning |
| `system.circuit_breaker.close` | Circuit breaker closed | Info |
| `system.hash_chain.break` | Hash chain integrity violation detected | Critical |
| `system.rls.violation` | RLS policy violation detected | Critical |

### 4.8 Legal Hold Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `legal_hold.created` | Legal hold placed | Info |
| `legal_hold.released` | Legal hold released | Warning |
| `legal_hold.deletion_blocked` | Deletion blocked by legal hold | Warning |
| `legal_hold.expired` | Legal hold expired automatically | Info |

### 4.9 AI Co-pilot Events

| Event Type | Description | Severity |
|------------|-------------|----------|
| `ai.request.sent` | Request sent to Anthropic Claude | Info |
| `ai.request.redacted` | PII redacted from AI request | Info |
| `ai.redaction.failed` | PII redaction failed (request blocked) | Critical |
| `ai.circuit_breaker.triggered` | AI circuit breaker activated (5 failures/60s) | Warning |
| `ai.response.received` | Response received from AI | Info |

---

## 5. Log Retention Periods

| Log Category | Retention Period | Justification |
|-------------|-----------------|---------------|
| Authentication events | 3 years | SOC 2 + regulatory compliance |
| Authorization events | 3 years | SOC 2 + regulatory compliance |
| Data access events (PII/PHI/PCI) | 6 years | HIPAA (6 years) + GDPR accountability |
| DSAR events | 6 years | GDPR accountability (Art. 5(2)) |
| Connector events | 3 years | Operational + compliance |
| Remediation events | 6 years | Evidence of compliance actions |
| System events | 1 year | Operational monitoring |
| Legal hold events | Duration of hold + 7 years | Legal requirement |
| AI co-pilot events | 3 years | AI governance + compliance |
| Hash chain verification logs | 3 years | Tamper evidence |

---

## 6. Tamper Detection

### 6.1 Automated Hash Chain Verification

- **Frequency:** Configurable schedule (default: hourly per tenant).
- **Process:** Sequential verification of hash chain from genesis to latest entry.
- **Alert:** Chain break triggers `system.hash_chain.break` event (Critical severity).
- **Response:** SEV-1 incident automatically created. Affected tenant chain frozen pending investigation.

### 6.2 Verification Procedure

1. Retrieve all entries for the tenant ordered by sequence_id.
2. For each entry, recompute the hash using the stored fields and the previous entry's hash.
3. Compare the recomputed hash to the stored hash.
4. Any mismatch indicates tampering at the mismatched entry or between it and the previous entry.
5. Report: entry sequence_id, expected hash, actual hash, timestamp range of potential tampering.

### 6.3 External Hash Anchoring

- Daily hash chain heads (latest hash per tenant) are exported to an external immutable store.
- Provides independent verification point beyond the platform's own database.
- External anchors are signed with a key not accessible to the application database user.

---

## 7. Compliance Evidence Generation

### 7.1 Automated Evidence Collection

The platform generates compliance evidence packages by querying the audit log:

| Regulation | Evidence Type | Query Pattern |
|-----------|---------------|---------------|
| GDPR Art. 30 | Processing activity records | `data.*` events grouped by processing purpose |
| GDPR Art. 33 | Breach notification evidence | `system.workflow.*` events for BREACH queue |
| HIPAA 164.312 | Access audit trail for ePHI | `data.*` events for PHI-classified resources |
| SOC 2 CC7.2 | Security event monitoring | All Warning/Critical severity events |
| PCI DSS 10.1 | User access to cardholder data | `data.*` events for PCI-classified resources |
| ISO 27001 A.12.4 | Event logging evidence | Full audit log export with hash chain verification |

### 7.2 Evidence Export Format

- Exports include the hash chain for tamper verification.
- Format: JSON Lines with embedded hash chain metadata.
- Exports are signed with the platform's evidence signing key.
- Export events themselves are logged (`data.export` event type).

---

## 8. Log Shipping and Integration

### 8.1 Real-Time Streaming

- Critical and Warning severity events are streamed via NATS JetStream to external SIEM.
- Events are HMAC-signed for integrity during transit.
- Delivery uses NATS JetStream's at-least-once semantics with idempotency keys.

### 8.2 Batch Export

- Daily batch exports of all audit events for long-term archival.
- Exports encrypted with AES-256-GCM before storage.
- Stored in tenant-isolated paths in the archival storage system.

### 8.3 SIEM Integration

- Structured JSON log format compatible with major SIEM platforms (Splunk, Elastic, Datadog, Sentinel).
- Common Event Format (CEF) mapping available for legacy SIEM integration.
- Webhook delivery option for tenant-managed SIEM endpoints.

---

## 9. Access to Audit Logs

- Audit log read access requires `audit_log:read` permission (granted to `security_admin`, `compliance_officer`, `tenant_owner` roles).
- Audit log export requires `audit_log:export` permission and may trigger the Approval Guard.
- No role has write, update, or delete access to audit logs.
- Platform administrators access audit logs through a separate, independently audited interface.

---

## 10. Audit Log Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique entry identifier |
| `tenant_id` | UUID | Tenant scope |
| `sequence_id` | BIGINT | Per-tenant monotonic sequence |
| `hash` | VARCHAR(64) | SHA256 hash (hex-encoded) |
| `previous_hash` | VARCHAR(64) | Previous entry's hash |
| `event_type` | VARCHAR(100) | Event type from taxonomy |
| `severity` | ENUM | Info, Warning, Critical |
| `actor_id` | UUID | User or service account ID |
| `actor_type` | ENUM | user, service_account, system |
| `resource_type` | VARCHAR(100) | Type of affected resource |
| `resource_id` | VARCHAR(255) | Affected resource identifier |
| `action` | VARCHAR(100) | Specific action performed |
| `payload` | JSONB | Full event payload |
| `payload_hash` | VARCHAR(64) | SHA256 of payload |
| `ip_address` | INET | Source IP address |
| `user_agent` | TEXT | Client user agent |
| `timestamp` | TIMESTAMPTZ | Event timestamp (microseconds) |
| `created_at` | TIMESTAMPTZ | Database insert timestamp |

---

## 11. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Access Control Policy | TECHD-ACP-004 |
| Data Retention Policy | TECHD-DRP-006 |
| Compliance Matrix | TECHD-CM-012 |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Security Engineering Lead | Initial release |
| 2.0 | 2026-05-10 | Security Engineering Lead | Added hash chain design details, advisory lock mechanism, AI co-pilot events, legal hold events, external anchoring, SIEM integration |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
