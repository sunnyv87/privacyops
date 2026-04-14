import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Prisma selection whitelist for user responses.
 * Excludes passwordHash, mfaSecret, mfaRecoveryCodes, and other PII that must
 * never leave the service layer.
 */
const SAFE_USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  isActive: true,
  mfaEnabled: true,
  authProvider: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: {
      role: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          isSystem: true,
        },
      },
    },
  },
} as const;

/**
 * Role slugs that are considered privileged. Assignment to these requires an
 * actor holding an equivalent or higher privileged role AND an approval
 * challenge (ApprovalGuard enforces the challenge at the controller layer).
 */
const PRIVILEGED_ROLE_SLUGS = new Set([
  'admin',
  'super-admin',
  'tenant-admin',
  'security-admin',
  'privacy-officer',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.validateRoleAssignment(tenantId, actorId, dto.roleIds);
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
          : null,
        isActive: true,
        authProvider: 'local',
        userRoles: dto.roleIds
          ? {
              create: dto.roleIds.map((roleId) => ({
                roleId,
                assignedBy: actorId,
              })),
            }
          : undefined,
      },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      changes: { email: dto.email, name: dto.name },
    });

    return user;
  }

  async findAll(
    tenantId: string,
    filters?: { role?: string; page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, role } = filters || {};
    const where: any = { tenantId };
    if (role) {
      where.userRoles = { some: { role: { slug: role } } };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(tenantId: string, id: string, actorId: string, dto: UpdateUserDto) {
    // Forbid self-deactivation via this API — use /auth/me for profile updates.
    if (id === actorId && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    // Tenant-scoped existence check.
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Tenant-scoped update: updateMany ensures the tenantId filter is enforced
    // at the database layer and prevents cross-tenant escalation even if the
    // upstream resolution is compromised.
    const { count } = await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email && { email: dto.email }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.mfaEnabled !== undefined && { mfaEnabled: dto.mfaEnabled }),
      },
    });

    if (count === 0) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      changes: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.mfaEnabled !== undefined && { mfaEnabled: dto.mfaEnabled }),
      },
    });

    return user;
  }

  async assignRoles(
    tenantId: string,
    userId: string,
    actorId: string,
    roleIds: string[],
  ) {
    // Forbid self-role modification — users cannot grant themselves new
    // permissions. Privileged role changes must be performed by a different
    // admin and gated by an approval request.
    if (userId === actorId) {
      throw new ForbiddenException(
        'Cannot modify your own roles. Ask another administrator.',
      );
    }

    // Tenant-scoped target user existence check.
    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (roleIds.length > 0) {
      await this.validateRoleAssignment(tenantId, actorId, roleIds);
    }

    // Remove existing roles and assign new ones atomically.
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      ...roleIds.map((roleId) =>
        this.prisma.userRole.create({
          data: { userId, roleId, assignedBy: actorId },
        }),
      ),
    ]);

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.roles.assigned',
      entityType: 'User',
      entityId: userId,
      changes: { roleIds },
    });

    return this.findById(tenantId, userId);
  }

  async delete(tenantId: string, id: string, actorId: string) {
    if (id === actorId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const { count } = await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });

    if (count === 0) {
      throw new NotFoundException(`User ${id} not found`);
    }

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.deactivated',
      entityType: 'User',
      entityId: id,
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that:
   *   1. Every role exists and belongs to this tenant (or is a system role).
   *   2. If any privileged role is being assigned, the actor must already hold
   *      a privileged role themselves. This prevents an attacker with only
   *      `users:users:update` from promoting themselves or another user to
   *      admin.
   */
  private async validateRoleAssignment(
    tenantId: string,
    actorId: string,
    roleIds: string[],
  ): Promise<void> {
    const validRoles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      select: { id: true, slug: true, isSystem: true },
    });

    const validIds = new Set(validRoles.map((r) => r.id));
    const invalidIds = roleIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid role IDs for this tenant: ${invalidIds.join(', ')}`,
      );
    }

    const targetHasPrivilegedRole = validRoles.some((r) =>
      PRIVILEGED_ROLE_SLUGS.has(r.slug),
    );

    if (targetHasPrivilegedRole) {
      const actorRoles = await this.prisma.userRole.findMany({
        where: { userId: actorId },
        select: { role: { select: { slug: true, isSystem: true } } },
      });
      const actorHasPrivilegedRole = actorRoles.some((ur) =>
        PRIVILEGED_ROLE_SLUGS.has(ur.role.slug),
      );
      if (!actorHasPrivilegedRole) {
        throw new ForbiddenException(
          'Only administrators can assign privileged roles',
        );
      }
    }
  }
}
