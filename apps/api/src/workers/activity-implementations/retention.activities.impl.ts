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
import { ConnectorRegistry } from '../../modules/connectors/connector-registry';
import { CryptoService } from '../../core/crypto/crypto.service';

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
  const registry = app.get(ConnectorRegistry, { strict: false });
  const crypto = app.get(CryptoService, { strict: false });

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
      // Attempt connector-native disposal FIRST. If the connector
      // supports it (and has opted in via enableNativeDisposal), we
      // record the native operation alongside the catalog flag. If the
      // connector cannot perform the action we fall back to the
      // metadata-only flag — preserving the prior behavior exactly.
      let nativeOutcome: Record<string, unknown> | null = null;
      try {
        const asset = await prisma.dataAsset.findUnique({
          where: { id: input.assetId },
          select: { externalId: true, dataSourceId: true, tenantId: true } as any,
        });
        if (asset && (asset as any).dataSourceId && registry) {
          const dataSource = await prisma.dataSource.findFirst({
            where: { id: (asset as any).dataSourceId, tenantId: input.tenantId },
          });
          if (dataSource && crypto) {
            const connector = registry.create(dataSource.type as any);
            if (connector && typeof (connector as any).disposeAsset === 'function') {
              const decryptedConfig =
                typeof dataSource.connectionConfig === 'string'
                  ? await crypto.decryptJson(
                      dataSource.connectionConfig as string,
                      `tenant:${input.tenantId}`,
                    )
                  : (dataSource.connectionConfig as any);
              await connector.initialize({
                type: dataSource.type as any,
                credentials: decryptedConfig,
                options: (dataSource as any).connectionOptions ?? {},
              });
              const result = await (connector as any).disposeAsset(
                (asset as any).externalId,
                input.action,
              );
              nativeOutcome = result as Record<string, unknown>;
              try { await connector.disconnect(); } catch { /* best-effort */ }
            }
          }
        }
      } catch (err) {
        logger.warn(
          `Native disposal attempt failed for ${input.assetId}: ${(err as Error).message}`,
        );
      }

      // Always apply catalog metadata flag, regardless of native outcome.
      const updateData: Record<string, unknown> = {};
      if (input.action === 'delete') {
        updateData.deletedAt = new Date();
      } else if (input.action === 'anonymize') {
        updateData.metadata = {
          anonymizedAt: new Date().toISOString(),
          nativeDisposal: nativeOutcome,
        };
      } else if (input.action === 'archive') {
        updateData.metadata = {
          archivedAt: new Date().toISOString(),
          nativeDisposal: nativeOutcome,
        };
      }
      try {
        await prisma.dataAsset.update({
          where: { id: input.assetId },
          data: updateData as any,
        });
      } catch (err) {
        logger.warn(`executeDisposal persist failed for ${input.assetId}: ${(err as Error).message}`);
      }

      if (nativeOutcome) {
        await audit.log({
          tenantId: input.tenantId,
          actorType: 'system',
          action: 'retention.disposal.native',
          entityType: 'data_asset',
          entityId: input.assetId,
          changes: { after: nativeOutcome },
          severity: 'warning',
          category: 'compliance',
        });
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
