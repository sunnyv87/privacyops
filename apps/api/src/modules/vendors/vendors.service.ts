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
