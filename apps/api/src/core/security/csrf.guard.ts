import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * CSRF protection guard that validates Origin/Referer headers on
 * state-changing requests (POST, PUT, PATCH, DELETE).
 *
 * This prevents cross-origin form submissions and fetch requests
 * from untrusted origins, even when credentials: true is set in CORS.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly allowedOrigins: Set<string>;
  private readonly safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    const origins = this.config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
    this.allowedOrigins = new Set(origins.split(',').map((o) => o.trim()));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Safe methods don't need CSRF checks
    if (this.safeMethods.has(request.method)) {
      return true;
    }

    // API key authenticated requests are not subject to CSRF
    if (request.headers['x-api-key']) {
      return true;
    }

    const origin = request.headers['origin'];
    const referer = request.headers['referer'];

    // If neither Origin nor Referer is present, the request likely comes from
    // a non-browser client (e.g., curl, Postman, server-to-server).
    // Allow these through since CSRF is a browser-only attack vector.
    if (!origin && !referer) {
      return true;
    }

    // Validate Origin header (preferred)
    if (origin) {
      if (this.allowedOrigins.has(origin)) {
        return true;
      }
      this.logger.warn(
        `CSRF blocked: origin "${origin}" not in allowed origins`,
      );
      throw new ForbiddenException('Invalid request origin');
    }

    // Fall back to Referer header
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (this.allowedOrigins.has(refererOrigin)) {
          return true;
        }
      } catch {
        // Malformed referer
      }
      this.logger.warn(
        `CSRF blocked: referer "${referer}" not from allowed origin`,
      );
      throw new ForbiddenException('Invalid request origin');
    }

    return true;
  }
}
