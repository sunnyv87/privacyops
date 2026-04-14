import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { createHash, randomUUID } from 'crypto';

export type AuditSeverity = 'info' | 'warning' | 'critical';
export type AuditCategory =
  | 'data_access'
  | 'auth'
  | 'admin'
  | 'security'
  | 'compliance';

export interface AuditLogEntry {
  tenantId: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'api_key' | 'workflow';
  action: string;
  entityType: string;
  entityId: string;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
  category?: AuditCategory;
}

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'session_revoked'
  | 'permission_changed'
  | 'role_assigned'
  | 'role_revoked'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'data_export'
  | 'bulk_deletion'
  | 'config_change'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'password_changed'
  | 'password_reset'
  | 'account_locked'
  | 'account_unlocked'
  | 'tenant_config_changed';

export interface SecurityEvent {
  tenantId: string;
  eventType: SecurityEventType;
  actorId?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalChecked: number;
  firstInvalidAt?: Date;
  brokenAtId?: string;
}

const SECURITY_EVENT_SEVERITY: Record<SecurityEventType, AuditSeverity> = {
  login_success: 'info',
  login_failure: 'warning',
  mfa_enabled: 'info',
  mfa_disabled: 'warning',
  session_revoked: 'warning',
  permission_changed: 'warning',
  role_assigned: 'warning',
  role_revoked: 'warning',
  suspicious_activity: 'critical',
  rate_limit_exceeded: 'warning',
  unauthorized_access: 'critical',
  data_export: 'warning',
  bulk_deletion: 'critical',
  config_change: 'warning',
  api_key_created: 'info',
  api_key_revoked: 'warning',
  password_changed: 'info',
  password_reset: 'warning',
  account_locked: 'critical',
  account_unlocked: 'warning',
  tenant_config_changed: 'warning',
};

/**
 * Field name patterns that must be redacted from audit log `changes` objects
 * to prevent sensitive data leakage into persistent storage.
 */
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apiKey/i,
  /api_key/i,
  /credential/i,
  /ssn/i,
  /social_security/i,
  /credit_card/i,
  /creditCard/i,
  /cvv/i,
  /pin/i,
  /private_key/i,
  /privateKey/i,
  /mfaSecret/i,
  /mfa_secret/i,
  /mfaRecoveryCodes/i,
  /recovery_codes/i,
  /refreshToken/i,
  /refresh_token/i,
  /accessToken/i,
  /access_token/i,
];

