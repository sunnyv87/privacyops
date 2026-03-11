import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import {
  CreateAiSystemDto,
  UpdateAiSystemDto,
  RecordDatasetUsageDto,
  AiSystemFilterDto,
} from './dto/ai-governance.dto';

@Injectable()
export class AiGovernanceService {
  private readonly logger = new Logger(AiGovernanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create AI System
  // ---------------------------------------------------------------------------

  async createSystem(
    tenantId: string,
    userId: string,
    dto: CreateAiSystemDto,
  ) {
    const system = await this.prisma.aiSystem.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        riskCategory: dto.riskCategory || 'minimal',
        purpose: dto.purpose,
        vendor: dto.vendor,
        regulatoryBasis: dto.regulatoryBasis || [],
        dataCategories: dto.dataCategories || [],
        ownerId: dto.ownerId || userId,
        status: 'draft',
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'ai_system.created',
      entityType: 'ai_system',
      entityId: system.id,
      changes: {
        after: {
          name: dto.name,
          riskCategory: dto.riskCategory || 'minimal',
          status: 'draft',
        },
      },
    });

    this.logger.log(`AI system ${system.id} created by ${userId}`);

    return system;
  }

  // ---------------------------------------------------------------------------
  // List AI Systems
  // ---------------------------------------------------------------------------

  async findSystems(
    tenantId: string,
    filters?: AiSystemFilterDto & { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      tenantId,
      ...(filters?.riskCategory && { riskCategory: filters.riskCategory }),
      ...(filters?.status && { status: filters.status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.aiSystem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.aiSystem.count({ where }),
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

  // ---------------------------------------------------------------------------
  // Get Single AI System
  // ---------------------------------------------------------------------------

  async findSystemById(tenantId: string, id: string) {
    const system = await this.prisma.aiSystem.findFirst({
      where: { id, tenantId },
      include: {
        datasetUsages: true,
      },
    });

    if (!system) {
      throw new NotFoundException(`AI system ${id} not found`);
    }

    return system;
  }

  // ---------------------------------------------------------------------------
  // Update AI System
  // ---------------------------------------------------------------------------

  async updateSystem(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateAiSystemDto,
  ) {
    const existing = await this.prisma.aiSystem.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`AI system ${id} not found`);
    }

    const updated = await this.prisma.aiSystem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.riskCategory !== undefined && { riskCategory: dto.riskCategory }),
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        ...(dto.vendor !== undefined && { vendor: dto.vendor }),
        ...(dto.regulatoryBasis !== undefined && {
          regulatoryBasis: dto.regulatoryBasis,
        }),
        ...(dto.dataCategories !== undefined && {
          dataCategories: dto.dataCategories,
        }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'ai_system.updated',
      entityType: 'ai_system',
      entityId: id,
      changes: {
        before: {
          name: existing.name,
          riskCategory: existing.riskCategory,
          status: existing.status,
        },
        after: dto,
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Record Dataset Usage
  // ---------------------------------------------------------------------------

  async recordDatasetUsage(tenantId: string, dto: RecordDatasetUsageDto) {
    const system = await this.prisma.aiSystem.findFirst({
      where: { id: dto.aiSystemId, tenantId },
    });

    if (!system) {
      throw new NotFoundException(`AI system ${dto.aiSystemId} not found`);
    }

    const usage = await this.prisma.aiDatasetUsage.create({
      data: {
        tenantId,
        aiSystemId: dto.aiSystemId,
        datasetId: dto.datasetId,
        usageType: dto.usageType,
        description: dto.description,
        dataCategories: dto.dataCategories || [],
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'user',
      action: 'ai_dataset_usage.recorded',
      entityType: 'ai_dataset_usage',
      entityId: usage.id,
      changes: {
        after: {
          aiSystemId: dto.aiSystemId,
          datasetId: dto.datasetId,
          usageType: dto.usageType,
        },
      },
    });

    this.logger.log(
      `Dataset usage recorded: ${dto.datasetId} -> ${dto.aiSystemId} (${dto.usageType})`,
    );

    return usage;
  }

  // ---------------------------------------------------------------------------
  // List Dataset Usages
  // ---------------------------------------------------------------------------

  async findDatasetUsage(
    tenantId: string,
    filters?: {
      aiSystemId?: string;
      usageType?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      tenantId,
      ...(filters?.aiSystemId && { aiSystemId: filters.aiSystemId }),
      ...(filters?.usageType && { usageType: filters.usageType }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.aiDatasetUsage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.aiDatasetUsage.count({ where }),
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

  // ---------------------------------------------------------------------------
  // Compliance Report
  // ---------------------------------------------------------------------------

  async getComplianceReport(tenantId: string) {
    const systems = await this.prisma.aiSystem.findMany({
      where: { tenantId },
      include: {
        datasetUsages: true,
      },
    });

    const byRiskCategory: Record<string, number> = {};
    let compliantCount = 0;
    let totalCount = systems.length;

    const systemReports = systems.map((system) => {
      const riskCategory = system.riskCategory || 'unclassified';
      byRiskCategory[riskCategory] = (byRiskCategory[riskCategory] || 0) + 1;

      const regulatoryBasis = (system.regulatoryBasis as string[]) || [];
      const hasRegulatoryBasis = regulatoryBasis.length > 0;
      const hasOwner = !!system.ownerId;
      const hasDescription = !!system.description;
      const isCompliant = hasRegulatoryBasis && hasOwner && hasDescription;

      if (isCompliant) compliantCount++;

      return {
        systemId: system.id,
        name: system.name,
        riskCategory,
        status: system.status,
        hasRegulatoryBasis,
        hasOwner,
        hasDescription,
        isCompliant,
        datasetUsageCount: system.datasetUsages.length,
      };
    });

    return {
      totalSystems: totalCount,
      compliantSystems: compliantCount,
      complianceRate:
        totalCount > 0
          ? Math.round((compliantCount / totalCount) * 100 * 10) / 10
          : 100,
      byRiskCategory,
      systems: systemReports,
    };
  }
}
