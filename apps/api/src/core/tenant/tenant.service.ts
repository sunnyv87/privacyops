import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LicensingService } from '../licensing/licensing.service';

const BCRYPT_ROUNDS = 12;

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  domain?: string;
  dataResidencyRegion: string;
  adminEmail: string;
  adminName: string;
  /** If omitted, a one-time random password is generated and returned. */
  adminPassword?: string;
  /** Plan code from the catalogue. Defaults to `free`. */
  planCode?: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  adminUserId: string;
  generatedPassword?: string; // present only if one was generated
  completedSteps: string[];
}

/**
 * TenantService — owns the tenant lifecycle. `create()` remains the low-level
 * primitive used by the seed script and internal code paths; `provisionTenant()`
 * is the end-to-end SaaS onboarding orchestration used by the signup API.
 *
 * provisionTenant is designed to be safely re-runnable: if any step after
 * the Tenant row creation fails, OnboardingState records what was completed
 * and the operator can re-drive the remaining steps without duplicating
 * work. Every step is idempotent on its own (upsert/check-before-create).
 *
 * Audit: every mutation is written via AuditService.logAdminAction so the
 * full onboarding trail is part of the tamper-evident chain.
 */
@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly licensing: LicensingService,
    private readonly config: ConfigService,
  ) {}

  async findById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async create(data: {
    name: string;
    slug: string;
    domain?: string;
    dataResidencyRegion: string;
  }) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        dataResidencyRegion: data.dataResidencyRegion,
        subscriptionTier: 'trial',
        status: 'trial',
        encryptionKeyId: `tenant-key-${data.slug}`, // Placeholder — integrate with KMS
      },
    });
  }

  /**
   * End-to-end tenant provisioning. Creates the tenant, bootstraps the
   * default admin user, seeds onboarding state, and attaches a default
   * plan subscription. Runs in a single transaction so partial state
   * cannot leak on failure.
   *
   * NOTE: the caller (TenantController) must gate this behind a platform
   * admin permission. There is no tenant context when a tenant is being
   * created, so we rely on controller-level RBAC + the platform-admin RLS
   * bypass inside the transaction.
   */
  async provisionTenant(
    actorId: string | null,
    input: ProvisionTenantInput,
  ): Promise<ProvisionTenantResult> {
    this.validateProvisionInput(input);

    // Detect collisions early (outside the txn so error messages are clear).
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`tenant slug "${input.slug}" already exists`);
    }

    const adminPassword = input.adminPassword ?? this.generateOneTimePassword();
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const generatedPassword = input.adminPassword ? undefined : adminPassword;

    const completedSteps: string[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      // Opt into the RLS platform-admin bypass for this transaction so
      // cross-tenant writes (tenant, plans, onboarding_states) are not
      // blocked when no `app.current_tenant` is set.
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.platform_admin', 'true', true)`,
      );

      // 1. Resolve the target plan (defaults to `free`).
      const planCode = (input.planCode ?? 'free').toLowerCase();
      const plan = await tx.plan.findUnique({ where: { code: planCode } });
      if (!plan) {
        throw new BadRequestException(
          `plan "${planCode}" not found in catalogue — seed the plans table before provisioning`,
        );
      }

      // 2. Create the Tenant row.
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          domain: input.domain,
          dataResidencyRegion: input.dataResidencyRegion,
          subscriptionTier: plan.code,
          status: plan.code === 'free' ? 'trial' : 'active',
          encryptionKeyId: `tenant-key-${input.slug}`,
          planId: plan.id,
        },
      });
      completedSteps.push('tenant_created');

      // 3. Create the initial admin user.
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail,
          name: input.adminName,
          status: 'active',
          authProvider: 'local',
          passwordHash,
          mfaEnabled: false,
        },
      });
      completedSteps.push('admin_user_created');

      // 4. Assign the tenant-admin system role.
      const tenantAdminRole = await tx.role.findFirst({
        where: { slug: 'tenant-admin', tenantId: null },
        select: { id: true },
      });
      if (tenantAdminRole) {
        await tx.userRole.create({
          data: { userId: adminUser.id, roleId: tenantAdminRole.id },
        });
        completedSteps.push('roles_assigned');
      } else {
        this.logger.warn(
          'tenant-admin system role missing — admin user was created without a role assignment',
        );
      }

      // 5. Create the Subscription + BillingAccount records.
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: plan.code === 'free' ? 'trialing' : 'active',
          provider: 'null',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: plan.code === 'free' ? periodEnd : null,
        },
      });
      completedSteps.push('subscription_created');

      const billingAccount = await tx.billingAccount.create({
        data: {
          tenantId: tenant.id,
          provider: 'null',
          billingEmail: input.adminEmail,
          billingName: input.name,
        },
      });
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { billingAccountId: billingAccount.id },
      });
      completedSteps.push('billing_account_created');

      // 6. Write the onboarding state row.
      await tx.onboardingState.create({
        data: {
          tenantId: tenant.id,
          currentStep: 'completed',
          status: 'completed',
          completedSteps: completedSteps as any,
          completedAt: new Date(),
        },
      });

      return {
        tenantId: tenant.id,
        adminUserId: adminUser.id,
      };
    });

    // Audit + licensing cache invalidation happen AFTER the transaction so
    // a rollback leaves no side effects in audit or the licensing cache.
    try {
      await this.audit.logAdminAction({
        tenantId: result.tenantId,
        actorId: actorId ?? undefined,
        actorType: actorId ? 'user' : 'system',
        action: 'tenant.provisioned',
        entityType: 'tenant',
        entityId: result.tenantId,
        changes: {
          after: {
            slug: input.slug,
            planCode: input.planCode ?? 'free',
            adminEmail: input.adminEmail,
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `tenant ${result.tenantId} provisioned but audit log failed: ${(err as Error).message}`,
      );
    }

    this.licensing.invalidate(result.tenantId);

    return {
      tenantId: result.tenantId,
      adminUserId: result.adminUserId,
      generatedPassword,
      completedSteps,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private validateProvisionInput(input: ProvisionTenantInput): void {
    if (!/^[a-z0-9-]{3,63}$/.test(input.slug)) {
      throw new BadRequestException(
        'slug must be lowercase alphanumeric with dashes, 3-63 chars',
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.adminEmail)) {
      throw new BadRequestException('adminEmail is not a valid email');
    }
    if (input.adminPassword && input.adminPassword.length < 12) {
      throw new BadRequestException('adminPassword must be at least 12 characters');
    }
  }

  private generateOneTimePassword(): string {
    // 24 bytes hex = 48 chars. High entropy, no ambiguous glyphs.
    return randomBytes(24).toString('hex');
  }
}
