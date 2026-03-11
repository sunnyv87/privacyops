import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

const AI_DATASET_PATTERNS = [
  /training/i,
  /model/i,
  /dataset/i,
  /\bml_/i,
  /\bai_/i,
  /embeddings/i,
];

@Injectable()
export class AiDatasetService {
  private readonly logger = new Logger(AiDatasetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async detectAiDatasets(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        path: true,
        dataSourceId: true,
        type: true,
        sizeBytes: true,
        lastScannedAt: true,
        isAiDataset: true,
      },
    });

    const detected = assets.filter((asset) => {
      const nameOrPath = `${asset.name} ${asset.path || ''}`;
      return AI_DATASET_PATTERNS.some((pattern) => pattern.test(nameOrPath));
    });

    // Mark detected assets
    if (detected.length > 0) {
      await this.prisma.asset.updateMany({
        where: { id: { in: detected.map((a) => a.id) }, tenantId },
        data: { isAiDataset: true },
      });
    }

    this.logger.log(
      `AI dataset detection for tenant ${tenantId}: ${detected.length} dataset(s) detected`,
    );

    return detected;
  }

  async getInventory(tenantId: string) {
    const aiAssets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, isAiDataset: true },
      include: {
        dataSource: { select: { name: true, type: true } },
        _count: { select: { classifications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: aiAssets.length,
      assets: aiAssets,
    };
  }
}
