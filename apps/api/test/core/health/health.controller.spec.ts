import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from '../../../src/core/health/health.controller';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { PrometheusService } from '../../../src/core/telemetry/prometheus.service';

// Mock dynamic imports used in the ready() method
jest.mock('nats', () => ({
  connect: jest.fn().mockResolvedValue({ close: jest.fn() }),
}));

jest.mock('@temporalio/client', () => ({
  Connection: {
    connect: jest.fn().mockResolvedValue({ close: jest.fn() }),
  },
}));

// Mock global fetch for OpenSearch health check
global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: any;
  let mockRedis: any;
  let mockConfig: any;
  let mockPrometheus: any;

  beforeEach(async () => {
    mockPrisma = { $queryRaw: jest.fn() };
    mockRedis = { ping: jest.fn() };
    mockConfig = {
      get: jest.fn((_key: string, fallback: string) => fallback),
    };
    mockPrometheus = {
      dependencyUp: { set: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrometheusService, useValue: mockPrometheus },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('should return ok status for liveness', async () => {
      const result = await controller.health();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when all dependencies connected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.ready(mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const body = mockRes.json.mock.calls[0][0];
      expect(body.status).toBe('ready');
      expect(body.database).toBe('connected');
      expect(body.redis).toBe('connected');
      expect(body.nats).toBe('connected');
      expect(body.temporal).toBe('connected');
      expect(body.opensearch).toBe('connected');
    });

    it('should return 503 when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.ready(mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const body = mockRes.json.mock.calls[0][0];
      expect(body.status).toBe('not_ready');
      expect(body.database).toBe('disconnected');
    });

    it('should update Prometheus dependency_up gauge', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('timeout'));

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await controller.ready(mockRes as any);

      expect(mockPrometheus.dependencyUp.set).toHaveBeenCalledWith(
        { dependency: 'postgresql' },
        1,
      );
      expect(mockPrometheus.dependencyUp.set).toHaveBeenCalledWith(
        { dependency: 'redis' },
        0,
      );
      expect(mockPrometheus.dependencyUp.set).toHaveBeenCalledWith(
        { dependency: 'nats' },
        1,
      );
      expect(mockPrometheus.dependencyUp.set).toHaveBeenCalledWith(
        { dependency: 'temporal' },
        1,
      );
      expect(mockPrometheus.dependencyUp.set).toHaveBeenCalledWith(
        { dependency: 'opensearch' },
        1,
      );
    });
  });
});
