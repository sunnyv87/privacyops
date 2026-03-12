import { Controller, Get, Inject, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PrometheusService } from '../telemetry/prometheus.service';
import Redis from 'ioredis';

type DepStatus = 'connected' | 'disconnected';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly prometheus: PrometheusService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — verifies all critical dependencies' })
  async ready(@Res() res: Response) {
    const checks: Record<string, DepStatus> = {};

    // Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'connected';
      this.prometheus.dependencyUp.set({ dependency: 'postgresql' }, 1);
    } catch {
      checks.database = 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'postgresql' }, 0);
    }

    // Redis
    try {
      await this.redis.ping();
      checks.redis = 'connected';
      this.prometheus.dependencyUp.set({ dependency: 'redis' }, 1);
    } catch {
      checks.redis = 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'redis' }, 0);
    }

    // NATS
    try {
      const natsUrl = this.config.get('NATS_URL', 'nats://localhost:4222');
      const { connect } = await import('nats');
      const nc = await connect({ servers: natsUrl, timeout: 3000 });
      await nc.close();
      checks.nats = 'connected';
      this.prometheus.dependencyUp.set({ dependency: 'nats' }, 1);
    } catch {
      checks.nats = 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'nats' }, 0);
    }

    // Temporal
    try {
      const addr = this.config.get('TEMPORAL_ADDRESS', 'localhost:7233');
      const { Connection } = await import('@temporalio/client');
      const conn = await Connection.connect({ address: addr });
      await conn.close();
      checks.temporal = 'connected';
      this.prometheus.dependencyUp.set({ dependency: 'temporal' }, 1);
    } catch {
      checks.temporal = 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'temporal' }, 0);
    }

    // OpenSearch
    try {
      const osUrl = this.config.get('OPENSEARCH_URL', 'http://localhost:9200');
      const response = await fetch(`${osUrl}/_cluster/health`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.opensearch = response.ok ? 'connected' : 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'opensearch' }, response.ok ? 1 : 0);
    } catch {
      checks.opensearch = 'disconnected';
      this.prometheus.dependencyUp.set({ dependency: 'opensearch' }, 0);
    }

    const allHealthy = Object.values(checks).every((v) => v === 'connected');
    const status = allHealthy ? 'ready' : 'not_ready';
    const httpStatus = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(httpStatus).json({ status, ...checks });
  }
}
