import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { RateLimiterService } from './rate-limiter.service';
import { SecretsManagerService } from './secrets-manager.service';

/**
 * SecurityEventsModule provides the SecurityEventsService which handles
 * security event emission, hook registration, and automated responses.
 * Also provides tenant-aware rate limiting and secrets management.
 *
 * Depends on (via @Global modules):
 * - AuditModule: for AuditService (audit logging)
 * - EventsModule: for EventBusService (NATS publishing)
 * - NotificationsModule: for NotificationsService (alerts)
 * - PrismaModule: for database access
 */
@Module({
  providers: [SecurityEventsService, RateLimiterService, SecretsManagerService],
  exports: [SecurityEventsService, RateLimiterService, SecretsManagerService],
})
export class SecurityEventsModule {}
