import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { AccessAnalyzer } from './access-analyzer';
import { IdentityAccessFilterDto } from './dto/identity-access.dto';

@Injectable()
export class IdentityAccessService {
  private readonly logger = new Logger(IdentityAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly accessAnalyzer: AccessAnalyzer,
  ) {}

  async buildMappings(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      include: { accessPermissions: true },
    });

    if (!asset) {
      return { created: 0 };
    }

    const permissions = asset.accessPermissions || [];
    let created = 0;

    for (const perm of permissions) {
      const permData = perm as any;

      const mapping = {
        tenantId,
        assetId,
        identityId: permData.principalId || permData.identityId,
        identityType: permData.principalType || permData.identityType || 'user',
        identityName: permData.principalName || permData.identityName || 'Unknown',
        permissions: permData.permissions || [],
        accessLevel: permData.accessLevel || 'read',
        grantedAt: permData.grantedAt ? new Date(permData.grantedAt) : new Date(),
        lastAccessedAt: permData.lastAccessedAt ? new Date(permData.lastAccessedAt) : null,
        isOwner: permData.isOwner ?? false,
        isExcessive: false,
        isInactive: false,
      };

      await this.prisma.identityAccessMapping.upsert({
        where: {
          tenantId_assetId_identityId: {
            tenantId,
            assetId,
            identityId: mapping.identityId,
          },
        },
        create: mapping,
        update: {
          identityType: mapping.identityType,
          identityName: mapping.identityName,
          permissions: mapping.permissions,
          accessLevel: mapping.accessLevel,
          lastAccessedAt: mapping.lastAccessedAt,
          isOwner: mapping.isOwner,
        },
      });
      created++;
    }

    // Run analysis on newly created mappings
    const allMappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, assetId },
    });

    let analyzed = this.accessAnalyzer.analyzeExcessivePermissions(allMappings);
    analyzed = this.accessAnalyzer.analyzeInactiveAccess(analyzed);
    analyzed = this.accessAnalyzer.analyzePublicSharing(analyzed);

    for (const m of analyzed) {
      if (m.isExcessive || m.isInactive) {
        await this.prisma.identityAccessMapping.update({
          where: { id: m.id },
          data: {
            isExcessive: m.isExcessive ?? false,
            isInactive: m.isInactive ?? false,
          },
        });
      }
    }

    await this.events.publish({
      type: 'identity-access.mappings.built',
      tenantId,
      data: { assetId, mappingCount: created },
      timestamp: new Date(),
    });

    return { created };
  }

  async findMappings(tenantId: string, filters: IdentityAccessFilterDto = {}) {
    const { page = 1, pageSize = 20, identityType, assetId, isExcessive, isInactive } = filters;

    const where: any = {
      tenantId,
      ...(identityType && { identityType }),
      ...(assetId && { assetId }),
      ...(isExcessive !== undefined && { isExcessive }),
      ...(isInactive !== undefined && { isInactive }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.identityAccessMapping.findMany({
        where,
        orderBy: [{ isExcessive: 'desc' }, { isInactive: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.identityAccessMapping.count({ where }),
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

  async getAnomalies(tenantId: string) {
    const anomalies = await this.prisma.identityAccessMapping.findMany({
      where: {
        tenantId,
        OR: [{ isExcessive: true }, { isInactive: true }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const a of anomalies) {
      const type = a.isExcessive ? 'excessive' : 'inactive';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(a);
    }

    return { data: grouped };
  }

  async getIdentityDataAccess(tenantId: string, identityId: string) {
    const mappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, identityId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: mappings };
  }

  async getAssetIdentities(tenantId: string, assetId: string) {
    const mappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, assetId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: mappings };
  }

  async getStats(tenantId: string) {
    const [byType, excessiveCount, inactiveCount] = await Promise.all([
      this.prisma.identityAccessMapping.groupBy({
        by: ['identityType'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isExcessive: true },
      }),
      this.prisma.identityAccessMapping.count({
        where: { tenantId, isInactive: true },
      }),
    ]);

    return {
      byIdentityType: byType.map((t) => ({
        identityType: t.identityType,
        count: t._count.id,
      })),
      excessiveCount,
      inactiveCount,
    };
  }
}