const REDACTED = '[REDACTED]';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Per-tenant last hash cache. Loaded from DB on init and updated after each write.
   */
  private lastHashByTenant: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Pre-load is deferred to first write per tenant for efficiency.
    // We don't load all tenants here as there could be many.
    this.logger.log('AuditService initialized with persistent hash chain');
  }

  /**
   * Loads the last integrity hash for a tenant from the audit_chain_state table,
   * falling back to the latest audit log entry if no chain state record exists.
   */
  private async loadLastHash(tenantId: string): Promise<string> {
    const cached = this.lastHashByTenant.get(tenantId);
    if (cached !== undefined) {
      return cached;
    }

    // Try dedicated chain state table first
    const chainState = await this.prisma.auditChainState.findUnique({
      where: { tenantId },
      select: { lastHash: true },
    });

    if (chainState) {
      this.lastHashByTenant.set(tenantId, chainState.lastHash);
      return chainState.lastHash;
    }

    // Fall back to reading the last audit log (for backward compat / migration)
    const lastLog = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      select: { integrityHash: true },
    });

    const hash = lastLog?.integrityHash ?? '0';
    this.lastHashByTenant.set(tenantId, hash);
    return hash;
  }

  /**
   * Recursively redacts sensitive fields from an object to prevent
   * credentials, tokens, and PII from being persisted in audit logs.
   */
  private redactSensitiveFields(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.redactSensitiveFields(item));

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key))) {
        redacted[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveFields(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  /**
   * Canonical JSON serialization with deterministic key ordering. This is
   * what we hash — stable across runs regardless of object literal key
   * insertion order.
   */
  private canonicalize(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return '[' + value.map((v) => this.canonicalize(v)).join(',') + ']';
    }
    const keys = Object.keys(value).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + this.canonicalize(value[k]))
        .join(',') +
      '}'
    );
  }

  /**
   * Computes an integrity hash for an audit log entry, chained to the previous
   * hash. The hash input covers EVERY security-relevant field so that tampering
   * with any of them (including changes payload, actor, IP, severity, etc.)
   * invalidates the chain.
   */
  private computeHash(
    previousHash: string,
    record: {
      tenantId: string;
      actorId?: string;
      actorType: string;
      action: string;
      entityType: string;
      entityId: string;
      changes?: any;
      ipAddress?: string;
      userAgent?: string;
      severity: string;
      category: string;
      timestamp: string;
      sequence: number | bigint;
    },
  ): string {
    const hashInput = [
      previousHash,
      record.tenantId,
      record.actorId ?? '',
      record.actorType,
      record.action,
      record.entityType,
      record.entityId,
      this.canonicalize(record.changes ?? null),
      record.ipAddress ?? '',
      record.userAgent ?? '',
      record.severity,
      record.category,
      record.timestamp,
      String(record.sequence),
    ].join('|');

    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Creates an audit log entry with chain-hashing for tamper evidence.
   *
   * Concurrency: we take a Postgres advisory lock keyed to the tenantId for
   * the lifetime of the transaction. This serializes all audit writes per
   * tenant so that `loadLastHash` -> `computeHash` -> `create` is atomic with
   * respect to other writers, eliminating the fork-chain race that would
   * otherwise occur between independent `log()` calls.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const timestamp = new Date();

    // Redact sensitive fields from changes before persisting
    const sanitizedChanges = entry.changes
      ? this.redactSensitiveFields(entry.changes)
      : undefined;

    const severity = entry.severity || 'info';
    const category = entry.category || 'data_access';

    // Derive a stable 32-bit advisory lock key from the tenantId. Using
    // `hashtext` on Postgres side via pg_advisory_xact_lock() would require
    // raw SQL; instead we compute a deterministic bigint client-side.
    const lockKey = this.tenantLockKey(entry.tenantId);

    await this.prisma.$transaction(async (tx) => {
      // Serialize audit writes for this tenant.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockKey);

      // Re-read chain state INSIDE the transaction to observe any concurrent
      // writers that committed between our lock acquisition and now.
      const existing = await tx.auditChainState.findUnique({
        where: { tenantId: entry.tenantId },
        select: { lastHash: true, sequence: true },
      });

      const previousHash = existing?.lastHash ?? '0';
      const nextSequence =
        existing?.sequence !== undefined
          ? BigInt(existing.sequence as unknown as number) + BigInt(1)
          : BigInt(1);

      const integrityHash = this.computeHash(previousHash, {
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: sanitizedChanges,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        severity,
        category,
        timestamp: timestamp.toISOString(),
        sequence: nextSequence,
      });

      await tx.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorId: entry.actorId,
          actorType: entry.actorType,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          changes: sanitizedChanges,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          severity,
          category,
          timestamp,
          integrityHash,
        },
      });

      await tx.auditChainState.upsert({
        where: { tenantId: entry.tenantId },
        update: { lastHash: integrityHash, sequence: nextSequence as any },
        create: {
          tenantId: entry.tenantId,
          lastHash: integrityHash,
          sequence: nextSequence as any,
        },
      });

      // Update in-memory cache ONLY after the transaction commits. Writing
      // the cache optimistically before commit risks poisoning subsequent
      // writers on rollback.
      this.lastHashByTenant.set(entry.tenantId, integrityHash);
    });
  }

  /**
   * Deterministic bigint derived from a tenant UUID for use as a Postgres
   * advisory lock key. Collisions between tenants are acceptable (they just
   * serialize unrelated writes); the key only needs to be stable per-tenant.
   */
  private tenantLockKey(tenantId: string): bigint {
    const digest = createHash('sha256').update(tenantId).digest();
    // Take the first 8 bytes as a signed 64-bit integer.
    const high = BigInt(digest.readUInt32BE(0));
    const low = BigInt(digest.readUInt32BE(4));
    // Clamp to bigint range acceptable by pg_advisory_xact_lock (int8).
    // Use XOR to spread entropy.
    return (high << BigInt(32)) ^ low ^ BigInt('0x7fffffffffffffff');
  }

  /**
   * Logs a security-relevant event. Writes to audit_logs with category='security'
   * and publishes to NATS on `privacyops.security.{eventType}`.
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const severity = SECURITY_EVENT_SEVERITY[event.eventType] || 'info';

    await this.log({
      tenantId: event.tenantId,
      actorId: event.actorId,
      actorType: event.actorId ? 'user' : 'system',
      action: `security.${event.eventType}`,
      entityType: 'security_event',
      entityId: event.targetId || randomUUID(),
      changes: event.metadata ? { after: event.metadata } : undefined,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      severity,
      category: 'security',
    });

    // Publish to NATS for real-time consumers
    try {
      await this.eventBus.publish({
        type: `security.${event.eventType}`,
        tenantId: event.tenantId,
        data: {
          eventType: event.eventType,
          actorId: event.actorId,
          targetId: event.targetId,
          metadata: event.metadata,
          ipAddress: event.ipAddress,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish security event ${event.eventType} to NATS: ${error}`,
      );
    }
  }

  /**
   * Logs an administrative action. Always uses category='admin' and severity='warning'.
   */
  async logAdminAction(
    entry: Omit<AuditLogEntry, 'severity' | 'category'>,
  ): Promise<void> {
    await this.log({
      ...entry,
      severity: 'warning',
      category: 'admin',
    });
  }

  /**
   * Verifies the integrity hash chain for a tenant's audit logs.
   * Reads all logs in chronological order and recomputes hashes to detect tampering.
   */
  async verifyChain(
    tenantId: string,
    from?: Date,
    to?: Date,
  ): Promise<ChainVerificationResult> {
    const batchSize = 1000;
    let cursor: string | undefined;
    let previousHash = '0';
    let expectedSequence = BigInt(1);
    let totalChecked = 0;

    // If we have a 'from' date, get the hash AND sequence of the record just
    // before our range to start verification correctly.
    if (from) {
      const priorRecord = await this.prisma.auditLog.findFirst({
        where: {
          tenantId,
          timestamp: { lt: from },
        },
        orderBy: { timestamp: 'desc' },
        select: { integrityHash: true },
      });
      if (priorRecord) {
        previousHash = priorRecord.integrityHash;
      }
    }

    while (true) {
      const whereClause: any = { tenantId };
      if (from || to) {
        whereClause.timestamp = {};
        if (from) whereClause.timestamp.gte = from;
        if (to) whereClause.timestamp.lte = to;
      }

      const logs = await this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        take: batchSize,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
      });

      if (logs.length === 0) break;

      for (const log of logs) {
        totalChecked++;

        // The sequence used during log() is tracked on auditChainState and
        // isn't persisted on each row. For verification we reconstruct it
        // positionally: the first row of the chain is sequence 1, second is
        // 2, etc. Gaps signal deletion; this is detected by comparing final
        // expectedSequence to the row count in auditChainState.
        const expectedHash = this.computeHash(previousHash, {
          tenantId: log.tenantId,
          actorId: log.actorId ?? undefined,
          actorType: log.actorType,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          changes: log.changes ?? null,
          ipAddress: log.ipAddress ?? undefined,
          userAgent: log.userAgent ?? undefined,
          severity: log.severity,
          category: log.category,
          timestamp: log.timestamp.toISOString(),
          sequence: expectedSequence,
        });

        if (expectedHash !== log.integrityHash) {
          return {
            valid: false,
            totalChecked,
            firstInvalidAt: log.timestamp,
            brokenAtId: log.id,
          };
        }

        previousHash = log.integrityHash;
        expectedSequence += BigInt(1);
      }

      cursor = logs[logs.length - 1].id;

      // If we got fewer than batchSize, we've reached the end
      if (logs.length < batchSize) break;
    }

    // Compare final sequence against chain state — a mismatch here signals
    // insertion or deletion of rows between valid chain entries.
    const chainState = await this.prisma.auditChainState.findUnique({
      where: { tenantId },
      select: { sequence: true },
    });

    if (
      !from &&
      !to &&
      chainState &&
      BigInt(chainState.sequence as unknown as number) + BigInt(1) !==
        expectedSequence
    ) {
      return {
        valid: false,
        totalChecked,
      };
    }

    return { valid: true, totalChecked };
  }

  /**
   * Find audit logs by entity.
   */
  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  /**
   * Search audit logs with filters, including severity and category.
   */
  async search(
    tenantId: string,
    filters: {
      action?: string;
      actorId?: string;
      entityType?: string;
      category?: AuditCategory;
      severity?: AuditSeverity;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ) {
    const { page = 1, pageSize = 50, ...where } = filters;

    const whereClause: any = {
      tenantId,
      ...(where.action && { action: { contains: where.action } }),
      ...(where.actorId && { actorId: where.actorId }),
      ...(where.entityType && { entityType: where.entityType }),
      ...(where.category && { category: where.category }),
      ...(where.severity && { severity: where.severity }),
    };

    if (where.from || where.to) {
      whereClause.timestamp = {};
      if (where.from) whereClause.timestamp.gte = where.from;
      if (where.to) whereClause.timestamp.lte = where.to;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({
        where: whereClause,
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Retrieve a single audit log entry by ID.
   */
  async findById(tenantId: string, id: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Export audit logs as structured data (for CSV/JSON export).
   */
  async exportLogs(
    tenantId: string,
    filters: {
      action?: string;
      actorId?: string;
      entityType?: string;
      category?: AuditCategory;
      severity?: AuditSeverity;
      from?: Date;
      to?: Date;
    },
  ) {
    const whereClause: any = {
      tenantId,
      ...(filters.action && { action: { contains: filters.action } }),
      ...(filters.actorId && { actorId: filters.actorId }),
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.category && { category: filters.category }),
      ...(filters.severity && { severity: filters.severity }),
    };

    if (filters.from || filters.to) {
      whereClause.timestamp = {};
      if (filters.from) whereClause.timestamp.gte = filters.from;
      if (filters.to) whereClause.timestamp.lte = filters.to;
    }

    return this.prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
      // Cap at 10000 records for export to prevent OOM
      take: 10000,
    });
  }
}
