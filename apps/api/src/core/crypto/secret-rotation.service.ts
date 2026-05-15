import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import * as crypto from 'crypto';

interface RotationPolicy {
  secretName: string;
  maxAgeDays: number;
  rotateOnStartup: boolean;
}

interface SecretMetadata {
  name: string;
  lastRotated: Date | null;
  ageDays: number;
  isExpired: boolean;
  source: string;
}

@Injectable()
export class SecretRotationService {
  private readonly logger = new Logger(SecretRotationService.name);

  private readonly policies: RotationPolicy[] = [
    { secretName: 'JWT_SECRET', maxAgeDays: 90, rotateOnStartup: false },
    { secretName: 'ENCRYPTION_MASTER_KEY', maxAgeDays: 365, rotateOnStartup: false },
    { secretName: 'STRIPE_WEBHOOK_SECRET', maxAgeDays: 180, rotateOnStartup: false },
    { secretName: 'NATS_AUTH_TOKEN', maxAgeDays: 90, rotateOnStartup: false },
    { secretName: 'ANTHROPIC_API_KEY', maxAgeDays: 180, rotateOnStartup: false },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async auditSecretHealth(): Promise<{
    secrets: SecretMetadata[];
    expiredCount: number;
    warningCount: number;
  }> {
    const secrets: SecretMetadata[] = [];
    let expiredCount = 0;
    let warningCount = 0;

    for (const policy of this.policies) {
      const value = this.config.get<string>(policy.secretName);
      const metadata = await this.getSecretMetadata(policy.secretName);

      const lastRotated = metadata?.lastRotated ?? null;
      const ageDays = lastRotated
        ? Math.floor((Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24))
        : -1;
      const isExpired = ageDays >= 0 && ageDays > policy.maxAgeDays;
      const isWarning = ageDays >= 0 && ageDays > policy.maxAgeDays * 0.8;

      if (isExpired) expiredCount++;
      else if (isWarning) warningCount++;

      secrets.push({
        name: policy.secretName,
        lastRotated,
        ageDays: ageDays >= 0 ? ageDays : -1,
        isExpired,
        source: value ? (this.config.get<string>('VAULT_ADDR') ? 'vault' : 'env') : 'missing',
      });
    }

    if (expiredCount > 0) {
      this.logger.warn(
        `${expiredCount} secret(s) have exceeded their rotation policy`,
      );
    }

    return { secrets, expiredCount, warningCount };
  }

  async recordRotation(secretName: string, rotatedBy: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO secret_rotation_log (secret_name, rotated_at, rotated_by)
       VALUES ($1, NOW(), $2)
       ON CONFLICT (secret_name) DO UPDATE SET rotated_at = NOW(), rotated_by = $2`,
      secretName,
      rotatedBy,
    ).catch(() => {
      this.logger.debug('secret_rotation_log table not yet provisioned — skipping');
    });

    await this.audit.log({
      tenantId: 'platform',
      actorId: rotatedBy,
      actorType: 'system',
      action: 'secret.rotated',
      entityType: 'secret',
      entityId: secretName,
      severity: 'warning',
      category: 'security',
      changes: { after: { rotatedAt: new Date().toISOString() } },
    });

    await this.events.publish({
      type: 'platform.secret.rotated',
      tenantId: 'platform',
      data: { secretName, rotatedBy },
      timestamp: new Date(),
    });
  }

  async generateRotationToken(): Promise<string> {
    return crypto.randomBytes(48).toString('base64url');
  }

  private async getSecretMetadata(
    secretName: string,
  ): Promise<{ lastRotated: Date } | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ rotated_at: Date }>>(
        `SELECT rotated_at FROM secret_rotation_log WHERE secret_name = $1 LIMIT 1`,
        secretName,
      );
      if (rows.length > 0) {
        return { lastRotated: rows[0].rotated_at };
      }
    } catch {
      // Table may not exist yet
    }
    return null;
  }
}
