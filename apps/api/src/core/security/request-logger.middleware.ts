import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Log lines are a persistent, downstream-aggregated record, and the
 * audit flagged two leaks in the previous version:
 *
 *   1. Full client IP was written verbatim, making the access log a
 *      PII store (relevant under GDPR Art. 4 recital 30 / CCPA).
 *   2. `originalUrl` includes the query string, so DSAR lookup tokens,
 *      magic-link IDs, and download signatures could end up in logs.
 *
 * This middleware now:
 *   - Hashes the IP with a per-process salt and truncates to 16 hex
 *     chars, giving enough cardinality for rate-limit correlation
 *     without exposing the raw address.
 *   - Strips the query string from the logged URL, replacing it with
 *     `?…` when present so path-vs-path distribution is still visible.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly ipSalt =
    process.env.REQUEST_LOG_IP_SALT || process.env.DEVICE_BINDING_SALT || 'privacyops-log-salt';

  private hashIp(ip: string | undefined): string {
    if (!ip) return '-';
    return createHash('sha256').update(`${ip}|${this.ipSalt}`).digest('hex').slice(0, 16);
  }

  private scrubUrl(url: string): string {
    const q = url.indexOf('?');
    return q === -1 ? url : `${url.slice(0, q)}?…`;
  }

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '-';
    const hashedIp = this.hashIp(req.ip);
    const scrubbedUrl = this.scrubUrl(originalUrl);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const tenantId = (req as any).user?.tenantId || '-';
      const userId = (req as any).user?.id || '-';
      const correlationId = (req as any).correlationId || '-';

      const logEntry = {
        method,
        url: scrubbedUrl,
        statusCode,
        duration,
        ipHash: hashedIp,
        userAgent,
        tenantId,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      };

      if (statusCode >= 500) {
        this.logger.error(logEntry);
      } else if (statusCode >= 400) {
        this.logger.warn(logEntry);
      } else {
        this.logger.log(logEntry);
      }
    });

    next();
  }
}
