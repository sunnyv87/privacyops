import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  const mockConfig = {
    get: jest.fn().mockReturnValue('nats://localhost:4222'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('publish', () => {
    it('should log event when NATS is not connected', async () => {
      // Service starts without NATS connection (no onModuleInit called)
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.publish({
        type: 'test.event',
        tenantId: 'tenant-1',
        data: { foo: 'bar' },
        timestamp: new Date('2026-01-01'),
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('privacyops.test.event'),
      );
    });
  });

  describe('subscribe', () => {
    it('should warn and return when NATS is not connected', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.subscribe('test.event', 'test-durable', async () => {});

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot subscribe'),
      );
    });
  });

  describe('executeWithRetry', () => {
    it('should call handler on first attempt if successful', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const event = {
        type: 'test',
        tenantId: 't1',
        data: {},
        timestamp: new Date(),
      };

      await (service as any).executeWithRetry('test', handler, event);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should retry up to MAX_RETRY_ATTEMPTS times', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('fail'));
      const event = {
        type: 'test',
        tenantId: 't1',
        data: {},
        timestamp: new Date(),
      };

      // Mock setTimeout to avoid real delays
      jest.useFakeTimers();
      const retryPromise = (service as any)
        .executeWithRetry('test', handler, event)
        .catch(() => {});

      // Advance through all retry delays
      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(5000);
      }

      await retryPromise;
      // 1 initial + 3 retries = 4 calls
      expect(handler).toHaveBeenCalledTimes(4);
      jest.useRealTimers();
    });

    it('should succeed on retry after initial failure', async () => {
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(undefined);
      const event = {
        type: 'test',
        tenantId: 't1',
        data: {},
        timestamp: new Date(),
      };

      jest.useFakeTimers();
      const retryPromise = (service as any).executeWithRetry('test', handler, event);
      await jest.advanceTimersByTimeAsync(2000);
      await retryPromise;

      expect(handler).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('getMetrics', () => {
    it('should return empty object when no events processed', () => {
      const metrics = service.getMetrics();
      expect(metrics).toEqual({});
    });

    it('should track success metrics', () => {
      (service as any).recordMetric('test.event', true);
      (service as any).recordMetric('test.event', true);
      (service as any).recordMetric('test.event', false);

      const metrics = service.getMetrics();
      expect(metrics['test.event']).toEqual({ success: 2, failure: 1 });
    });
  });

  describe('publishToDlq', () => {
    it('should not throw when NATS is not connected', async () => {
      await expect(
        (service as any).publishToDlq('test', { type: 'test' }, new Error('fail')),
      ).resolves.not.toThrow();
    });
  });
});
