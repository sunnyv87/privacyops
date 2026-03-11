import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { EmailChannel } from './channels/email.channel';
import { WebhookChannel } from './channels/webhook.channel';

export interface NotificationPayload {
  tenantId: string;
  type: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  recipientIds?: string[];
  channels?: ('email' | 'webhook' | 'in_app')[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannel,
    private readonly webhookChannel: WebhookChannel,
  ) {}

  async send(payload: NotificationPayload) {
    const channels = payload.channels || ['in_app'];
    const results: { channel: string; success: boolean; error?: string }[] = [];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            if (payload.recipientIds?.length) {
              const users = await this.prisma.user.findMany({
                where: { id: { in: payload.recipientIds } },
                select: { email: true, name: true },
              });
              for (const user of users) {
                await this.emailChannel.send({
                  to: user.email,
                  subject: payload.title,
                  body: payload.message,
                });
              }
            }
            results.push({ channel: 'email', success: true });
            break;

          case 'webhook':
            await this.webhookChannel.send({
              tenantId: payload.tenantId,
              event: payload.type,
              data: {
                title: payload.title,
                message: payload.message,
                severity: payload.severity,
                metadata: payload.metadata,
              },
            });
            results.push({ channel: 'webhook', success: true });
            break;

          case 'in_app':
            // Store in-app notification (can be polled by frontend)
            this.logger.log(
              `[${payload.tenantId}] IN_APP: ${payload.title} - ${payload.message}`,
            );
            results.push({ channel: 'in_app', success: true });
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification: ${error}`);
        results.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async notifyCriticalFinding(tenantId: string, finding: { assetName: string; score: number }) {
    return this.send({
      tenantId,
      type: 'finding.critical',
      title: 'Critical Risk Finding Detected',
      message: `Asset "${finding.assetName}" has a critical risk score of ${finding.score}`,
      severity: 'critical',
      channels: ['in_app', 'email', 'webhook'],
    });
  }

  async notifyDsarDeadline(tenantId: string, dsar: { reference: string; dueDate: string }) {
    return this.send({
      tenantId,
      type: 'dsar.deadline',
      title: 'DSAR Deadline Approaching',
      message: `DSAR ${dsar.reference} is due on ${dsar.dueDate}`,
      severity: 'warning',
      channels: ['in_app', 'email'],
    });
  }

  async notifyBreachDetected(tenantId: string, incident: { reference: string; severity: string }) {
    return this.send({
      tenantId,
      type: 'breach.detected',
      title: 'Data Breach Detected',
      message: `Incident ${incident.reference} (${incident.severity}) requires immediate attention`,
      severity: 'critical',
      channels: ['in_app', 'email', 'webhook'],
    });
  }
}
