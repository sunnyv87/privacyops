import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  generateFingerprint(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async findDuplicates(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        deletedAt: null,
        fingerprint: { not: null },
      },
      select: {
        id: true,
        name: true,
        type: true,
        path: true,
        fingerprint: true,
        dataSourceId: true,
      },
      orderBy: { fingerprint: 'asc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const asset of assets) {
      const fp = asset.fingerprint as string;
      if (!grouped[fp]) grouped[fp] = [];
      grouped[fp].push(asset);
    }

    // Only return groups with duplicates
    const duplicates = Object.entries(grouped)
      .filter(([, group]) => group.length > 1)
      .map(([fingerprint, assets]) => ({
        fingerprint,
        count: assets.length,
        assets,
      }));

    return duplicates;
  }
}
