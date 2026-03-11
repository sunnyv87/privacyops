import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TenantRateLimit {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly limits = new Map<string, TenantRateLimit>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  private readonly defaultWindowMs: number;
  private readonly defaultMaxRequests: number;

  constructor(private readonly config: ConfigService) {
    this.defaultWindowMs = Number(config.get('RATE_LIMIT_WINDOW_MS', '60000'));
    this.defaultMaxRequests = Number(config.get('RATE_LIMIT_MAX_REQUESTS', '100'));
  }

  onModuleInit() {
    // Clean up stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  isAllowed(tenantId: string, endpoint?: string): boolean {
    const key = endpoint ? `${tenantId}:${endpoint}` : tenantId;
    const now = Date.now();
    const existing = this.limits.get(key);

    if (!existing || now - existing.windowStart > this.defaultWindowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return true;
    }

    existing.count++;
    if (existing.count > this.defaultMaxRequests) {
      this.logger.warn(`Rate limit exceeded for tenant ${tenantId} on ${endpoint || 'global'}`);
      return false;
    }

    return true;
  }

  getRemainingRequests(tenantId: string, endpoint?: string): number {
    const key = endpoint ? `${tenantId}:${endpoint}` : tenantId;
    const existing = this.limits.get(key);
    if (!existing || Date.now() - existing.windowStart > this.defaultWindowMs) {
      return this.defaultMaxRequests;
    }
    return Math.max(0, this.defaultMaxRequests - existing.count);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.limits.entries()) {
      if (now - value.windowStart > this.defaultWindowMs * 2) {
        this.limits.delete(key);
      }
    }
  }
}
