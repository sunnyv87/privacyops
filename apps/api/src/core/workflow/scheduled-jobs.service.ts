import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/core/prisma/prisma.service';
import { WorkflowService } from './workflow.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { NotificationsService } from '@/core/notifications/notifications.service';

/**
 * Scheduled jobs for recurring platform operations.
 * Uses @nestjs/schedule cron decorators to run within the API process.
 */
@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowService,
    private readonly events: EventBusService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Retention policy enforcement — Daily at 1:00 AM
  // ---------------------------------------------------------------------------

  @Cron('0 1 * * *', { name: 'retention-enforcement' })
  async enforceRetentionPolicies() {
    this.logger.log('Starting scheduled retention policy enforcement');

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const expiredPolicies = await this.prisma.retentionPolicy.findMany({
          where: {
            tenantId: tenant.id,
            status: 'active',
          },
        });

        for (const policy of expiredPolicies) {
          // Find assets that have exceeded their retention period
          const expiredAssets = await this.prisma.asset.findMany({
            where: {
              tenantId: tenant.id,
              deletedAt: null,
              createdAt: {
                lt: new Date(
                  Date.now() - (policy.retentionPeriodDays ?? 365) * 24 * 60 * 60 * 1000,
                ),
              },
            },
            select: { id: true },
            take: 100,
          });

          if (expiredAssets.length > 0) {
            await this.events.publish({
              type: 'retention.policy.triggered',
              tenantId: tenant.id,
              data: {
                policyId: policy.id,
                assetIds: expiredAssets.map((a) => a.id),
                assetCount: expiredAssets.length,
              },
              timestamp: new Date(),
            });
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Retention enforcement failed for tenant ${tenant.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Retention policy enforcement completed');
  }

  // ---------------------------------------------------------------------------
  // Stale data review — Daily at 3:00 AM
  // ---------------------------------------------------------------------------

  @Cron('0 3 * * *', { name: 'stale-data-review' })
  async reviewStaleData() {
    this.logger.log('Starting scheduled stale data review');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const staleDataSources = await this.prisma.dataSource.findMany({
          where: {
            tenantId: tenant.id,
            OR: [
              { lastScanAt: { lt: thirtyDaysAgo } },
              { lastScanAt: null },
            ],
          },
          select: { id: true, name: true },
        });

        if (staleDataSources.length > 0) {
          await this.notifications.send({
            tenantId: tenant.id,
            type: 'stale_data.review_needed',
            title: `${staleDataSources.length} data sources need re-scanning`,
            message: `The following data sources have not been scanned in 30+ days: ${staleDataSources.map((ds) => ds.name).join(', ')}`,
            severity: 'warning',
            channels: ['in_app'],
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Stale data review failed for tenant ${tenant.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Stale data review completed');
  }

  // ---------------------------------------------------------------------------
  // Vendor reassessment reminders — Daily at 9:00 AM
  // ---------------------------------------------------------------------------

  @Cron('0 9 * * *', { name: 'vendor-reassessment-reminders' })
  async sendVendorReassessmentReminders() {
    this.logger.log('Starting scheduled vendor reassessment reminders');

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const dueVendors = await this.prisma.vendor.findMany({
          where: {
            tenantId: tenant.id,
            nextReviewDate: { lte: sevenDaysFromNow },
            status: { not: 'archived' },
          },
          select: { id: true, name: true, nextReviewDate: true },
        });

        for (const vendor of dueVendors) {
          await this.events.publish({
            type: 'vendor.assessment.due',
            tenantId: tenant.id,
            data: {
              vendorId: vendor.id,
              vendorName: vendor.name,
              dueDate: vendor.nextReviewDate?.toISOString(),
            },
            timestamp: new Date(),
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Vendor reminder failed for tenant ${tenant.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Vendor reassessment reminders completed');
  }

  // ---------------------------------------------------------------------------
  // Breach SLA monitoring — Every 15 minutes
  // ---------------------------------------------------------------------------

  @Cron('*/15 * * * *', { name: 'breach-sla-monitoring' })
  async monitorBreachSlas() {
    const openBreaches = await this.prisma.incident.findMany({
      where: {
        isPersonalDataBreach: true,
        status: { in: ['open', 'investigating', 'contained'] },
        resolvedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        severity: true,
        reportedAt: true,
        title: true,
      },
    });

    const now = Date.now();
    const seventyTwoHoursMs = 72 * 60 * 60 * 1000;

    for (const breach of openBreaches) {
      const elapsed = now - new Date(breach.reportedAt).getTime();
      const remaining = seventyTwoHoursMs - elapsed;

      // Alert if less than 12 hours remaining
      if (remaining > 0 && remaining < 12 * 60 * 60 * 1000) {
        const hoursRemaining = Math.round(remaining / (60 * 60 * 1000));
        await this.notifications.send({
          tenantId: breach.tenantId,
          type: 'breach.sla_warning',
          title: `Breach SLA Warning: ${hoursRemaining}h remaining`,
          message: `Incident "${breach.title}" (${breach.id}) must be reported to regulators within ${hoursRemaining} hours to meet the 72-hour notification deadline.`,
          severity: 'critical',
          channels: ['in_app', 'email', 'webhook'],
        });
      }

      // Alert if SLA already breached
      if (remaining <= 0) {
        await this.notifications.send({
          tenantId: breach.tenantId,
          type: 'breach.sla_exceeded',
          title: 'BREACH SLA EXCEEDED — 72h notification deadline passed',
          message: `Incident "${breach.title}" (${breach.id}) has exceeded the 72-hour regulatory notification deadline.`,
          severity: 'critical',
          channels: ['in_app', 'email', 'webhook'],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Periodic access review — Weekly on Sundays at 2:00 AM
  // ---------------------------------------------------------------------------

  @Cron('0 2 * * 0', { name: 'periodic-access-review' })
  async performAccessReview() {
    this.logger.log('Starting scheduled periodic access review');

    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        // Find users with no activity in 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const inactiveUsers = await this.prisma.user.findMany({
          where: {
            tenantId: tenant.id,
            status: 'active',
            lastLoginAt: { lt: ninetyDaysAgo },
          },
          select: { id: true, email: true, name: true, lastLoginAt: true },
        });

        if (inactiveUsers.length > 0) {
          await this.notifications.send({
            tenantId: tenant.id,
            type: 'access.review_needed',
            title: `${inactiveUsers.length} users inactive for 90+ days`,
            message: `Consider reviewing access for: ${inactiveUsers.map((u) => u.email).slice(0, 10).join(', ')}${inactiveUsers.length > 10 ? ` and ${inactiveUsers.length - 10} more` : ''}`,
            severity: 'warning',
            channels: ['in_app'],
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Access review failed for tenant ${tenant.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Periodic access review completed');
  }
}
