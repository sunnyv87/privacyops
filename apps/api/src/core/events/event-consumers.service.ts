import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { createHash } from 'crypto';
import { EventBusService, PlatformEvent } from './event-bus.service';
import { WorkflowService } from '@/core/workflow/workflow.service';
import { NotificationsService } from '@/core/notifications/notifications.service';
import { PrismaService } from '@/core/prisma/prisma.service';

/**
 * Central event consumer that subscribes to orphaned events and routes them
 * to appropriate services, workflows, and notification channels.
 *
 * This bridges the 93% gap between published and consumed events.
 */
@Injectable()
export class EventConsumersService implements OnModuleInit {
  private readonly logger = new Logger(EventConsumersService.name);

  constructor(
    private readonly events: EventBusService,
    private readonly workflows: WorkflowService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Late-bind PrometheusService into EventBusService (avoids circular DI)
    try {
      const { PrometheusService } = await import('@/core/telemetry/prometheus.service');
      const prometheus = this.moduleRef.get(PrometheusService, { strict: false });
      if (prometheus) {
        this.events.setPrometheus(prometheus);
      }
    } catch {
      // PrometheusService may not be available in test environments
    }

    await this.registerConsumers();
  }

  private async registerConsumers() {
    const consumers: {
      event: string;
      durable: string;
      handler: (e: PlatformEvent) => Promise<void>;
    }[] = [
      // --- Workflow triggers for events that have existing workflows but no trigger ---
      {
        event: 'incident.breach_detected',
        durable: 'consumer-breach-workflow',
        handler: async (e) => {
          this.logger.log(`Breach detected: ${e.data.incidentId}`);
          await this.workflows.startBreachWorkflow({
            incidentId: e.data.incidentId,
            tenantId: e.tenantId,
            severity: e.data.severity ?? 'high',
            deadlineIso:
              e.data.deadlineIso ??
              new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          });
        },
      },
      {
        event: 'dsar.received',
        durable: 'consumer-dsar-workflow',
        handler: async (e) => {
          this.logger.log(`DSAR received: ${e.data.requestId}`);
          await this.workflows.startDsarWorkflow({
            requestId: e.data.requestId,
            tenantId: e.tenantId,
            type: e.data.type ?? 'access',
            dueDateIso:
              e.data.dueDateIso ??
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        },
      },

      // --- Notification consumers ---
      {
        event: 'incident.reported',
        durable: 'consumer-incident-notify',
        handler: async (e) => {
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'incident.reported',
            title: `Incident Reported: ${e.data.referenceNumber ?? e.data.incidentId}`,
            message: `A ${e.data.severity ?? 'unknown'} severity incident has been reported. ${e.data.description ?? ''}`.trim(),
            severity: e.data.severity === 'critical' ? 'critical' : 'warning',
            channels: ['in_app', 'email', 'webhook'],
          });
        },
      },
      {
        event: 'risk.score.changed',
        durable: 'consumer-risk-notify',
        handler: async (e) => {
          const newScore = e.data.newScore ?? e.data.score;
          if (newScore && newScore >= 80) {
            await this.notifications.send({
              tenantId: e.tenantId,
              type: 'risk.critical',
              title: 'Critical Risk Score Change',
              message: `Asset risk score changed to ${newScore}`,
              severity: 'critical',
              channels: ['in_app', 'webhook'],
            });
          }
        },
      },
      {
        event: 'remediation.proposed',
        durable: 'consumer-remediation-notify',
        handler: async (e) => {
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'remediation.proposed',
            title: 'Remediation Proposed — Review Required',
            message: `A remediation plan has been proposed for finding ${e.data.findingId ?? 'unknown'}`,
            severity: 'warning',
            channels: ['in_app', 'email'],
          });
        },
      },
      {
        event: 'connector.health_degraded',
        durable: 'consumer-health-notify',
        handler: async (e) => {
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'connector.health_degraded',
            title: `Connector Health Degraded: ${e.data.connectorName ?? e.data.dataSourceId}`,
            message: `Connector health check failed. Status: ${e.data.status ?? 'degraded'}`,
            severity: 'warning',
            channels: ['in_app', 'webhook'],
          });
        },
      },

      // --- Security event consumers ---
      {
        event: 'security.unauthorized_access',
        durable: 'consumer-security-incident',
        handler: async (e) => {
          this.logger.warn(`Unauthorized access detected for tenant ${e.tenantId}`);
          // Create an incident record for the unauthorized access
          try {
            const now = new Date();
            const count = await this.prisma.incident.count({ where: { tenantId: e.tenantId } });
            await this.prisma.incident.create({
              data: {
                tenantId: e.tenantId,
                referenceNumber: `INC-${now.getFullYear()}-${String(count + 1).padStart(4, '0')}`,
                title: `Auto-generated: Unauthorized access detected`,
                description: `Automated incident from security event. Actor: ${e.data.actorId ?? 'unknown'}. Details: ${JSON.stringify(e.data).slice(0, 500)}`,
                severity: 'high',
                status: 'reported',
                detectedAt: now,
                detectionSource: 'automated',
                isPersonalDataBreach: false,
              },
            });
          } catch (err) {
            this.logger.error(`Failed to create incident from security event: ${err}`);
          }
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'security.unauthorized_access',
            title: 'Security Alert: Unauthorized Access Detected',
            message: `Unauthorized access attempt detected. An incident has been auto-created.`,
            severity: 'critical',
            channels: ['in_app', 'email', 'webhook'],
          });
        },
      },
      {
        event: 'security.suspicious_activity',
        durable: 'consumer-security-suspicious',
        handler: async (e) => {
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'security.suspicious_activity',
            title: 'Suspicious Activity Detected',
            message: `Suspicious activity: ${e.data.description ?? JSON.stringify(e.data).slice(0, 200)}`,
            severity: 'warning',
            channels: ['in_app', 'webhook'],
          });
        },
      },

      // --- Data pipeline consumers ---
      {
        event: 'scan.completed',
        durable: 'consumer-scan-graph-sync',
        handler: async (e) => {
          this.logger.log(`Scan completed, triggering graph sync for tenant ${e.tenantId}`);
          try {
            const syncService = this.moduleRef.get('DataGraphSyncService', { strict: false });
            if (syncService) {
              await syncService.syncAssets(e.tenantId);
            }
          } catch {
            this.logger.warn('DataGraphSyncService not available for post-scan sync');
          }
        },
      },
      {
        event: 'classification.completed',
        durable: 'consumer-classification-graph-sync',
        handler: async (e) => {
          this.logger.log(`Classification completed, updating graph for tenant ${e.tenantId}`);
          try {
            const syncService = this.moduleRef.get('DataGraphSyncService', { strict: false });
            if (syncService) {
              await syncService.syncAssets(e.tenantId);
            }
          } catch {
            this.logger.warn('DataGraphSyncService not available for post-classification sync');
          }
        },
      },
      {
        event: 'remediation.completed',
        durable: 'consumer-remediation-rescore',
        handler: async (e) => {
          this.logger.log(`Remediation completed, triggering risk rescore`);
          try {
            const dspmService = this.moduleRef.get('DspmService', { strict: false });
            if (dspmService && e.data.assetId) {
              await dspmService.recalculateRisk(e.tenantId, e.data.assetId);
            }
          } catch {
            this.logger.warn('DspmService not available for post-remediation rescore');
          }
        },
      },
      {
        event: 'shadow-data.scan.completed',
        durable: 'consumer-shadow-data-rescore',
        handler: async (e) => {
          this.logger.log(`Shadow data scan completed for tenant ${e.tenantId}`);
          try {
            const dspmService = this.moduleRef.get('DspmService', { strict: false });
            if (dspmService && e.data.assetIds?.length) {
              for (const assetId of e.data.assetIds.slice(0, 50)) {
                await dspmService.recalculateRisk(e.tenantId, assetId);
              }
            }
          } catch {
            this.logger.warn('DspmService not available for shadow data rescore');
          }
        },
      },

      // --- Audit trail consumer for compliance events ---
      {
        event: 'compliance.score.changed',
        durable: 'consumer-compliance-audit',
        handler: async (e) => {
          this.logger.log(
            `Compliance score changed for tenant ${e.tenantId}: ${JSON.stringify(e.data)}`,
          );
          try {
            const ts = new Date();
            await this.prisma.auditLog.create({
              data: {
                tenantId: e.tenantId,
                actorType: 'system',
                action: 'compliance.score.changed',
                entityType: 'compliance_score',
                entityId: e.data.frameworkId ?? e.tenantId,
                category: 'compliance',
                severity: 'info',
                changes: e.data,
                timestamp: ts,
                integrityHash: createHash('sha256')
                  .update(`compliance.score.changed:${e.tenantId}:${ts.toISOString()}`)
                  .digest('hex'),
              },
            });
          } catch (err) {
            this.logger.error(`Failed to audit compliance score change: ${err}`);
          }
        },
      },
      {
        event: 'consent.revoked',
        durable: 'consumer-consent-revoked',
        handler: async (e) => {
          this.logger.log(`Consent revoked for tenant ${e.tenantId}`);
          try {
            const tsConsent = new Date();
            await this.prisma.auditLog.create({
              data: {
                tenantId: e.tenantId,
                actorType: 'system',
                action: 'consent.revoked',
                entityType: 'consent',
                entityId: e.data.consentId ?? 'unknown',
                category: 'compliance',
                severity: 'warning',
                changes: e.data,
                timestamp: tsConsent,
                integrityHash: createHash('sha256')
                  .update(`consent.revoked:${e.tenantId}:${tsConsent.toISOString()}`)
                  .digest('hex'),
              },
            });
          } catch (err) {
            this.logger.error(`Failed to audit consent revocation: ${err}`);
          }
          await this.notifications.send({
            tenantId: e.tenantId,
            type: 'consent.revoked',
            title: 'Consent Revoked',
            message: `Data subject consent has been revoked. Review processing activities.`,
            severity: 'warning',
            channels: ['in_app'],
          });
        },
      },
    ];

    let subscribed = 0;
    for (const { event, durable, handler } of consumers) {
      try {
        await this.events.subscribe(event, durable, handler);
        subscribed++;
      } catch {
        this.logger.warn(`Could not subscribe to ${event} (NATS may be unavailable)`);
      }
    }
    this.logger.log(`Event consumers registered: ${subscribed}/${consumers.length}`);
  }
}
