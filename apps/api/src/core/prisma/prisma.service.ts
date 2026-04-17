import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SLOW_QUERY_THRESHOLD_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    // Slow query logging
    (this as any).$on('query', (e: any) => {
      const duration = e.duration ?? 0;
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        const rawQuery = String(e.query ?? '');
        const safeQuery = rawQuery.replace(/\$\d+/g, '?').slice(0, 200);
        this.logger.warn(`Slow query (${duration}ms): ${safeQuery}`);
      }
    });

    // Set statement timeout at the database session level (30s)
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`SET statement_timeout = '30s'`);
    } catch {
      this.logger.warn('Could not set statement_timeout (may not be PostgreSQL)');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private _requestTenantId: string | null = null;

  /**
   * Set the current tenant context for Row Level Security.
   * Stores the tenant ID so withTenantScope can apply it per-transaction.
   * Also sets it on the current connection as a best-effort measure.
   */
  async setTenantContext(tenantId: string): Promise<void> {
    if (!PrismaService.UUID_RE.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    this._requestTenantId = tenantId;
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant', $1, false)`,
      tenantId,
    );
  }

  get currentTenantId(): string | null {
    return this._requestTenantId;
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
