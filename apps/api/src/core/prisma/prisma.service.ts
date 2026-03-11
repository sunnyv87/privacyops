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

  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Set the current tenant context for Row Level Security.
   * Uses set_config with parameterized value to prevent SQL injection.
   */
  async setTenantContext(tenantId: string): Promise<void> {
    if (!PrismaService.UUID_RE.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant', $1, false)`,
      tenantId,
    );
  }

  /**
   * Execute a callback within a tenant context.
   * Uses a transaction with SET LOCAL to scope context to the transaction.
   */
  async withTenant<T>(
    tenantId: string,
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (!PrismaService.UUID_RE.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant', $1, true)`,
        tenantId,
      );
      return callback(tx as PrismaClient);
    });
  }
}
