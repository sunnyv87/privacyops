import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { AttackPathFilterDto } from './dto/attack-path.dto';

@Injectable()
export class AttackPathsService {
  private readonly logger = new Logger(AttackPathsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async getAttackPaths(tenantId: string, filters: AttackPathFilterDto = {}) {
    const { page = 1, pageSize = 20, severity, status } = filters;

    const where: any = {
      tenantId,
      ...(severity && { severity }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.attackPath.findMany({
        where,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attackPath.count({ where }),
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

  async getAttackPathById(tenantId: string, id: string) {
    const path = await this.prisma.attackPath.findFirst({
      where: { id, tenantId },
    });

    if (!path) {
      throw new NotFoundException(`Attack path ${id} not found`);
    }

    return path;
  }

  async updateStatus(tenantId: string, id: string, status: string, userId: string) {
    const path = await this.prisma.attackPath.findFirst({
      where: { id, tenantId },
    });

    if (!path) {
      throw new NotFoundException(`Attack path ${id} not found`);
    }

    const previousStatus = path.status;

    const updated = await this.prisma.attackPath.update({
      where: { id },
      data: {
        status,
        ...(status === 'mitigated' && { resolvedAt: new Date() }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'attack_path.status_changed',
      entityType: 'attack_path',
      entityId: id,
      changes: {
        before: { status: previousStatus },
        after: { status },
      },
    });

    return updated;
  }

  async getStats(tenantId: string) {
    const [bySeverity, byStatus] = await Promise.all([
      this.prisma.attackPath.groupBy({
        by: ['severity'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.attackPath.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    return {
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    };
  }
}
