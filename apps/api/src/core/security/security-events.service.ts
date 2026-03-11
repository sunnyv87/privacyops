import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditService, SecurityEvent, SecurityEventType } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { NotificationsService } from '@/core/notifications/notifications.service';
import { PrismaService } from '@/core/prisma/prisma.service';

export interface SecurityHook {
  name: string;
  handler: (event: SecurityEvent) => Promise<void>;
}

interface LoginAttempt {
  timestamp: number;
  actorId: string;
  tenantId: string;
}

@Injectable()
export class SecurityEventsService implements OnModuleInit {
  private readonly logger = new Logger(SecurityEventsService.name);

  /**
   * Hooks registered per event type. Key '*' hooks run for all events.
   */
  private hooks: Map<string, SecurityHook[]> = new Map();

  /**
   * Tracks recent login failures for lockout detection.
   * Key: `${tenantId}:${actorId}`, Value: timestamps of failures.
   */
  private loginFailures: Map<string, number[]> = new Map();

  private static readonly LOCKOUT_THRESHOLD = 5;
  private static readonly LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registerBuiltInHooks();
    this.logger.log('SecurityEventsService initialized with built-in hooks');
  }

  /**
   * Register a hook to be called when a specific event type (or '*' for all) fires.
   */
  registerHook(eventType: string | '*', hook: SecurityHook): void {
    const existing = this.hooks.get(eventType) || [];
    existing.push(hook);
    this.hooks.set(eventType, existing);
    this.logger.log(`Registered security hook "${hook.name}" for event "${eventType}"`);
  }

  /**
   * Emit a security event: logs to audit, publishes to NATS, and runs registered hooks.
   */
  async emit(event: SecurityEvent): Promise<void> {
    // 1. Log to audit trail (also publishes to NATS internally)
    await this.auditService.logSecurityEvent(event);

    // 2. Execute hooks for this specific event type
    const typeHooks = this.hooks.get(event.eventType) || [];
    const wildcardHooks = this.hooks.get('*') || [];
    const allHooks = [...typeHooks, ...wildcardHooks];

    for (const hook of allHooks) {
      try {
        await hook.handler(event);
      } catch (error) {
        this.logger.error(
          `Security hook "${hook.name}" failed for event ${event.eventType}: ${error}`,
        );
      }
    }
  }

  /**
   * Registers built-in security hooks for automated responses.
   */
  private registerBuiltInHooks(): void {
    // Hook: Account lockout after repeated login failures
    this.registerHook('login_failure', {
      name: 'auto_lockout_on_repeated_failures',
      handler: async (event: SecurityEvent) => {
        if (!event.actorId) return;

        const key = `${event.tenantId}:${event.actorId}`;
        const now = Date.now();
        const cutoff = now - SecurityEventsService.LOCKOUT_WINDOW_MS;

        // Get existing failures and prune old ones
        const failures = (this.loginFailures.get(key) || []).filter(
          (ts) => ts > cutoff,
        );
        failures.push(now);
        this.loginFailures.set(key, failures);

        if (failures.length >= SecurityEventsService.LOCKOUT_THRESHOLD) {
          this.logger.warn(
            `Account ${event.actorId} in tenant ${event.tenantId} locked after ${failures.length} failed login attempts`,
          );

          // Clear the failure tracker for this account
          this.loginFailures.delete(key);

          // Emit account_locked event
          await this.emit({
            tenantId: event.tenantId,
            eventType: 'account_locked',
            actorId: event.actorId,
            targetId: event.actorId,
            metadata: {
              reason: 'repeated_login_failures',
              failureCount: failures.length,
              windowMinutes: 5,
            },
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
          });
        }
      },
    });

    // Hook: Clear login failure counter on successful login
    this.registerHook('login_success', {
      name: 'clear_failures_on_success',
      handler: async (event: SecurityEvent) => {
        if (!event.actorId) return;
        const key = `${event.tenantId}:${event.actorId}`;
        this.loginFailures.delete(key);
      },
    });

    // Hook: Send notification on suspicious activity
    this.registerHook('suspicious_activity', {
      name: 'notify_on_suspicious_activity',
      handler: async (event: SecurityEvent) => {
        try {
          await this.notifications.send({
            tenantId: event.tenantId,
            type: 'security.suspicious_activity',
            title: 'Suspicious Activity Detected',
            message: `Suspicious activity detected${event.actorId ? ` for user ${event.actorId}` : ''}. ${event.metadata?.description || 'Review audit logs for details.'}`,
            severity: 'critical',
            channels: ['in_app', 'email', 'webhook'],
            metadata: {
              eventType: event.eventType,
              actorId: event.actorId,
              targetId: event.targetId,
              ipAddress: event.ipAddress,
              ...event.metadata,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send suspicious activity notification: ${error}`,
          );
        }
      },
    });

    // Hook: Notify on account lockout
    this.registerHook('account_locked', {
      name: 'notify_on_account_locked',
      handler: async (event: SecurityEvent) => {
        try {
          await this.notifications.send({
            tenantId: event.tenantId,
            type: 'security.account_locked',
            title: 'Account Locked',
            message: `Account ${event.targetId || event.actorId} has been locked due to ${event.metadata?.reason || 'security policy'}.`,
            severity: 'critical',
            channels: ['in_app', 'email'],
            metadata: {
              actorId: event.actorId,
              targetId: event.targetId,
              ...event.metadata,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send account locked notification: ${error}`,
          );
        }
      },
    });

    // Hook: Require confirmation / notify on bulk deletion
    this.registerHook('bulk_deletion', {
      name: 'notify_on_bulk_deletion',
      handler: async (event: SecurityEvent) => {
        try {
          await this.notifications.send({
            tenantId: event.tenantId,
            type: 'security.bulk_deletion',
            title: 'Bulk Deletion Performed',
            message: `A bulk deletion operation was performed${event.actorId ? ` by user ${event.actorId}` : ''}. ${event.metadata?.description || 'Review audit logs for details.'}`,
            severity: 'critical',
            channels: ['in_app', 'email', 'webhook'],
            metadata: {
              actorId: event.actorId,
              targetId: event.targetId,
              ...event.metadata,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send bulk deletion notification: ${error}`,
          );
        }
      },
    });

    // Hook: Notify on unauthorized access
    this.registerHook('unauthorized_access', {
      name: 'notify_on_unauthorized_access',
      handler: async (event: SecurityEvent) => {
        try {
          await this.notifications.send({
            tenantId: event.tenantId,
            type: 'security.unauthorized_access',
            title: 'Unauthorized Access Attempt',
            message: `Unauthorized access attempt detected${event.actorId ? ` by user ${event.actorId}` : ''} from IP ${event.ipAddress || 'unknown'}.`,
            severity: 'critical',
            channels: ['in_app', 'email', 'webhook'],
            metadata: {
              actorId: event.actorId,
              ipAddress: event.ipAddress,
              ...event.metadata,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send unauthorized access notification: ${error}`,
          );
        }
      },
    });
  }
}
