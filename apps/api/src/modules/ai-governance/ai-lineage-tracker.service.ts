import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';

@Injectable()
export class AiLineageTrackerService {
  private readonly logger = new Logger(AiLineageTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async recordLineage(
    tenantId: string,
    aiSystemId: string,
    dto: {
      version: string;
      parentModelId?: string;
      trainingDatasets: string[];
      trainingConfig?: any;
      evaluationMetrics?: any;
      deploymentStatus?: string;
    },
  ) {
    const system = await this.prisma.aiSystem.findFirst({
      where: { id: aiSystemId, tenantId },
    });

    if (!system) {
      throw new NotFoundException(`AI system ${aiSystemId} not found`);
    }

    const lineage = await this.prisma.aiModelLineage.create({
      data: {
        tenantId,
        aiSystemId,
        version: dto.version,
        parentModelId: dto.parentModelId,
        trainingDatasets: dto.trainingDatasets,
        trainingConfig: dto.trainingConfig || {},
        evaluationMetrics: dto.evaluationMetrics || {},
        deploymentStatus: dto.deploymentStatus || 'development',
      },
    });

    await this.prisma.aiSystem.update({
      where: { id: aiSystemId },
      data: { lineageTracked: true },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'ai_model_lineage.recorded',
      entityType: 'ai_model_lineage',
      entityId: lineage.id,
      changes: {
        after: {
          aiSystemId,
          version: dto.version,
          parentModelId: dto.parentModelId,
        },
      },
    });

    this.logger.log(`Model lineage recorded for AI system ${aiSystemId}, version ${dto.version}`);

    return lineage;
  }

  async getLineage(tenantId: string, aiSystemId: string) {
    const system = await this.prisma.aiSystem.findFirst({
      where: { id: aiSystemId, tenantId },
    });

    if (!system) {
      throw new NotFoundException(`AI system ${aiSystemId} not found`);
    }

    const lineage = await this.prisma.aiModelLineage.findMany({
      where: { tenantId, aiSystemId },
      orderBy: { createdAt: 'desc' },
    });

    return lineage;
  }

  async getLineageById(tenantId: string, id: string) {
    const lineage = await this.prisma.aiModelLineage.findFirst({
      where: { id, tenantId },
    });

    if (!lineage) {
      throw new NotFoundException(`AI model lineage ${id} not found`);
    }

    return lineage;
  }

  async getSensitiveDataUsage(tenantId: string) {
    const usages = await this.prisma.aiDatasetUsage.findMany({
      where: { tenantId },
      include: {
        aiSystem: {
          select: { id: true, name: true, riskCategory: true, status: true },
        },
      },
    });

    const results: any[] = [];

    for (const usage of usages) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: usage.datasetId, tenantId },
        include: {
          classifications: {
            where: { sensitivity: { gte: 4 } },
          },
        },
      });

      if (asset && asset.classifications.length > 0) {
        results.push({
          aiSystem: usage.aiSystem,
          asset: {
            id: asset.id,
            name: asset.name,
            type: asset.type,
          },
          classifications: asset.classifications.map((c) => ({
            id: c.id,
            category: c.category,
            sensitivity: c.sensitivity,
          })),
          usageType: usage.usageType,
        });
      }
    }

    return results;
  }
}
