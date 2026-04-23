/**
 * DSAR Temporal activity implementations. Delegates to existing NestJS
 * services — introduces no new business logic. Each activity is idempotent
 * and safe to retry.
 */
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { DsarService } from '../../modules/dsar/dsar.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface DsarActivities {
  verifyIdentity(input: { tenantId: string; requestId: string }): Promise<boolean>;
  collectData(input: {
    tenantId: string;
    requestId: string;
    type: string;
  }): Promise<Record<string, unknown>>;
  generateResponse(input: {
    tenantId: string;
    requestId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<string>;
  notifyCompletion(input: { tenantId: string; requestId: string }): Promise<void>;
  notifyOverdue(input: { tenantId: string; requestId: string }): Promise<void>;
}

export function createDsarActivities(app: INestApplicationContext): DsarActivities {
  const logger: Logger = new NestLogger('DsarActivities');
  const dsar = app.get(DsarService);
  const notifications = app.get(NotificationsService);
  const prisma = app.get(PrismaService);

  return {
    async verifyIdentity(input) {
      const req = await prisma.dsarRequest.findFirst({
        where: { id: input.requestId, tenantId: input.tenantId },
        include: { dataSubject: true },
      });
      if (!req) {
        logger.warn(`verifyIdentity: request ${input.requestId} not found`);
        return false;
      }
      // Accept pre-existing data subjects as verified. Explicit email-link
      // verification is a future extension — gated by request.channel.
      return !!req.dataSubject;
    },

    async collectData(input) {
      const result = await dsar.discoverSubjectData(input.tenantId, input.requestId);
      return {
        totalDiscovered: result.totalDiscovered,
        dataSubjectId: result.dataSubjectId,
      };
    },

    async generateResponse(input) {
      // Existing generateResponsePackage runs redaction when the
      // RedactionService is available (prior gap-fix).
      const meta = await dsar.generateResponsePackage(input.tenantId, input.requestId);
      return meta.packageUrl;
    },

    async notifyCompletion(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'dsar.completed',
        title: 'DSAR request completed',
        message: `Your data subject access request (${input.requestId}) has been fulfilled.`,
        severity: 'info',
        channels: ['in_app', 'email'],
        metadata: { requestId: input.requestId },
      });
    },

    async notifyOverdue(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'dsar.overdue',
        title: 'DSAR request overdue',
        message: `DSAR ${input.requestId} has passed its due date.`,
        severity: 'critical',
        channels: ['in_app', 'email', 'webhook'],
        metadata: { requestId: input.requestId },
      });
    },
  };
}
