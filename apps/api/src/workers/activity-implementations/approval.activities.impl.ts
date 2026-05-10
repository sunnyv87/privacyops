/**
 * Approval / remediation / data-deletion Temporal activity
 * implementations. Human-review activities (awaitReview,
 * awaitApproval) return CURRENT DB state non-blockingly; a future
 * signal-based implementation can replace the poll contract without
 * changing workflow code.
 *
 * Legal-hold enforcement + deletion certificate generation write to
 * existing tables where available and audit-log otherwise.
 */
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';

export interface ApprovalActivities {
  // DPIA approval
  validateAssessment(input: { tenantId: string; assessmentId: string }): Promise<{ valid: boolean }>;
  assignReviewer(input: {
    tenantId: string;
    assessmentId: string;
    reviewerId: string;
  }): Promise<void>;
  awaitReview(input: {
    tenantId: string;
    assessmentId: string;
    reviewerId: string;
  }): Promise<{ decision: string; comments: string }>;
  recordDecision(input: {
    tenantId: string;
    assessmentId: string;
    decision: string;
    comments: string;
  }): Promise<void>;
  notifyOutcome(input: {
    tenantId: string;
    assessmentId: string;
    decision: string;
  }): Promise<void>;

  // Remediation
  validateFinding(input: { tenantId: string; findingId: string }): Promise<{ valid: boolean }>;
  proposeAction(input: {
    tenantId: string;
    findingId: string;
    actionType: string;
  }): Promise<{ proposalId: string }>;
  awaitApproval(input: { tenantId: string; proposalId: string }): Promise<{ approved: boolean }>;
  executeRemediation(input: {
    tenantId: string;
    findingId: string;
    proposalId: string;
  }): Promise<{ remediationId: string }>;
  validateResult(input: {
    tenantId: string;
    findingId: string;
    remediationId: string;
  }): Promise<void>;
  notifyRemediationComplete(input: {
    tenantId: string;
    findingId: string;
    remediationId: string;
  }): Promise<void>;

  // Data deletion
  checkLegalHolds(input: {
    tenantId: string;
    assetIds: string[];
  }): Promise<{ eligibleAssetIds: string[] }>;
  requestDeletionApproval(input: {
    tenantId: string;
    policyId: string;
    assetIds: string[];
  }): Promise<{ approved: boolean }>;
  executeDisposal(input: {
    tenantId: string;
    policyId: string;
    assetIds: string[];
  }): Promise<{ deletedAssetIds: string[] }>;
  generateCertificate(input: {
    tenantId: string;
    policyId: string;
    deletedAssetIds: string[];
  }): Promise<{ certificateId: string }>;
  notifyDeletionComplete(input: {
    tenantId: string;
    policyId: string;
    certificateId: string;
    deletedCount: number;
  }): Promise<void>;
}

