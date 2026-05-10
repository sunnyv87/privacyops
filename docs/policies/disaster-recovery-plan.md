# TechD PrivacyOps + DSPM Platform -- Disaster Recovery Plan

**Document ID:** TECHD-DRP-011
**Version:** 2.0
**Classification:** Internal -- Confidential
**Owner:** Platform Engineering Lead
**Effective Date:** 2026-05-10
**Review Cycle:** Annual (next review: 2027-05-10)

---

## 1. Purpose and Scope

This plan defines disaster recovery procedures for the TechD PrivacyOps + DSPM platform, covering catastrophic failure scenarios that exceed the scope of the Business Continuity Plan (TECHD-BCP-010). It addresses region-wide failures, data corruption, ransomware attacks, and cascading multi-component failures. The plan details per-component recovery procedures, backup verification, cross-region replication, and DR drill schedules.

---

## 2. DR Scenarios

### 2.1 Scenario Classification

| Scenario ID | Scenario | Severity | Estimated RTO | Trigger |
|-------------|----------|----------|---------------|---------|
| DR-01 | Cloud region failure | Critical | 4 hours | Cloud provider region outage |
| DR-02 | PostgreSQL data corruption | Critical | 2 hours | Storage failure, software bug, human error |
| DR-03 | Ransomware attack | Critical | 8 hours | Malicious encryption of platform data |
| DR-04 | NATS/Temporal cascading failure | High | 2 hours | Cluster-wide failure of event/workflow systems |
| DR-05 | Audit hash chain corruption | Critical | 4 hours | Data corruption or tampering in audit log |
| DR-06 | Multi-tenant data breach | Critical | 1 hour (containment) | RLS bypass, cross-tenant data exposure |
| DR-07 | Encryption key compromise | Critical | 4 hours | Key material exposure or theft |
| DR-08 | Third-party provider total failure | High | Variable | Anthropic, Stripe, or identity provider outage |

---

## 3. Cross-Region Replication Architecture

### 3.1 Replication Topology

```
Primary Region (Active)              DR Region (Standby)
+----------------------------+       +----------------------------+
| PostgreSQL Primary         | ----> | PostgreSQL Standby (async) |
| Redis Sentinel Cluster     | ----> | Redis Sentinel Cluster     |
| NATS JetStream Cluster     | ----> | NATS JetStream Cluster     |
| Temporal Cluster           | ----> | Temporal Cluster (passive) |
| NestJS API Instances       |       | NestJS API Instances (cold)|
| Object Storage (S3/Blob)   | ----> | Object Storage (replicated)|
| KMS Keys                   | ----> | KMS Keys (replicated)      |
+----------------------------+       +----------------------------+
```

### 3.2 Replication Lag Targets

| Component | Replication Type | Target Lag | Monitoring |
|-----------|-----------------|-----------|------------|
| PostgreSQL | Asynchronous streaming (cross-region) | < 30 seconds | WAL lag monitoring |
| Redis | Periodic RDB snapshot + AOF shipping | < 5 minutes | Snapshot age monitoring |
| NATS JetStream | Mirror streams (cross-region) | < 30 seconds | Stream lag monitoring |
| Temporal | Via PostgreSQL replication | < 30 seconds | Visibility lag monitoring |
| Object Storage | Provider-native cross-region replication | < 15 minutes | Replication status API |
| Audit Logs | Via PostgreSQL replication | < 30 seconds | Hash chain head comparison |

---

## 4. Recovery Procedures by Scenario

### 4.1 DR-01: Cloud Region Failure

**Detection:** Cloud provider status page, automated region health check failure (3 consecutive failures from external monitor).

**Recovery Procedure:**

1. **Declaration (T+0 min):** Incident commander declares DR activation. BREACH task queue workflow initiated.
2. **DNS Failover (T+5 min):** DNS records updated to point to DR region (TTL: 60 seconds, pre-configured).
3. **PostgreSQL Promotion (T+10 min):**
   - DR region standby promoted to primary.
   - Verify RLS enforcement on all 60 tables.
   - Verify audit hash chain continuity (compare last replicated hash with DR standby).
   - Accept data loss up to replication lag (< 30 seconds typical).
4. **Redis Activation (T+15 min):**
   - DR Redis cluster activated from latest snapshot.
   - Feature gate cache rebuilt from PostgreSQL.
   - Rate limiting counters reset (acceptable during DR).
5. **NATS Activation (T+20 min):**
   - DR NATS cluster activated from mirrored streams.
   - Verify HMAC signing key availability from KMS.
   - Consumers start from last acknowledged sequence.
