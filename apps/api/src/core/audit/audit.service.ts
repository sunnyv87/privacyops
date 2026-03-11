import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

export interface AuditLogEntry {
  tenantId: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'api_key' | 'workflow';
  action: string;
  entityType: string;
  entityId: string;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private lastHash: string = '0';

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    const timestamp = new Date();

    // Create integrity hash (chain hash for tamper evidence)
    const hashInput = [
      this.lastHash,
      entry.action,
      entry.entityType,
      entry.entityId,
      timestamp.toISOString(),
    ].join('|');

    const integrityHash = createHash('sha256')
      .update(hashInput)
      .digest('hex');

    this.lastHash = integrityHash;

    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes || undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        timestamp,
        integrityHash,
      },
    });
  }

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async search(
    tenantId: string,
    filters: {
      action?: string;
      actorId?: string;
      entityType?: string;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ) {
    const { page = 1, pageSize = 50, ...where } = filters;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          ...(where.action && { action: { contains: where.action } }),
          ...(where.actorId && { actorId: where.actorId }),
          ...(where.entityType && { entityType: where.entityType }),
          ...(where.from && { timestamp: { gte: where.from } }),
          ...(where.to && { timestamp: { lte: where.to } }),
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          ...(where.action && { action: { contains: where.action } }),
          ...(where.actorId && { actorId: where.actorId }),
          ...(where.entityType && { entityType: where.entityType }),
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
