import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrometheusService } from './prometheus.service';

/**
 * /metrics endpoint for Prometheus scraping.
 * Public (no auth) — intended for infrastructure-level scraping.
 * Access control should be enforced at the network / ingress level.
 */
@ApiTags('Metrics')
@Controller()
export class PrometheusController {
  constructor(private readonly prometheus: PrometheusService) {}

  @Public()
  @Get('metrics')
  @ApiExcludeEndpoint()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.prometheus.getMetrics();
    res.set('Content-Type', this.prometheus.getContentType());
    res.end(metrics);
  }
}
