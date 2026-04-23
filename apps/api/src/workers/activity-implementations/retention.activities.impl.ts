/**
 * Retention disposal Temporal activity implementations. Assets are
 * flagged in-place via soft-delete / metadata update. Real physical
 * deletion should be wired through connector-specific disposal when
 * each connector implements that surface.
 */
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';

export interface RetentionActivities {
  findExpiredAssets(input: { tenantId: string; policyId: string }): Promise<string[]>;
  executeDisposal(input: {
    tenantId: string;
    assetId: string;
    action: string;
  }): Promise<void>;
  logDisposal(input: {
    tenantId: string;
    policyId: string;
    assetsProcessed: number;
    action: string;
  }): Promise<void>;
}

export function createRetentionActivities(app: INestApplicationContext): RetentionActivities {
  const logger: Logger = new NestLogger('RetentionActivities');
  const prisma = app.get(PrismaService);
  const audit = app.get(AuditService);
  const events = app.get(EventBusService);

  return {
    async findExpiredAssets(input) {
      const policy = await prisma.retentionPolicy.findFirst({
        where: { id: input.policyId, tenantId: input.tenantId },
      });
      if (!policy) {
        logger.warn(`findExpiredAssets: policy ${input.policyId} not found`);
        return [];
      }
      const retentionDays = (policy as any).retentionPeriodDays ?? 365;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const assets = await prisma.dataAsset.findMany({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        take: 500,
      });
      return assets.map((a) => a.id);
    },

    async executeDisposal(input) {
      // Flag asset — actual content deletion is delegated to the
      // connector-specific delete path when implemented.
      const updateData: Record<string, unknown> = {};
      if (input.action === 'delete') {
        updateData.deletedAt = new Date();
      } else if (input.action === 'anonymize') {
        updateData.metadata = { anonymizedAt: new Date().toISOString() };
      } else if (input.action === 'archive') {
        updateData.metadata = { archivedAt: new Date().toISOString() };
      }
      try {
        await prisma.dataAsset.update({
          where: { id: input.assetId },
          data: updateData as any,
        });
      } catch (err) {
        logger.warn(`executeDisposal failed for ${input.assetId}: ${(err as Error).message}`);
      }
    },

    async logDisposal(input) {
      await audit.log({
        tenantId: input.tenantId,
        actorType: 'system',
        action: `retention.disposal.${input.action}`,
        entityType: 'retention_policy',
        entityId: input.policyId,
        changes: { after: { assetsProcessed: input.assetsProcessed, action: input.action } },
        severity: 'warning',
        category: 'compliance',
      });
      await events.publish({
        type: 'retention.disposal.completed',
        tenantId: input.tenantId,
        data: { policyId: input.policyId, assetsProcessed: input.assetsProcessed, action: input.action },
        timestamp: new Date(),
      });
    },
  };
}
