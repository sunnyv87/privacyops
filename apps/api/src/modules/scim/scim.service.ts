import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

// SCIM 2.0 Schema URIs
const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

export interface ScimUser {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{ value: string; primary: boolean; type?: string }>;
  active: boolean;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface ScimGroup {
  schemas: string[];
  id: string;
  displayName: string;
  members: Array<{ value: string; display: string; $ref?: string }>;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface ScimPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: any;
}

@Injectable()
export class ScimService {
  private readonly logger = new Logger(ScimService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Users
  // =========================================================================

  async listUsers(
    tenantId: string,
    query: {
      filter?: string;
      startIndex?: number;
      count?: number;
    },
  ): Promise<ScimListResponse<ScimUser>> {
    const startIndex = Math.max(1, query.startIndex || 1);
    const count = Math.min(100, Math.max(1, query.count || 100));
    const skip = startIndex - 1;

    const where: any = { tenantId, deletedAt: null };
    if (query.filter) {
      this.applyUserFilter(where, query.filter);
    }

    const [users, totalResults] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: count,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: users.map((u) => this.toScimUser(u)),
    };
  }

  async getUser(tenantId: string, id: string): Promise<ScimUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.scimError(404, `User ${id} not found`),
      );
    }

    return this.toScimUser(user);
  }

  async createUser(
    tenantId: string,
    payload: any,
  ): Promise<ScimUser> {
    const email = this.extractEmail(payload);
    if (!email) {
      throw new BadRequestException(
        this.scimError(400, 'userName or emails[].value is required'),
      );
    }

    // Check for existing user
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        this.scimError(409, `User with email ${email} already exists`),
      );
    }

    const name = this.extractName(payload);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name,
        status: payload.active === false ? 'disabled' : 'active',
        authProvider: 'scim',
        externalId: payload.externalId || null,
      },
    });

    this.logger.log(`SCIM: Created user ${user.id} (${email}) in tenant ${tenantId}`);

    return this.toScimUser(user);
  }

  async replaceUser(
    tenantId: string,
    id: string,
    payload: any,
  ): Promise<ScimUser> {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        this.scimError(404, `User ${id} not found`),
      );
    }

    const email = this.extractEmail(payload);
    const name = this.extractName(payload);

    // Check email uniqueness if changed
    if (email && email !== existing.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { tenantId, email, deletedAt: null, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          this.scimError(409, `User with email ${email} already exists`),
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(email && { email }),
        ...(name && { name }),
        ...(payload.active !== undefined && {
          status: payload.active ? 'active' : 'disabled',
        }),
        ...(payload.externalId !== undefined && {
          externalId: payload.externalId,
        }),
      },
    });

    this.logger.log(`SCIM: Replaced user ${id} in tenant ${tenantId}`);

    return this.toScimUser(user);
  }

  async patchUser(
    tenantId: string,
    id: string,
    patchBody: { schemas?: string[]; Operations: ScimPatchOperation[] },
  ): Promise<ScimUser> {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        this.scimError(404, `User ${id} not found`),
      );
    }

    const updateData: any = {};

    for (const op of patchBody.Operations) {
      const operation = op.op.toLowerCase();
      const path = op.path?.toLowerCase();

      if (operation === 'replace' || operation === 'add') {
        if (path === 'active' || (!path && op.value?.active !== undefined)) {
          const active = path === 'active' ? op.value : op.value.active;
          updateData.status = active ? 'active' : 'disabled';
        }
        if (path === 'username' || path === 'emails' || (!path && op.value?.userName)) {
          const email = path === 'username'
            ? op.value
            : path === 'emails'
              ? (Array.isArray(op.value) ? op.value[0]?.value : op.value?.value)
              : op.value.userName;
          if (email && typeof email === 'string') {
            updateData.email = email;
          }
        }
        if (path === 'name.givenname' || path === 'name.familyname' || (!path && op.value?.name)) {
          if (!path && op.value?.name) {
            const parts = [];
            if (op.value.name.givenName) parts.push(op.value.name.givenName);
            if (op.value.name.familyName) parts.push(op.value.name.familyName);
            if (parts.length > 0) updateData.name = parts.join(' ');
          } else if (path === 'name.givenname' && op.value) {
            const currentParts = existing.name.split(' ');
            currentParts[0] = op.value;
            updateData.name = currentParts.join(' ');
          } else if (path === 'name.familyname' && op.value) {
            const currentParts = existing.name.split(' ');
            if (currentParts.length > 1) {
              currentParts[currentParts.length - 1] = op.value;
            } else {
              currentParts.push(op.value);
            }
            updateData.name = currentParts.join(' ');
          }
        }
        if (path === 'externalid' || (!path && op.value?.externalId !== undefined)) {
          updateData.externalId = path === 'externalid' ? op.value : op.value.externalId;
        }
      }
    }

    const user = Object.keys(updateData).length > 0
      ? await this.prisma.user.update({ where: { id }, data: updateData })
      : existing;

    this.logger.log(`SCIM: Patched user ${id} in tenant ${tenantId}`);

    return this.toScimUser(user);
  }

  async deleteUser(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        this.scimError(404, `User ${id} not found`),
      );
    }

    // Soft delete: deactivate the user
    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'disabled',
        deletedAt: new Date(),
      },
    });

    this.logger.log(`SCIM: Deactivated user ${id} in tenant ${tenantId}`);
  }

  // =========================================================================
  // Groups (mapped to Roles)
  // =========================================================================

  async listGroups(
    tenantId: string,
    query: {
      filter?: string;
      startIndex?: number;
      count?: number;
    },
  ): Promise<ScimListResponse<ScimGroup>> {
    const startIndex = Math.max(1, query.startIndex || 1);
    const count = Math.min(100, Math.max(1, query.count || 100));
    const skip = startIndex - 1;

    const where: any = {
      OR: [{ tenantId }, { tenantId: null, isSystem: true }],
    };
    if (query.filter) {
      this.applyGroupFilter(where, query.filter);
    }

    const [roles, totalResults] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: count,
        orderBy: { createdAt: 'asc' },
        include: {
          userRoles: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: roles.map((r) => this.toScimGroup(r)),
    };
  }

  async getGroup(tenantId: string, id: string): Promise<ScimGroup> {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      include: {
        userRoles: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(
        this.scimError(404, `Group ${id} not found`),
      );
    }

    return this.toScimGroup(role);
  }

  async patchGroup(
    tenantId: string,
    id: string,
    patchBody: { schemas?: string[]; Operations: ScimPatchOperation[] },
  ): Promise<ScimGroup> {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      include: {
        userRoles: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(
        this.scimError(404, `Group ${id} not found`),
      );
    }

    for (const op of patchBody.Operations) {
      const operation = op.op.toLowerCase();
      const path = op.path?.toLowerCase();

      if (operation === 'add' && (path === 'members' || !path)) {
        const members = path === 'members' ? op.value : op.value?.members;
        if (Array.isArray(members)) {
          for (const member of members) {
            const userId = member.value;
            // Verify user belongs to tenant
            const user = await this.prisma.user.findFirst({
              where: { id: userId, tenantId, deletedAt: null },
            });
            if (!user) {
              this.logger.warn(`SCIM: Skipping unknown user ${userId} for group ${id}`);
              continue;
            }
            // Upsert role assignment
            await this.prisma.userRole.upsert({
              where: { userId_roleId: { userId, roleId: id } },
              create: { userId, roleId: id },
              update: {},
            });
          }
        }
      }

      if (operation === 'remove' && path) {
        // path format: members[value eq "userId"]
        const match = path.match(
          /members\[value\s+eq\s+["']([^"']+)["']\]/i,
        );
        if (match) {
          const userId = match[1];
          await this.prisma.userRole.deleteMany({
            where: { userId, roleId: id },
          });
        } else if (path === 'members') {
          // Remove all members
          if (op.value && Array.isArray(op.value)) {
            for (const member of op.value) {
              await this.prisma.userRole.deleteMany({
                where: { userId: member.value, roleId: id },
              });
            }
          }
        }
      }

      if (operation === 'replace' && path === 'members') {
        // Replace all members
        await this.prisma.userRole.deleteMany({ where: { roleId: id } });
        if (Array.isArray(op.value)) {
          for (const member of op.value) {
            const user = await this.prisma.user.findFirst({
              where: { id: member.value, tenantId, deletedAt: null },
            });
            if (user) {
              await this.prisma.userRole.create({
                data: { userId: member.value, roleId: id },
              });
            }
          }
        }
      }
    }

    // Re-fetch with updated members
    const updated = await this.prisma.role.findFirst({
      where: { id },
      include: {
        userRoles: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    this.logger.log(`SCIM: Patched group ${id} in tenant ${tenantId}`);

    return this.toScimGroup(updated!);
  }

  // =========================================================================
  // Mapping helpers
  // =========================================================================

  private toScimUser(user: any): ScimUser {
    const nameParts = (user.name || '').split(' ');
    const givenName = nameParts[0] || '';
    const familyName = nameParts.slice(1).join(' ') || '';

    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.id,
      externalId: user.externalId || undefined,
      userName: user.email,
      name: {
        givenName,
        familyName,
      },
      emails: [
        {
          value: user.email,
          primary: true,
          type: 'work',
        },
      ],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.createdAt?.toISOString() || new Date().toISOString(),
        lastModified: user.updatedAt?.toISOString() || new Date().toISOString(),
        location: `/scim/v2/Users/${user.id}`,
      },
    };
  }

  private toScimGroup(role: any): ScimGroup {
    const members = (role.userRoles || []).map((ur: any) => ({
      value: ur.user.id,
      display: ur.user.name || ur.user.email,
      $ref: `/scim/v2/Users/${ur.user.id}`,
    }));

    return {
      schemas: [SCIM_GROUP_SCHEMA],
      id: role.id,
      displayName: role.name,
      members,
      meta: {
        resourceType: 'Group',
        created: role.createdAt?.toISOString() || new Date().toISOString(),
        lastModified: role.updatedAt?.toISOString() || new Date().toISOString(),
        location: `/scim/v2/Groups/${role.id}`,
      },
    };
  }

  // =========================================================================
  // Filter parsing (basic SCIM filter support)
  // =========================================================================

  private applyUserFilter(where: any, filter: string): void {
    // Supports: userName eq "value", active eq "true"/"false"
    // Supports: userName co "value", userName sw "value"
    const patterns = [
      {
        regex: /userName\s+eq\s+"([^"]+)"/i,
        apply: (match: RegExpMatchArray) => {
          where.email = match[1];
        },
      },
      {
        regex: /userName\s+co\s+"([^"]+)"/i,
        apply: (match: RegExpMatchArray) => {
          where.email = { contains: match[1], mode: 'insensitive' };
        },
      },
      {
        regex: /userName\s+sw\s+"([^"]+)"/i,
        apply: (match: RegExpMatchArray) => {
          where.email = { startsWith: match[1], mode: 'insensitive' };
        },
      },
      {
        regex: /active\s+eq\s+"?(true|false)"?/i,
        apply: (match: RegExpMatchArray) => {
          where.status = match[1].toLowerCase() === 'true' ? 'active' : 'disabled';
        },
      },
      {
        regex: /externalId\s+eq\s+"([^"]+)"/i,
        apply: (match: RegExpMatchArray) => {
          where.externalId = match[1];
        },
      },
    ];

    for (const { regex, apply } of patterns) {
      const match = filter.match(regex);
      if (match) {
        apply(match);
      }
    }
  }

  private applyGroupFilter(where: any, filter: string): void {
    const match = filter.match(/displayName\s+eq\s+"([^"]+)"/i);
    if (match) {
      where.name = match[1];
    }
    const coMatch = filter.match(/displayName\s+co\s+"([^"]+)"/i);
    if (coMatch) {
      where.name = { contains: coMatch[1], mode: 'insensitive' };
    }
  }

  private extractEmail(payload: any): string | null {
    if (payload.userName) return payload.userName;
    if (payload.emails && Array.isArray(payload.emails)) {
      const primary = payload.emails.find((e: any) => e.primary);
      return primary?.value || payload.emails[0]?.value || null;
    }
    return null;
  }

  private extractName(payload: any): string {
    if (payload.name) {
      const parts = [];
      if (payload.name.givenName) parts.push(payload.name.givenName);
      if (payload.name.familyName) parts.push(payload.name.familyName);
      if (parts.length > 0) return parts.join(' ');
      if (payload.name.formatted) return payload.name.formatted;
    }
    if (payload.displayName) return payload.displayName;
    return payload.userName || 'Unknown';
  }

  private scimError(
    status: number,
    detail: string,
  ): { schemas: string[]; status: string; detail: string } {
    return {
      schemas: [SCIM_ERROR_SCHEMA],
      status: String(status),
      detail,
    };
  }
}
