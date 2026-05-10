# SOP-006: Backup & Recovery

**Document ID:** SOP-PRIVACYOPS-BR-006
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Infrastructure Lead

---

## 1. Purpose

Define the procedures for backing up and recovering all stateful components of the TechD PrivacyOps platform, including PostgreSQL databases, Redis caches, NATS JetStream streams, and Temporal workflow state. This SOP ensures data recoverability within defined RTO/RPO targets across all tenant data, audit logs, configuration, and operational state.

## 2. Scope

Covers backup and recovery for:
- **PostgreSQL**: All application tables (tenants, users, data_sources, audit_logs, dsar_requests, incidents, etc.), Prisma migrations, RLS policies
- **Redis**: Session cache, rate limiting state, feature gate cache, co-pilot circuit breaker state
- **NATS JetStream**: `PRIVACYOPS` event stream, `PRIVACYOPS_DLQ` dead letter queue, consumer state
- **Temporal**: Workflow execution history, scheduled jobs, activity state across 8 task queues
- **Application Configuration**: Environment variables, secrets, Helm values
- **Encryption Keys**: Tenant encryption keys referenced by `encryptionKeyId`
- **Connector Credentials**: Encrypted credentials stored in `data_sources.credentials`

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Infrastructure Lead | Owns backup strategy, RTO/RPO compliance |
| Database Administrator | PostgreSQL backup operations, recovery testing |
| Platform Engineer | Redis, NATS, Temporal backup coordination |
| Security Engineer | Encryption key backup, credential recovery |
| On-Call Engineer | Emergency recovery execution |
| Compliance Officer | Audit trail preservation verification |

## 4. Prerequisites

- PostgreSQL backup infrastructure: pg_dump, WAL archiving, pg_basebackup configured
- S3-compatible object storage for backup destination (encrypted at rest)
- Redis persistence configured (RDB snapshots + AOF)
- NATS CLI and JetStream management access
- Temporal admin tools (tctl) access
- Backup encryption key stored in hardware security module (HSM) or AWS KMS
- Backup monitoring alerts configured in Prometheus
- Recovery runbooks tested within last quarter

## 5. Procedure

### 5.1 RTO/RPO Targets

1. **Recovery Objectives**

   | Component | RPO (Max Data Loss) | RTO (Max Downtime) | Backup Frequency |
   |-----------|-------------------|-------------------|-----------------|
   | PostgreSQL (application data) | 1 hour | 4 hours | Continuous WAL + daily full |
   | PostgreSQL (audit_logs) | 0 (zero data loss) | 2 hours | Synchronous WAL streaming |
   | Redis | 24 hours (reconstructable) | 30 minutes | 6-hour RDB snapshots |
   | NATS JetStream | 1 hour | 1 hour | Continuous replication + 4-hour snapshots |
   | Temporal | 4 hours | 2 hours | 4-hour state export |
   | Encryption keys | 0 (zero data loss) | 1 hour | Real-time KMS replication |
   | Connector credentials | 0 (zero data loss) | 1 hour | Included in PostgreSQL backup |

### 5.2 PostgreSQL Backup

2. **Continuous WAL Archiving**
   2.1. Configure WAL archiving in `postgresql.conf`:
        ```
        wal_level = replica
        archive_mode = on
        archive_command = 'aws s3 cp %p s3://privacyops-backups/wal/%f --sse aws:kms'
        archive_timeout = 300
        ```
   2.2. WAL segments archived to encrypted S3 bucket every 5 minutes (or on segment completion)
   2.3. Monitor WAL archiving lag: `pg_stat_archiver.last_archived_wal`
   2.4. Alert if WAL archiving falls behind by more than 15 minutes