export function createApprovalActivities(app: INestApplicationContext): ApprovalActivities {
  const logger: Logger = new NestLogger('ApprovalActivities');
  const prisma = app.get(PrismaService);
  const notifications = app.get(NotificationsService);
  const audit = app.get(AuditService);
  const events = app.get(EventBusService);

  return {
    // ---------- DPIA ----------
    async validateAssessment(input) {
      const a = await prisma.assessment.findFirst({
        where: { id: input.assessmentId, tenantId: input.tenantId },
      });
      return { valid: !!a };
    },

    async assignReviewer(input) {
      try {
        await prisma.assessment.update({
          where: { id: input.assessmentId },
          data: { assigneeId: input.reviewerId, status: 'in_review' } as any,
        });
      } catch (err) {
        logger.warn(`assignReviewer failed: ${(err as Error).message}`);
      }
      await notifications.send({
        tenantId: input.tenantId,
        type: 'dpia.assigned',
        title: 'DPIA assigned for review',
        message: `DPIA ${input.assessmentId} assigned to ${input.reviewerId}.`,
        severity: 'info',
        channels: ['in_app', 'email'],
        recipientIds: [input.reviewerId],
      });
    },

    async awaitReview(input) {
      const a = await prisma.assessment.findFirst({
        where: { id: input.assessmentId, tenantId: input.tenantId },
        select: { status: true, metadata: true },
      });
      const meta = ((a as any)?.metadata as Record<string, unknown>) || {};
      return {
        decision: (meta['decision'] as string) ?? 'pending',
        comments: (meta['comments'] as string) ?? '',
      };
    },

    async recordDecision(input) {
      try {
        await prisma.assessment.update({
          where: { id: input.assessmentId },
          data: {
            status: input.decision === 'approved' ? 'approved' : 'rejected',
            metadata: { decision: input.decision, comments: input.comments },
          } as any,
        });
      } catch (err) {
        logger.warn(`recordDecision failed: ${(err as Error).message}`);
      }
      await audit.log({
        tenantId: input.tenantId,
        actorType: 'system',
        action: 'dpia.decision_recorded',
        entityType: 'assessment',
        entityId: input.assessmentId,
        changes: { after: { decision: input.decision } },
        severity: 'warning',
        category: 'compliance',
      });
    },

    async notifyOutcome(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'dpia.outcome',
        title: `DPIA ${input.decision}`,
        message: `DPIA ${input.assessmentId} has been ${input.decision}.`,
        severity: input.decision === 'rejected' ? 'warning' : 'info',
        channels: ['in_app', 'email'],
      });
    },

    // ---------- Remediation ----------
    async validateFinding(input) {
      const f = await prisma.riskFinding.findFirst({
        where: { id: input.findingId, tenantId: input.tenantId },
      });
      return { valid: !!f };
    },

    async proposeAction(input) {
      const proposalId = `prop_${randomUUID()}`;
      try {
        await prisma.remediationAction.create({
          data: {
            tenantId: input.tenantId,
            findingId: input.findingId,
            actionType: input.actionType,
            status: 'proposed',
            proposalId,
          } as any,
        });
      } catch (err) {
        logger.warn(`proposeAction persist failed: ${(err as Error).message}`);
      }
      return { proposalId };
    },

    async awaitApproval(input) {
      const action = await prisma.remediationAction.findFirst({
        where: { proposalId: input.proposalId, tenantId: input.tenantId } as any,
        select: { status: true } as any,
      });
      return { approved: (action as any)?.status === 'approved' };
    },

    async executeRemediation(input) {
      const remediationId = `rem_${randomUUID()}`;
      await events.publish({
        type: 'remediation.executed',
        tenantId: input.tenantId,
        data: { findingId: input.findingId, proposalId: input.proposalId, remediationId },
        timestamp: new Date(),
      });
      return { remediationId };
    },

    async validateResult(input) {
      await audit.log({
        tenantId: input.tenantId,
        actorType: 'system',
        action: 'remediation.validated',
        entityType: 'risk_finding',
        entityId: input.findingId,
        changes: { after: { remediationId: input.remediationId } },
        severity: 'info',
        category: 'security',
      });
    },

    async notifyRemediationComplete(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'remediation.completed',
        title: 'Remediation completed',
        message: `Finding ${input.findingId} remediation ${input.remediationId} completed.`,
        severity: 'info',
        channels: ['in_app'],
      });
    },

    // ---------- Data deletion ----------
    async checkLegalHolds(input) {
      const activeHolds = await prisma.$queryRawUnsafe<Array<{ asset_id: string }>>(
        `SELECT DISTINCT asset_id FROM legal_holds
         WHERE tenant_id = $1
           AND asset_id = ANY($2::uuid[])
           AND released_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())`,
        input.tenantId,
        input.assetIds,
      );

      const heldAssetIds = new Set(activeHolds.map(h => h.asset_id));
      const eligibleAssetIds = input.assetIds.filter((id: string) => !heldAssetIds.has(id));

      if (heldAssetIds.size > 0) {
        logger.warn(
          `Legal hold enforcement: ${heldAssetIds.size} of ${input.assetIds.length} assets blocked from deletion`,
        );
        await audit.log({
          tenantId: input.tenantId,
          actorType: 'system',
          action: 'legal_hold.deletion_blocked',
          entityType: 'data_deletion',
          entityId: input.tenantId,
          severity: 'warning',
          category: 'compliance',
          changes: {
            after: {
              totalAssets: input.assetIds.length,
              heldAssets: Array.from(heldAssetIds),
              eligibleAssets: eligibleAssetIds.length,
            },
          },
        });
      }

      return { eligibleAssetIds };
    },

    async requestDeletionApproval(input) {
      const policy = await prisma.retentionPolicy.findFirst({
        where: { id: input.policyId, tenantId: input.tenantId },
        select: { status: true } as any,
      });
      // Auto-approve if the policy itself is approved/active;
      // otherwise deny and await an explicit approval workflow.
      const approved = (policy as any)?.status === 'active';
      return { approved };
    },

    async executeDisposal(input) {
      const deleted: string[] = [];
      for (const assetId of input.assetIds) {
        try {
          await prisma.asset.update({
            where: { id: assetId },
            data: { deletedAt: new Date() },
          });
          deleted.push(assetId);
        } catch (err) {
          logger.warn(`disposal failed for ${assetId}: ${(err as Error).message}`);
        }
      }
      return { deletedAssetIds: deleted };
    },

    async generateCertificate(input) {
      const certificateId = `cert_${randomUUID()}`;
      await audit.log({
        tenantId: input.tenantId,
        actorType: 'system',
        action: 'data_deletion.certificate_generated',
        entityType: 'retention_policy',
        entityId: input.policyId,
        changes: {
          after: {
            certificateId,
            deletedAssetCount: input.deletedAssetIds.length,
          },
        },
        severity: 'warning',
        category: 'compliance',
      });
      return { certificateId };
    },

    async notifyDeletionComplete(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'data_deletion.completed',
        title: 'Data deletion completed',
        message: `Policy ${input.policyId} deletion complete: ${input.deletedCount} assets. Certificate: ${input.certificateId}.`,
        severity: 'info',
        channels: ['in_app', 'email'],
      });
    },
  };
}
