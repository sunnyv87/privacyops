import { StructuredLogger } from '../../../src/core/telemetry/structured-logger.service';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.LOG_LEVEL = 'debug';
    logger = new StructuredLogger();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  it('should output JSON-structured log entries', () => {
    logger.log('test message', 'TestContext');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('log');
    expect(output.message).toBe('test message');
    expect(output.service).toBe('TestContext');
    expect(output.timestamp).toBeDefined();
  });

  it('should write errors to stderr', () => {
    logger.error('fail', 'TestContext');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('fail');
  });

  it('should redact sensitive fields', () => {
    logger.log({ username: 'alice', password: 'secret123', apiKey: 'key-abc' }, 'Auth');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.username).toBe('alice');
    expect(output.password).toBe('[REDACTED]');
    expect(output.apiKey).toBe('[REDACTED]');
  });

  it('should respect LOG_LEVEL filtering', () => {
    process.env.LOG_LEVEL = 'warn';
    const filteredLogger = new StructuredLogger();

    filteredLogger.log('should be filtered', 'Test');
    filteredLogger.warn('should appear', 'Test');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('warn');
  });

  it('should handle object messages by merging into log entry', () => {
    logger.log({ method: 'GET', url: '/api/v1/health', statusCode: 200 }, 'HTTP');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.method).toBe('GET');
    expect(output.url).toBe('/api/v1/health');
    expect(output.statusCode).toBe(200);
    expect(output.service).toBe('HTTP');
  });
});