3. **Daily Full Backup**
   3.1. Execute `pg_basebackup` during low-traffic window (02:00 UTC):
        ```bash
        pg_basebackup -h <primary_host> -D /backup/base/$(date +%Y%m%d) \
          -Ft -z -P --wal-method=stream \
          --label="privacyops-daily-$(date +%Y%m%d)"
        ```
   3.2. Upload compressed backup to S3 with server-side encryption:
        ```bash
        aws s3 cp /backup/base/$(date +%Y%m%d) \
          s3://privacyops-backups/daily/$(date +%Y%m%d)/ \
          --recursive --sse aws:kms
        ```
   3.3. Verify backup integrity:
        ```bash
        pg_verifybackup /backup/base/$(date +%Y%m%d)
        ```
   3.4. Retain daily backups for 30 days, weekly for 90 days, monthly for 1 year

4. **Audit Log Special Handling**
   4.1. Audit logs require zero RPO due to SHA256 hash chain integrity
   4.2. Configure synchronous streaming replication to standby for `audit_logs` table
   4.3. Verify hash chain integrity after each backup restore:
        ```typescript
        const result = await auditService.verifyChain(tenantId, startDate, endDate);
        assert(result.valid === true);
        ```
   4.4. Separate audit log export for long-term compliance retention (7 years)

5. **Tenant Data Isolation in Backups**
   5.1. Full database backups contain all tenant data (encrypted at rest)
   5.2. For tenant-specific recovery: restore to isolated instance, apply RLS filter
   5.3. Never restore tenant data to production without verifying `tenant_id` isolation
   5.4. Legal hold data must be preserved regardless of backup rotation policy

### 5.3 Redis Backup

6. **RDB Snapshots**
   6.1. Configure Redis persistence:
        ```
        save 21600 1    # Snapshot every 6 hours if at least 1 key changed
        save 3600 100   # Snapshot every hour if at least 100 keys changed
        save 300 10000  # Snapshot every 5 minutes if at least 10000 keys changed
        ```
   6.2. Copy RDB files to backup storage:
        ```bash
        aws s3 cp /var/lib/redis/dump.rdb \
          s3://privacyops-backups/redis/$(date +%Y%m%d-%H%M).rdb \
          --sse aws:kms
        ```
   6.3. Redis data is primarily cache (sessions, rate limits, feature gates)
   6.4. On loss: Sessions require re-authentication, rate limits reset, feature gates reload from database

7. **Redis Recovery Priority**
   7.1. Redis loss is non-critical (cache can be rebuilt)
   7.2. Session invalidation triggers user re-login (acceptable)
   7.3. Circuit breaker state (AI co-pilot) resets to closed (acceptable with monitoring)
   7.4. Rate limit counters reset (acceptable; monitor for abuse spike)

### 5.4 NATS JetStream Backup

8. **Stream Backup**
   8.1. Export `PRIVACYOPS` stream state:
        ```bash
        nats stream backup PRIVACYOPS /backup/nats/privacyops-$(date +%Y%m%d-%H%M)
        ```
   8.2. Export `PRIVACYOPS_DLQ` stream:
        ```bash
        nats stream backup PRIVACYOPS_DLQ /backup/nats/dlq-$(date +%Y%m%d-%H%M)
        ```
   8.3. Backup frequency: Every 4 hours
   8.4. Retain stream backups for 14 days (matches stream retention of 7 days + buffer)
   8.5. Include consumer state in backup for replay position recovery

9. **NATS Recovery Considerations**
   9.1. Events are idempotent (EventBusService idempotency cache with 10-minute TTL)
   9.2. After recovery, replay may cause duplicate processing (handled by idempotency)
   9.3. HMAC signatures remain valid after recovery (EVENT_HMAC_SECRET unchanged)
   9.4. DLQ messages must be preserved for investigation

### 5.5 Temporal Backup

10. **Workflow State Export**
    10.1. Export Temporal namespace configuration:
          ```bash
          tctl --ns privacyops namespace describe > /backup/temporal/namespace-$(date +%Y%m%d).json
          ```
    10.2. Temporal persistence backed up via its PostgreSQL/MySQL backend
    10.3. Include Temporal's visibility store in database backup
    10.4. Running workflows are durable (survive Temporal server restart)
    10.5. Schedule definition export:
          ```bash
          tctl schedule list --output json > /backup/temporal/schedules-$(date +%Y%m%d).json
          ```

