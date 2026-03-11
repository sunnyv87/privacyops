import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set the current tenant context for Row Level Security.
   * Must be called at the start of every request.
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRawUnsafe(
      `SET app.current_tenant = '${tenantId}'`,
    );
  }

  /**
   * Execute a callback within a tenant context.
   * Uses a transaction to ensure the tenant context is set for all queries.
   */
  async withTenant<T>(
    tenantId: string,
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant = '${tenantId}'`,
      );
      return callback(tx as PrismaClient);
    });
  }
}
