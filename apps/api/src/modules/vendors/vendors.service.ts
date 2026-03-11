import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  CreateVendorAssessmentDto,
  VendorFilterDto,
} from './dto/vendor.dto';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateVendorDto) {
    const vendor = await this.prisma.vendor.create({
      data: {
        tenantId,
        name: dto.name,
        type: 'processor',
        riskTier: dto.riskTier,
        status: 'active',
        contactEmail: dto.contactEmail,
        servicesProvided: dto.description,
        contractExpiry: dto.contractExpiry ? new Date(dto.contractExpiry) : undefined,
        dataShared: {
          purposes: dto.dataProcessingPurposes || [],
          categories: dto.dataCategories || [],
        },
        metadata: {
          contactName: dto.contactName,
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'vendor.created',
      entityType: 'vendor',
      entityId: vendor.id,
      changes: { after: dto },
    });

    this.logger.log(`Vendor ${vendor.id} created by ${actorId}`);

    return vendor;
  }

  async findAll(
    tenantId: string,
    filters?: VendorFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, riskTier, status } = filters || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(riskTier && { riskTier }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: {
          assessments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              riskScore: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vendor.count({ where }),
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
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    return vendor;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateVendorDto,
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    const previousRiskTier = existing.riskTier;

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { servicesProvided: dto.description }),
        ...(dto.riskTier !== undefined && { riskTier: dto.riskTier }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contractExpiry !== undefined && {
          contractExpiry: new Date(dto.contractExpiry),
        }),
        ...(dto.dpaSignedAt !== undefined && {
          dpaStatus: 'signed',
          dpaDocumentId: undefined,
        }),
        ...(dto.dataProcessingPurposes || dto.dataCategories
          ? {
              dataShared: {
                purposes: dto.dataProcessingPurposes || [],
                categories: dto.dataCategories || [],
              },
            }
          : {}),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'vendor.updated',
      entityType: 'vendor',
      entityId: id,
      changes: {
        before: {
          name: existing.name,
          riskTier: existing.riskTier,
          status: existing.status,
        },
        after: dto,
      },
    });

    // Publish risk change event if risk tier changed
    if (dto.riskTier && dto.riskTier !== previousRiskTier) {
      await this.events.publish({
        type: 'vendor.risk.changed',
        tenantId,
        data: {
          vendorId: id,
          previousRiskTier,
          newRiskTier: dto.riskTier,
          actorId,
        },
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async createAssessment(
    tenantId: string,
    actorId: string,
    dto: CreateVendorAssessmentDto,
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, tenantId, deletedAt: null },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${dto.vendorId} not found`);
    }

    const assessment = await this.prisma.vendorAssessment.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        status: 'completed',
        riskScore: dto.riskScore,
        findings: dto.findings || [],
        reviewedBy: actorId,
        submittedAt: new Date(),
      },
    });

    // Update the vendor's last assessment date and risk score
    await this.prisma.vendor.update({
      where: { id: dto.vendorId },
      data: {
        lastAssessmentDate: new Date(),
        riskScore: dto.riskScore,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'vendor_assessment.created',
      entityType: 'vendor_assessment',
      entityId: assessment.id,
      changes: {
        after: {
          vendorId: dto.vendorId,
          riskScore: dto.riskScore,
          findingCount: dto.findings?.length || 0,
        },
      },
    });

    // Check if the next review date is approaching and publish event
    const nextReviewDate = new Date();
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

    await this.prisma.vendor.update({
      where: { id: dto.vendorId },
      data: { nextReviewDate },
    });

    await this.events.publish({
      type: 'vendor.assessment.due',
      tenantId,
      data: {
        vendorId: dto.vendorId,
        assessmentId: assessment.id,
        nextReviewDate: nextReviewDate.toISOString(),
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Assessment ${assessment.id} created for vendor ${dto.vendorId}`,
    );

    return assessment;
  }

  async findAssessments(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    return this.prisma.vendorAssessment.findMany({
      where: { tenantId, vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Assess Security Posture
  // ---------------------------------------------------------------------------

  async assessSecurityPosture(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    // Aggregate assessment scores
    const assessments = vendor.assessments || [];
    const avgRiskScore =
      assessments.length > 0
        ? Math.round(
            assessments.reduce((sum, a) => sum + (a.riskScore || 0), 0) /
              assessments.length,
          )
        : 0;

    const latestAssessment = assessments[0] || null;
    const hasRecentAssessment = latestAssessment
      ? new Date().getTime() - new Date(latestAssessment.createdAt).getTime() <
        365 * 24 * 60 * 60 * 1000
      : false;

    const posture = {
      vendorId,
      vendorName: vendor.name,
      riskTier: vendor.riskTier,
      averageRiskScore: avgRiskScore,
      totalAssessments: assessments.length,
      latestAssessmentDate: latestAssessment?.createdAt || null,
      hasRecentAssessment,
      dpaStatus: vendor.dpaStatus,
      contractExpiry: vendor.contractExpiry,
      overallPosture: avgRiskScore <= 30 ? 'good' : avgRiskScore <= 60 ? 'moderate' : 'poor',
    };

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { securityPosture: posture },
    });

    return posture;
  }

  // ---------------------------------------------------------------------------
  // Get Vendor Data Access
  // ---------------------------------------------------------------------------

  async getVendorDataAccess(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    const accessMappings = await this.prisma.identityAccessMapping.findMany({
      where: {
        tenantId,
        identityType: 'vendor',
        identityId: vendorId,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true,
            classificationLabels: true,
          },
        },
      },
    });

    return {
      vendorId,
      vendorName: vendor.name,
      accessMappings: accessMappings.map((m) => ({
        assetId: m.asset?.id,
        assetName: m.asset?.name,
        assetType: m.asset?.type,
        classificationLabels: m.asset?.classificationLabels,
        accessLevel: m.accessLevel,
        lastAccessed: m.lastAccessed,
      })),
      totalAssets: accessMappings.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Monitor Vendor
  // ---------------------------------------------------------------------------

  async monitorVendor(
    tenantId: string,
    vendorId: string,
    enable: boolean,
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { monitoringEnabled: enable },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: enable
        ? 'vendor.monitoring_enabled'
        : 'vendor.monitoring_disabled',
      entityType: 'vendor',
      entityId: vendorId,
      changes: {
        before: { monitoringEnabled: vendor.monitoringEnabled },
        after: { monitoringEnabled: enable },
      },
    });

    if (enable) {
      await this.events.publish({
        type: 'vendor.monitoring.enabled',
        tenantId,
        data: { vendorId, vendorName: vendor.name },
        timestamp: new Date(),
      });
    }

    this.logger.log(
      `Vendor ${vendorId} monitoring ${enable ? 'enabled' : 'disabled'}`,
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Get Risk Matrix
  // ---------------------------------------------------------------------------

  async getRiskMatrix(tenantId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        riskTier: true,
        riskScore: true,
        status: true,
        dpaStatus: true,
        contractExpiry: true,
      },
      orderBy: { riskScore: 'desc' },
    });

    return {
      totalVendors: vendors.length,
      vendors: vendors.map((v) => ({
        vendorId: v.id,
        vendorName: v.name,
        riskTier: v.riskTier,
        riskScore: v.riskScore || 0,
        status: v.status,
        dpaStatus: v.dpaStatus,
        contractExpiry: v.contractExpiry,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(tenantId: string) {
    const [riskTierDistribution, statusDistribution, totalVendors, assessmentsDue] =
      await Promise.all([
        this.prisma.vendor.groupBy({
          by: ['riskTier'],
          where: { tenantId, deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.vendor.groupBy({
          by: ['status'],
          where: { tenantId, deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.vendor.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.vendor.count({
          where: {
            tenantId,
            deletedAt: null,
            nextReviewDate: { lte: new Date() },
          },
        }),
      ]);

    return {
      totalVendors,
      assessmentsDue,
      riskTierDistribution: riskTierDistribution.map((r) => ({
        riskTier: r.riskTier,
        count: r._count.id,
      })),
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  }
}
