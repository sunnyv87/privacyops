import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

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
    });
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
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
      include: { userRoles: { include: { role: true } } },
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
        include: { userRoles: { include: { role: true } } },
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
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(tenantId: string, id: string, actorId: string, dto: UpdateUserDto) {
    await this.findById(tenantId, id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email && { email: dto.email }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.mfaEnabled !== undefined && { mfaEnabled: dto.mfaEnabled }),
      },
      include: { userRoles: { include: { role: true } } },
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      changes: dto,
    });

    return user;
  }

  async assignRoles(tenantId: string, userId: string, actorId: string, roleIds: string[]) {
    await this.findById(tenantId, userId);

    // Remove existing roles and assign new ones
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
    await this.findById(tenantId, id);

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: 'user.deactivated',
      entityType: 'User',
      entityId: id,
    });
  }
}
