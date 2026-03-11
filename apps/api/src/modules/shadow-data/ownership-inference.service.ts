import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class OwnershipInferenceService {
  private readonly logger = new Logger(OwnershipInferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async inferOwnership(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
    });

    if (!asset) {
      return null;
    }

    const metadata = (asset.metadata as Record<string, any>) || {};
    const candidates: Array<{ identity: string; reason: string; confidence: number }> = [];

    // Check creator
    if (metadata.createdBy) {
      candidates.push({
        identity: metadata.createdBy,
        reason: 'Asset creator',
        confidence: 0.8,
      });
    }

    // Check last modifier
    if (metadata.lastModifiedBy) {
      candidates.push({
        identity: metadata.lastModifiedBy,
        reason: 'Last modifier',
        confidence: 0.6,
      });
    }

    // Check most frequent accessor from identity mappings
    const accessors = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, assetId },
      orderBy: { lastAccessedAt: 'desc' },
      take: 1,
    });

    if (accessors.length > 0) {
      candidates.push({
        identity: accessors[0].identityName,
        reason: 'Most recent accessor',
        confidence: 0.5,
      });
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    return {
      assetId,
      inferredOwner: candidates[0] || null,
      candidates,
    };
  }
}