6. **Temporal Activation (T+30 min):**
   - DR Temporal cluster activated with PostgreSQL persistence.
   - Workers deployed and connected to DR Temporal.
   - In-flight workflows resume from last checkpoint.
7. **API Deployment (T+45 min):**
   - NestJS API instances scaled up in DR region.
   - Health checks pass, traffic routed via updated DNS.
   - 7-layer guard pipeline operational.
8. **Verification (T+60 min):**
   - End-to-end smoke test: authenticate, create scan, verify audit log.
   - All 8 task queues accepting work.
   - Connector outbound access verified from DR region.
9. **Communication (T+30 min, parallel):**
   - Status page updated.
   - Tenant notification sent.
   - Regulatory assessment initiated (data loss scope).

**Estimated Total RTO:** 1-4 hours depending on region failure scope.

### 4.2 DR-02: PostgreSQL Data Corruption

**Detection:** Application errors, hash chain verification failure, Prisma query exceptions.

**Recovery Procedure:**

1. **Assessment (T+0 min):** Determine scope of corruption (single table, multiple tables, full database).
2. **Isolation (T+5 min):** Take affected database offline. API returns maintenance mode response.
3. **Corruption Scope Analysis:**

   **Option A -- Partial Corruption (single/few tables):**
   - Identify corrupted tables and affected tenant_ids.
   - Restore affected tables from the latest point-in-time recovery (PITR) snapshot.
   - Replay WAL from corruption point to latest consistent state.
   - Verify RLS policies on restored tables.
   - Rebuild audit hash chain for affected tenants from last known good hash.

   **Option B -- Full Database Corruption:**
   - Restore full database from latest PITR (RPO: continuous, up to the moment before corruption).
   - Verify all 60 RLS-protected tables.
   - Verify audit hash chain integrity for all tenants.
   - Verify Prisma migration state.

4. **Hash Chain Recovery:**
   - Compare audit log entries against external hash anchors (daily snapshots).
   - If chain is broken, mark the break point and start a new chain segment linked to the last verified anchor.
   - Document the chain discontinuity in a compliance incident record.

5. **Validation:**
   - Run full RLS verification suite on all 60 tables.
   - Run hash chain verification for all active tenants.
   - Verify legal hold enforcement (released_at, expires_at filters).
   - Run Prisma schema validation.

**Estimated RTO:** 1-2 hours (partial), 2-4 hours (full).

### 4.3 DR-03: Ransomware Attack

**Detection:** File encryption alerts, unusual process activity, ransom notification.

**Recovery Procedure:**

1. **Containment (T+0 min, IMMEDIATE):**
   - Isolate affected systems from network.
   - Revoke all service account credentials.
   - Disable all connector outbound access (prevent lateral movement to customer data sources).
   - Preserve forensic evidence (snapshots of affected volumes).

2. **Assessment (T+30 min):**
   - Determine scope: which components affected (DB, storage, containers, backups).
   - Verify backup integrity (backups stored in immutable/WORM storage are not affected).
   - Check if encryption keys in KMS are compromised.

3. **Recovery (T+1 hour):**
   - Deploy fresh infrastructure from infrastructure-as-code (no reuse of compromised instances).
   - Restore PostgreSQL from immutable backups (stored in separate account/subscription).
   - Restore Redis, NATS, Temporal from immutable backups.
   - Deploy application from verified container images (signed, from secure registry).
   - Rotate ALL credentials: database passwords, connector credentials, API keys, HMAC signing keys, JWT signing keys.

4. **Credential Rotation:**
   - New KMS master keys generated if compromise suspected.
   - All tenant DEKs re-encrypted with new KEK.
   - All connector credentials rotated via `rotate_credentials` remediation action.
   - All user sessions invalidated (refresh tokens revoked).
   - MFA secrets re-enrolled if TOTP seed database was compromised.

5. **Verification:**
   - Full security scan of recovered environment.
   - RLS enforcement on all 60 tables confirmed.
   - Audit hash chain verified against external anchors.
   - Penetration test of recovered environment before tenant traffic restoration.

6. **Communication:**
   - BREACH task queue workflow initiated for regulatory notification.
   - 72-hour GDPR notification if personal data affected.
   - Tenant-by-tenant impact assessment and notification.
   - Law enforcement notification as appropriate.

**Estimated RTO:** 4-8 hours (excluding forensic investigation).

### 4.4 DR-04: NATS/Temporal Cascading Failure

**Detection:** Event delivery failures, workflow execution timeouts, DLQ depth spike.

**Recovery Procedure:**

