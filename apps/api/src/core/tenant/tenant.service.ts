import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async create(data: {
    name: string;
    slug: string;
    domain?: string;
    dataResidencyRegion: string;
  }) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        dataResidencyRegion: data.dataResidencyRegion,
        subscriptionTier: 'trial',
        status: 'trial',
        encryptionKeyId: `tenant-key-${data.slug}`, // Placeholder — integrate with KMS
      },
    });
  }
}