11. **Temporal Recovery Considerations**
    11.1. Running workflows resume automatically after Temporal server recovery
    11.2. Verify all 8 task queue workers reconnect after recovery:
          - SCAN, DSAR, BREACH, RETENTION, APPROVAL, VENDOR, REMEDIATION, DATA_DELETION
    11.3. Check for workflows stuck in retry loop after recovery
    11.4. Re-register scheduled jobs if schedule store was lost

### 5.6 Recovery Procedures

12. **PostgreSQL Point-in-Time Recovery (PITR)**
    12.1. Identify target recovery time
    12.2. Restore base backup:
          ```bash
          pg_restore -d privacyops_recovery /backup/base/<date>/base.tar
          ```
    12.3. Configure recovery target:
          ```
          restore_command = 'aws s3 cp s3://privacyops-backups/wal/%f %p'
          recovery_target_time = '<target_timestamp>'
          recovery_target_action = 'promote'
          ```
    12.4. Start recovery instance and verify data integrity
    12.5. Run Prisma migration check: `npx prisma migrate status`
    12.6. Verify RLS policies active: `SELECT * FROM pg_policies;`
    12.7. Verify audit log hash chain integrity
    12.8. Promote recovery instance to primary (or export/import target data)

13. **Full Platform Recovery**
    13.1. Recovery sequence (ordered by dependency):
          1. PostgreSQL (application database + Temporal persistence)
          2. Redis (restart with RDB restore or empty start)
          3. NATS JetStream (restore streams from backup)
          4. Temporal server (restart, connects to recovered database)
          5. API application (restart NestJS with Prisma connection)
          6. Temporal workers (restart all 8 task queue workers)
          7. Web frontend (restart, connects to recovered API)
    13.2. Verify inter-service connectivity after each component recovery
    13.3. Run platform health check: `GET /api/v1/health`
    13.4. Verify OpenTelemetry trace pipeline functional

### 5.7 Backup Verification

14. **Regular Restore Testing**
    14.1. Monthly: Restore PostgreSQL backup to isolated instance
    14.2. Monthly: Verify audit log hash chain integrity on restored data
    14.3. Quarterly: Full platform recovery drill (all components)
    14.4. Quarterly: Tenant-specific data recovery test
    14.5. Document restore time and compare against RTO targets
    14.6. Report backup verification results to Compliance Officer

## 6. Verification

- [ ] WAL archiving active with <15 minute lag
- [ ] Daily full backup completed and uploaded to S3
- [ ] Backup integrity verified (`pg_verifybackup`)
- [ ] Redis RDB snapshot current (<6 hours old)
- [ ] NATS stream backups current (<4 hours old)
- [ ] Temporal namespace/schedule configuration exported
- [ ] All backups encrypted at rest
- [ ] Monthly restore test completed successfully
- [ ] Audit log hash chain verified on restored backup
- [ ] RTO/RPO compliance documented

## 7. Rollback

Backup operations are non-destructive. If a recovery operation causes issues:
1. Stop recovered instance immediately
2. Re-assess recovery target time
3. Re-execute PITR with corrected target
4. If production is still running on old primary, reconnect application
5. For partial recovery (single tenant), isolate recovered data before merge

## 8. Frequency

- **WAL archiving**: Continuous (every 5 minutes or on segment completion)
- **PostgreSQL full backup**: Daily at 02:00 UTC
- **Redis RDB snapshot**: Every 6 hours
- **NATS stream backup**: Every 4 hours
- **Temporal state export**: Every 4 hours
- **Backup verification (restore test)**: Monthly
- **Full recovery drill**: Quarterly
- **Backup retention review**: Quarterly
- **RTO/RPO target review**: Annually

## 9. References

- SOP-001: Incident Response (for disaster scenarios)
- SOP-005: Change Management (for backup infrastructure changes)
- SOP-011: Audit Log Review (for hash chain verification)
- Architecture Doc: `docs/architecture/05-system-architecture.md`
- Infrastructure: `infra/terraform/` (backup storage configuration)
- Source: `apps/api/src/core/audit/audit.service.ts` (hash chain verification)

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Infrastructure Lead | Initial version |
| | | | |
| | | | |
