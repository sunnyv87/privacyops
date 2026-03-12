import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);

  private readonly defaultWindowMs: number;
  private readonly defaultMaxRequests: number;

  constructor(
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.defaultWindowMs = Number(config.get('RATE_LIMIT_WINDOW_MS', '60000'));
    this.defaultMaxRequests = Number(config.get('RATE_LIMIT_MAX_REQUESTS', '100'));
  }

  onModuleInit() {
    this.logger.log('Redis-backed rate limiter initialized');
  }

  onModuleDestroy() {
    // Redis client lifecycle managed by the provider factory
  }

  async isAllowed(tenantId: string, endpoint?: string): Promise<boolean> {
    const key = `tenant_rate:${endpoint ? `${tenantId}:${endpoint}` : tenantId}`;
    const windowSeconds = Math.ceil(this.defaultWindowMs / 1000);

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (current > this.defaultMaxRequests) {
      this.logger.warn(`Rate limit exceeded for tenant ${tenantId} on ${endpoint || 'global'}`);
      return false;
    }

    return true;
  }

  async getRemainingRequests(tenantId: string, endpoint?: string): Promise<number> {
    const key = `tenant_rate:${endpoint ? `${tenantId}:${endpoint}` : tenantId}`;
    const current = await this.redis.get(key);
    if (!current) {
      return this.defaultMaxRequests;
    }
    return Math.max(0, this.defaultMaxRequests - parseInt(current, 10));
  }
}
