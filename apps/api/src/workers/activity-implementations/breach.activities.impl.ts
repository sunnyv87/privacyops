/**
 * Breach notification Temporal activity implementations. The actual
 * regulator submission remains a manual admin action — activities here
 * record intent + notifications + audit trail so the workflow can
 * progress deterministically without a human in the loop.
 */
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { NotificationsService } from '../../core/notifications/notifications.service';

export interface BreachActivities {
  assessBreachScope(input: { tenantId: string; incidentId: string }): Promise<{
    affectedCount: number;
    dataCategories: string[];
    requiresSubjectNotification: boolean;
  }>;
  notifyInternalTeam(input: {
    tenantId: string;
    incidentId: string;
    severity: string;
    scope: Record<string, unknown>;
  }): Promise<void>;
  prepareNotification(input: {
    tenantId: string;
    incidentId: string;
    scope: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  notifyRegulator(input: {
    tenantId: string;
    incidentId: string;
    notification: Record<string, unknown>;
  }): Promise<void>;
  notifyDataSubjects(input: {
    tenantId: string;
    incidentId: string;
    affectedCount: number;
  }): Promise<void>;
}

export function createBreachActivities(app: INestApplicationContext): BreachActivities {
  const logger: Logger = new NestLogger('BreachActivities');
  const prisma = app.get(PrismaService);
  const audit = app.get(AuditService);
  const events = app.get(EventBusService);
  const notifications = app.get(NotificationsService);

  return {
    async assessBreachScope(input) {
      const incident = await prisma.incident.findFirst({
        where: { id: input.incidentId, tenantId: input.tenantId },
      });
      if (!incident) {
        logger.warn(`assessBreachScope: incident ${input.incidentId} not found`);
        return { affectedCount: 0, dataCategories: [], requiresSubjectNotification: false };
      }
      const affectedCount = (incident as any).affectedSubjectCount ?? 0;
      const dataCategories: string[] = Array.isArray((incident as any).dataCategories)
        ? (incident as any).dataCategories
        : [];
      return {
        affectedCount,
        dataCategories,
        requiresSubjectNotification:
          affectedCount > 0 && (incident.severity === 'critical' || incident.severity === 'high'),
      };
    },

    async notifyInternalTeam(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'breach.internal_team',
        title: `Breach response activated — ${input.severity}`,
        message: `Incident ${input.incidentId} requires immediate response. Scope assessed.`,
        severity: input.severity === 'critical' ? 'critical' : 'warning',
        channels: ['in_app', 'email'],
        metadata: { incidentId: input.incidentId, scope: input.scope },
      });
    },

    async prepareNotification(input) {
      const incident = await prisma.incident.findFirst({
        where: { id: input.incidentId, tenantId: input.tenantId },
      });
      return {
        incidentId: input.incidentId,
        tenantId: input.tenantId,
        preparedAt: new Date().toISOString(),
        referenceNumber: incident?.referenceNumber ?? null,
        scope: input.scope,
        requiresRegulatorSubmission: true,
      };
    },

    async notifyRegulator(input) {
      // Regulator submission is manual in production — record intent only.
      await audit.log({
        tenantId: input.tenantId,
        actorType: 'system',
        action: 'breach.regulator_notification_prepared',
        entityType: 'incident',
        entityId: input.incidentId,
        changes: { after: { notification: input.notification } },
        severity: 'critical',
        category: 'compliance',
      });
      await events.publish({
        type: 'breach.regulator_notification_prepared',
        tenantId: input.tenantId,
        data: { incidentId: input.incidentId, notification: input.notification },
        timestamp: new Date(),
      });
      await notifications.send({
        tenantId: input.tenantId,
        type: 'breach.regulator_submission_required',
        title: 'Regulator submission ready for review',
        message: `Regulator notification for incident ${input.incidentId} is prepared. Admin review required before submission.`,
        severity: 'critical',
        channels: ['in_app', 'email'],
        metadata: { incidentId: input.incidentId },
      });
    },

    async notifyDataSubjects(input) {
      await notifications.send({
        tenantId: input.tenantId,
        type: 'breach.subject_notification_prepared',
        title: 'Subject notification ready for review',
        message: `Subject notification template ready for ${input.affectedCount} affected subjects on incident ${input.incidentId}.`,
        severity: 'critical',
        channels: ['in_app', 'email'],
        metadata: { incidentId: input.incidentId, affectedCount: input.affectedCount },
      });
    },
  };
}