1. **NATS Recovery:**
   - If cluster unrecoverable: deploy fresh NATS cluster.
   - Restore JetStream streams from DR region mirrors or backups.
   - Verify HMAC signing key availability.
   - Consumers reconnect with last acknowledged sequence (idempotency keys prevent duplication).

2. **Temporal Recovery:**
   - If cluster unrecoverable: deploy fresh Temporal cluster.
   - Temporal state is in PostgreSQL; workflow history survives DB-level recovery.
   - Workers reconnect to new Temporal frontend.
   - All 8 task queues verified: SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION.

3. **DLQ Reconciliation:**
   - Examine DLQ for messages that failed during the incident.
   - Replay DLQ messages after verifying HMAC signatures.
   - Monitor for duplicate processing (idempotency keys should prevent issues).

**Estimated RTO:** 1-2 hours.

### 4.5 DR-05: Audit Hash Chain Corruption

**Detection:** Automated hash chain verification detects mismatched hashes.

**Recovery Procedure:**

1. **Freeze:** Stop audit writes for the affected tenant (advisory lock held).
2. **Analysis:** Identify the break point (sequence_id where hashes diverge).
3. **External Anchor Check:** Compare against external daily hash anchors.
4. **Reconstruction:**
   - If entries are intact but hashes wrong: recompute hashes from the last known good anchor.
   - If entries are missing or modified: restore from backup and recompute.
5. **Chain Restart:** Start a new chain segment from a verified anchor, documenting the discontinuity.
6. **Forensic Investigation:** Determine if corruption was accidental or malicious.
7. **Compliance Impact:** Document the incident for SOC 2 and ISO 27001 auditors.

**Estimated RTO:** 2-4 hours.

### 4.6 DR-06: Multi-Tenant Data Breach

**Detection:** RLS violation audit events, cross-tenant data in API responses, security researcher report.

**Recovery Procedure:**

1. **Containment (IMMEDIATE):**
   - Disable affected API endpoints.
   - Force logout all sessions (revoke all refresh tokens).
   - Enable enhanced logging on all API endpoints.
2. **Assessment:**
   - Determine which tenants are affected.
   - Analyze audit logs to determine data exposure scope.
   - Identify root cause (RLS bypass, application bug, infrastructure issue).
3. **Remediation:**
   - Deploy hotfix for the vulnerability.
   - Verify RLS policies on all 60 tables.
   - Run full RLS verification suite.
4. **Notification:**
   - BREACH workflow for each affected tenant.
   - Regulatory notifications per jurisdiction.
5. **Post-Incident:**
   - Penetration test focused on the vulnerability class.
   - Review all RLS-related code and Prisma queries.

**Estimated RTO:** 1 hour (containment), 4-24 hours (full remediation).

### 4.7 DR-07: Encryption Key Compromise

**Detection:** KMS audit logs showing unauthorized access, key material found in unauthorized location.

**Recovery Procedure:**

1. **Immediate Key Rotation:** Generate new master keys in KMS.
2. **Re-encryption:** Re-encrypt all DEKs with new KEK.
3. **Data Re-encryption:** Schedule re-encryption of all data encrypted with compromised keys.
4. **Token Invalidation:** Rotate JWT signing keys, invalidate all active tokens.
5. **HMAC Key Rotation:** Generate new NATS HMAC signing keys, retain old keys for DLQ reprocessing.
6. **Connector Credential Re-encryption:** Re-encrypt all stored connector credentials.
7. **Assessment:** Determine if any encrypted data was accessed during the compromise window.

**Estimated RTO:** 2-4 hours (key rotation), 24-72 hours (full re-encryption).

---

## 5. Backup Strategy

### 5.1 Backup Schedule

| Component | Backup Type | Frequency | Retention | Storage Location |
|-----------|------------|-----------|-----------|-----------------|
| PostgreSQL | PITR (continuous WAL) | Continuous | 30 days | Cross-region immutable storage |
| PostgreSQL | Full snapshot | Daily | 90 days | Cross-region immutable storage |
| PostgreSQL | Monthly archive | Monthly | 1 year | Cold storage (Glacier/Archive) |
| Redis | RDB snapshot | Every 5 minutes | 7 days | Cross-region storage |
| NATS JetStream | Stream mirror | Continuous | Matches stream retention | DR region NATS cluster |
| Temporal | Via PostgreSQL backup | Continuous | Matches PostgreSQL retention | Via PostgreSQL backup |
| Encryption Keys | KMS replication | Continuous | Permanent | Cross-region KMS |
| Application Config | Git repository | On change | Permanent | Git provider |
| Infrastructure Config | IaC repository | On change | Permanent | Git provider |

### 5.2 Backup Verification

