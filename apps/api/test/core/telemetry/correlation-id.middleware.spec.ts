import { CorrelationIdMiddleware } from '../../../src/core/telemetry/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should generate a UUID correlation ID when none is provided', (done) => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(req.correlationId).toBeDefined();
      expect(req.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.correlationId);
      done();
    });
  });

  it('should reuse x-request-id header when provided', (done) => {
    const existingId = 'external-trace-123';
    const req: any = { headers: { 'x-request-id': existingId } };
    const res: any = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(req.correlationId).toBe(existingId);
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', existingId);
      done();
    });
  });

  it('should make correlation ID available via static getCorrelationId()', (done) => {
    const req: any = { headers: { 'x-request-id': 'test-id-456' } };
    const res: any = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(CorrelationIdMiddleware.getCorrelationId()).toBe('test-id-456');
      done();
    });
  });

  it('should return "no-context" when called outside a request', () => {
    expect(CorrelationIdMiddleware.getCorrelationId()).toBe('no-context');
  });
});
