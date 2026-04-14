import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { PrometheusService } from './prometheus.service';

/**
 * /metrics endpoint for Prometheus scraping.
 *
 * Historically this was `@Public()` with a "secure at the network layer"
 * note, but in our audit we found the endpoint was actually reachable
 * through the same ingress as the application API. A bare `/metrics`
 * endpoint leaks process-level detail (paths, status codes, response
 * times, error categories) and is a reconnaissance primitive worth
 * neutralising.
 *
 * This controller now requires a shared bearer token, configured via the
 * `METRICS_SCRAPE_TOKEN` environment variable, which Prometheus must pass
 * in an `Authorization: Bearer …` header. When the variable is unset we
 * refuse all requests in production and allow scraping only from
 * loopback in development. Comparisons are timing-safe.
 */
@ApiTags('Metrics')
@Controller()
export class PrometheusController {
  private readonly logger = new Logger(PrometheusController.name);

  constructor(private readonly prometheus: PrometheusService) {}

  @Public()
  @Get('metrics')
  @ApiExcludeEndpoint()
  async getMetrics(@Req() req: Request, @Res() res: Response) {
    this.assertAuthorized(req);

    const metrics = await this.prometheus.getMetrics();
    res.set('Content-Type', this.prometheus.getContentType());
    res.end(metrics);
  }

  private assertAuthorized(req: Request): void {
    const configured = process.env.METRICS_SCRAPE_TOKEN;

    if (!configured) {
      // In production, refuse without the token entirely — we will not
      // emit metrics on an unauthenticated surface.
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          'METRICS_SCRAPE_TOKEN not set; refusing /metrics request in production',
        );
        throw new ForbiddenException('metrics endpoint disabled');
      }

      // In development, allow only loopback callers so `curl localhost`
      // still works without requiring a dev token.
      const ip = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return;
      }
      throw new ForbiddenException('metrics endpoint disabled');
    }

    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }

    const presented = header.slice(7).trim();
    if (!this.tokensMatch(presented, configured)) {
      throw new UnauthorizedException('invalid metrics token');
    }
  }

  private tokensMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
