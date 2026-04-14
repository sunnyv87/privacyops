import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

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

// SaaS core modules
import { MeteringModule } from './core/metering/metering.module';
import { LicensingModule } from './core/licensing/licensing.module';
import { BillingModule } from './core/billing/billing.module';
import { FeatureGateGuard } from './core/licensing/guards/feature-gate.guard';

// Guards
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { TenantGuard } from './core/tenant/guards/tenant.guard';
import { PermissionsGuard } from './core/auth/guards/permissions.guard';
import { AbacGuard } from './core/auth/guards/abac.guard';
import { ApprovalGuard } from './core/auth/guards/approval.guard';
import { CsrfGuard } from './core/security/csrf.guard';

// Interceptors
import { FieldMaskInterceptor } from './core/auth/interceptors/field-mask.interceptor';
import { MetricsInterceptor } from './modules/observability/metrics.interceptor';
import { TimeoutInterceptor } from './core/telemetry/timeout.interceptor';

// Telemetry
import { TelemetryModule } from './core/telemetry/telemetry.module';
import { GlobalExceptionFilter } from './core/telemetry/global-exception.filter';

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
    // AuditModule + EventsModule must load BEFORE TenantModule because
    // TenantService now depends on AuditService and (via LicensingModule)
    // LicensingService. MeteringModule + LicensingModule are @Global so
    // their order among the core modules is not load-order-sensitive.
    AuditModule,
    EventsModule,
    MeteringModule,
    LicensingModule,
    BillingModule,
    TenantModule,
    SearchModule,
    WorkflowModule,
    NotificationsModule,
    SecurityEventsModule,
    HealthModule,
    TelemetryModule,

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
    // Global guards (applied in order: CSRF -> JWT -> Tenant -> Permissions
    // -> FeatureGate -> ABAC -> Approval). FeatureGateGuard runs AFTER
    // PermissionsGuard so RBAC is evaluated first and licensing is a
    // second-stage check — a user who lacks permission is denied with 403
    // before we reveal whether the feature is licensed. It runs BEFORE
    // ABAC and Approval because those two only apply once the request is
    // known to be permitted by RBAC + licensing.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeatureGateGuard },
    { provide: APP_GUARD, useClass: AbacGuard },
    { provide: APP_GUARD, useClass: ApprovalGuard },
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: FieldMaskInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
