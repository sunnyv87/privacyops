import { PrometheusService } from '../../../src/core/telemetry/prometheus.service';

describe('PrometheusService', () => {
  let service: PrometheusService;

  beforeEach(() => {
    service = new PrometheusService();
    // Clear default metrics from previous tests
    service.registry.clear();
    // Re-register our custom metrics (constructor registered them on the default registry)
    service = new PrometheusService();
  });

  afterEach(() => {
    service.registry.clear();
  });

  it('should expose a /metrics endpoint with Prometheus text format', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_request_duration_seconds');
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('http_errors_total');
  });

  it('should return proper content type', () => {
    const contentType = service.getContentType();
    expect(contentType).toContain('text/plain');
  });

  it('should record HTTP request duration histogram', async () => {
    service.httpRequestDuration.observe(
      { method: 'GET', route: '/health', status_code: '200' },
      0.05,
    );

    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_request_duration_seconds_bucket');
  });

  it('should increment HTTP request counter', async () => {
    service.httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/scan', status_code: '201' });
    service.httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/scan', status_code: '201' });

    const metrics = await service.getMetrics();
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('method="POST"');
  });

  it('should track dependency health gauge', async () => {
    service.dependencyUp.set({ dependency: 'postgresql' }, 1);
    service.dependencyUp.set({ dependency: 'redis' }, 0);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('dependency_up{dependency="postgresql"} 1');
    expect(metrics).toContain('dependency_up{dependency="redis"} 0');
  });

  it('should register event pipeline metrics', async () => {
    service.eventPublishedTotal.inc({ event_type: 'scan.completed' });
    service.eventConsumedTotal.inc({ event_type: 'scan.completed' });
    service.eventFailedTotal.inc({ event_type: 'scan.completed' });
    service.eventDlqTotal.inc({ event_type: 'scan.completed' });

    const metrics = await service.getMetrics();
    expect(metrics).toContain('event_published_total');
    expect(metrics).toContain('event_consumed_total');
    expect(metrics).toContain('event_failed_total');
    expect(metrics).toContain('event_dlq_total');
  });

  it('should register workflow metrics', async () => {
    service.workflowExecutionDuration.observe({ workflow_type: 'scan' }, 30);
    service.workflowErrorsTotal.inc({ workflow_type: 'scan' });
    service.workflowActiveCount.set({ workflow_type: 'scan' }, 5);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('workflow_execution_duration_seconds');
    expect(metrics).toContain('workflow_errors_total');
    expect(metrics).toContain('workflow_active_count');
  });

  it('should register connector metrics', async () => {
    service.connectorHealthStatus.set(
      { connector_type: 'aws-s3', data_source_id: 'ds-1' },
      1,
    );
    service.connectorSyncDuration.observe({ connector_type: 'aws-s3' }, 15);
    service.connectorSyncErrorsTotal.inc({ connector_type: 'aws-s3' });

    const metrics = await service.getMetrics();
    expect(metrics).toContain('connector_health_status');
    expect(metrics).toContain('connector_sync_duration_seconds');
    expect(metrics).toContain('connector_sync_errors_total');
  });
});