| Verification Type | Frequency | Procedure |
|-------------------|-----------|-----------|
| PostgreSQL restore test | Monthly | Restore latest backup to isolated environment, verify RLS and hash chain |
| Redis restore test | Quarterly | Restore snapshot, verify data integrity |
| Full DR environment build | Semi-annually | Build complete platform from backups, run smoke tests |
| Backup encryption verification | Monthly | Verify all backups are encrypted with current keys |
| Immutability verification | Monthly | Attempt to modify/delete backup (should fail) |

### 5.3 Immutable Backup Requirements

- All backups stored in WORM (Write Once Read Many) or immutable storage.
- Backup deletion requires a separate, heavily restricted administrative credential.
- Backup storage account in a separate cloud account/subscription from production.
- Backup encryption keys stored in a separate KMS instance from production keys.

---

## 6. DR Drill Schedule

| Drill Type | Frequency | Duration | Participants |
|-----------|-----------|----------|-------------|
| Tabletop walkthrough | Quarterly | 2 hours | Engineering leads, CISO, DPO |
| PostgreSQL failover to DR | Semi-annually | 4 hours | Platform Engineering, Database team |
| Full DR activation (controlled) | Annually | Full day | All engineering, CISO, communications |
| Ransomware simulation | Annually | Full day | Security Engineering, Platform Engineering, CISO |
| Audit chain recovery drill | Semi-annually | 2 hours | Security Engineering |
| Backup restoration drill | Monthly | 2 hours | Platform Engineering |

### 6.1 Drill Success Criteria

| Criterion | Target |
|-----------|--------|
| DR region fully operational within documented RTO | 100% |
| All 60 RLS-protected tables enforcing isolation in DR | 100% |
| Audit hash chain continuous or documented discontinuity | 100% |
| All 8 Temporal task queues processing in DR | 100% |
| NATS event delivery resumed with no message loss | 100% |
| Connector outbound access functional from DR region | > 95% |
| Authentication pipeline (all 7 layers) operational | 100% |

### 6.2 Post-Drill Requirements

- Drill report produced within 5 business days.
- All findings tracked as remediation items with owners and deadlines.
- DR plan updated with lessons learned within 10 business days.
- Next drill date confirmed.

---

## 7. Runbook References

| Runbook | Location | Covers |
|---------|----------|--------|
| PostgreSQL DR Failover | `runbooks/dr-postgresql-failover.md` | Step-by-step DB promotion, RLS verification |
| Redis DR Recovery | `runbooks/dr-redis-recovery.md` | Sentinel failover, snapshot restore |
| NATS DR Recovery | `runbooks/dr-nats-recovery.md` | Cluster rebuild, stream mirror activation |
| Temporal DR Recovery | `runbooks/dr-temporal-recovery.md` | Cluster recovery, worker redeployment |
| Full DR Activation | `runbooks/dr-full-activation.md` | End-to-end DR activation checklist |
| Ransomware Response | `runbooks/dr-ransomware-response.md` | Containment, evidence preservation, recovery |
| Hash Chain Recovery | `runbooks/dr-hash-chain-recovery.md` | Chain verification, reconstruction, anchoring |
| Key Compromise Response | `runbooks/dr-key-compromise.md` | Key rotation, re-encryption procedures |
| DNS Failover | `runbooks/dr-dns-failover.md` | DNS record updates, TTL management |
| Post-DR Validation | `runbooks/dr-post-validation.md` | Comprehensive post-recovery checklist |

---

## 8. DR Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Incident Commander | DR declaration, overall coordination, communication approval |
| Platform Engineering Lead | Infrastructure recovery execution |
| Database Lead | PostgreSQL recovery, RLS verification, hash chain validation |
| Security Engineering Lead | Security control verification, key rotation, forensics |
| CISO | Regulatory notification decisions, executive communication |
| DPO | Data breach assessment, GDPR Article 33/34 notification |
| Communications Lead | Tenant notification, status page updates, regulatory submissions |

---

## 9. Related Documents

| Document | ID |
|----------|----|
| Information Security Policy | TECHD-ISP-001 |
| Encryption Standards | TECHD-ENC-003 |
| Audit Logging Policy | TECHD-ALP-005 |
| Business Continuity Plan | TECHD-BCP-010 |
| Compliance Matrix | TECHD-CM-012 |

---

## 10. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Platform Engineering Lead | Initial release |
| 2.0 | 2026-05-10 | Platform Engineering Lead | Added ransomware scenario, hash chain recovery, key compromise response, cross-region replication details, immutable backup requirements, expanded drill schedule |

---

*This document is the property of TechD, Inc. Unauthorized distribution is prohibited.*
