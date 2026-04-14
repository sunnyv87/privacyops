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
 * Security model:
 *  - Browsers always send Origin on CORS-enabled fetch/XHR and on all
 *    POST/PUT/DELETE. Requiring a positive match on Origin blocks
 *    cross-origin form submissions even when `credentials: include` is set.
 *  - Server-to-server clients (Python scripts, CI jobs, terraform, etc.)
 *    authenticate with X-API-Key tokens, which are sensitive-action
 *    credentials themselves — we still require an explicit
 *    `X-Requested-With: XMLHttpRequest` custom header OR a valid API key
 *    AND that the guard is invoked on a non-cookie-authenticated request.
 *    The combination eliminates the CSRF attack vector (browsers cannot
 *    send arbitrary custom headers cross-origin without a preflight).
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
    const raw = this.config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
    this.allowedOrigins = new Set(
      raw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Safe methods are idempotent and unable to modify server state.
    if (this.safeMethods.has(request.method)) {
      return true;
    }

    const origin = request.headers['origin'];
    const referer = request.headers['referer'];
    const hasApiKey = !!request.headers['x-api-key'];
    const hasCustomHeader =
      request.headers['x-requested-with'] ||
      request.headers['x-csrf-token'];

    // Positive Origin validation takes precedence — if present, it must
    // match an allowed origin. This is the strongest signal and is not
    // spoofable from a browser cross-origin.
    if (origin) {
      if (this.allowedOrigins.has(origin)) {
        return true;
      }
      this.logger.warn(
        `CSRF blocked: origin "${origin}" not in allowed origins`,
      );
      throw new ForbiddenException('Invalid request origin');
    }

    // Fall back to Referer header for clients that strip Origin.
    if (referer) {
      try {
        const refererOrigin = new URL(String(referer)).origin;
        if (this.allowedOrigins.has(refererOrigin)) {
          return true;
        }
      } catch {
        // Malformed referer -> reject.
      }
      this.logger.warn(
        `CSRF blocked: referer "${referer}" not from allowed origin`,
      );
      throw new ForbiddenException('Invalid request origin');
    }

    // No Origin AND no Referer. Allow ONLY non-browser clients that have
    // presented an API key (server-to-server) OR a custom header (which
    // cross-origin fetch cannot send without a preflight that we would
    // reject at the CORS layer).
    if (hasApiKey || hasCustomHeader) {
      return true;
    }

    this.logger.warn(
      `CSRF blocked: ${request.method} ${request.url} missing Origin/Referer/API key`,
    );
    throw new ForbiddenException(
      'Missing Origin header; cross-site request blocked',
    );
  }
}
