import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

// Core modules
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { AuditModule } from './core/audit/audit.module';
import { EventsModule } from './core/events/events.module';
import { SearchModule } from './core/search/search.module';
import { WorkflowModule } from './core/workflow/workflow.module';
import { NotificationsModule } from './core/notifications/notifications.module';

// Guards
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { TenantGuard } from './core/tenant/guards/tenant.guard';
import { PermissionsGuard } from './core/auth/guards/permissions.guard';

// Feature modules
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { DspmModule } from './modules/dspm/dspm.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DsarModule } from './modules/dsar/dsar.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { RetentionModule } from './modules/retention/retention.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { RopaModule } from './modules/ropa/ropa.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './core/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Core
    PrismaModule,
    AuthModule,
    TenantModule,
    AuditModule,
    EventsModule,
    SearchModule,
    WorkflowModule,
    NotificationsModule,
    HealthModule,

    // Feature modules
    UsersModule,
    ConnectorsModule,
    DiscoveryModule,
    ClassificationModule,
    DspmModule,
    ConsentModule,
    DsarModule,
    AssessmentsModule,
    IncidentsModule,
    RetentionModule,
    VendorsModule,
    ComplianceModule,
    RopaModule,
    DashboardModule,
  ],
  providers: [
    // Global guards (applied in order)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
