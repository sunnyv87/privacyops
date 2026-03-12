import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Core modules
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { TenantModule } from './core/tenant/tenant.module';
import { AuditModule } from './core/audit/audit.module';
import { EventsModule } from './core/events/events.module';
import { SearchModule } from './core/search/search.module';
import { WorkflowModule } from './core/workflow/workflow.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { SecurityEventsModule } from './core/security/security-events.module';

// Guards
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { TenantGuard } from './core/tenant/guards/tenant.guard';
import { PermissionsGuard } from './core/auth/guards/permissions.guard';

// Interceptors
import { FieldMaskInterceptor } from './core/auth/interceptors/field-mask.interceptor';

// Feature modules (existing)
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
import { ScimModule } from './modules/scim/scim.module';
import { HealthModule } from './core/health/health.module';

// Feature modules (new — Modules 5-11, 20)
import { DataGraphModule } from './modules/data-graph/data-graph.module';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { ShadowDataModule } from './modules/shadow-data/shadow-data.module';
import { LineageModule } from './modules/lineage/lineage.module';
import { AttackPathsModule } from './modules/attack-paths/attack-paths.module';
import { RemediationModule } from './modules/remediation/remediation.module';
import { AiGovernanceModule } from './modules/ai-governance/ai-governance.module';

// AI-Native Upgrade Modules (Modules 1, 5, 10, 12, 13, 14)
import { CoPilotModule } from './modules/co-pilot/co-pilot.module';
import { ThreatHuntingModule } from './modules/threat-hunting/threat-hunting.module';
import { AdaptivePoliciesModule } from './modules/adaptive-policies/adaptive-policies.module';
import { SecurityValidationModule } from './modules/security-validation/security-validation.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { PlatformOptimizationModule } from './modules/platform-optimization/platform-optimization.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
    CryptoModule,
    AuthModule.register(),
    TenantModule,
    AuditModule,
    EventsModule,
    SearchModule,
    WorkflowModule,
    NotificationsModule,
    SecurityEventsModule,
    HealthModule,

    // Feature modules (existing — upgraded)
    UsersModule,
    ScimModule,
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

    // Feature modules (new)
    DataGraphModule,
    IdentityAccessModule,
    ShadowDataModule,
    LineageModule,
    AttackPathsModule,
    RemediationModule,
    AiGovernanceModule,

    // AI-Native Upgrade Modules
    CoPilotModule,
    ThreatHuntingModule,
    AdaptivePoliciesModule,
    SecurityValidationModule,
    ObservabilityModule,
    PlatformOptimizationModule,
  ],
  providers: [
    // Global guards (applied in order)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: FieldMaskInterceptor },
  ],
})
export class AppModule {}
