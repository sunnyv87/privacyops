import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';

/**
 * SecurityEventsModule provides the SecurityEventsService which handles
 * security event emission, hook registration, and automated responses.
 *
 * Depends on (via @Global modules):
 * - AuditModule: for AuditService (audit logging)
 * - EventsModule: for EventBusService (NATS publishing)
 * - NotificationsModule: for NotificationsService (alerts)
 * - PrismaModule: for database access
 */
@Module({
  providers: [SecurityEventsService],
  exports: [SecurityEventsService],
})
export class SecurityEventsModule {}
