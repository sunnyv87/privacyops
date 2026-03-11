import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TooManyRequestsException } from '@nestjs/common';
import Redis from 'ioredis';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

/**
 * Decorator to apply rate limiting to a route.
 * @param limit Maximum number of requests allowed within the window
 * @param windowSeconds Time window in seconds
 */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } as RateLimitOptions);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection?.remoteAddress ||
      'unknown';
    const route = request.route?.path || request.url;

    const key = `rate_limit:${ip}:${route}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, options.windowSeconds);
    }

    if (current > options.limit) {
      const ttl = await this.redis.ttl(key);
      throw new TooManyRequestsException(
        `Rate limit exceeded. Try again in ${ttl} seconds.`,
      );
    }

    return true;
  }
}
