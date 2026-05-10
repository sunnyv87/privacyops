# TechD PrivacyOps -- Monitoring and Observability Guide

## Overview

PrivacyOps implements the three pillars of observability: distributed tracing (OpenTelemetry + Jaeger), metrics (Prometheus + prom-client), and structured logging. The observability stack is provisioned via `docker-compose.yml` and configured in `infra/`.

### Stack Components

| Component | Image | Port | Purpose |
|-----------|-------|------|---------|
| Jaeger | `jaegertracing/all-in-one:1.54` | 16686 (UI), 4318 (OTLP) | Distributed tracing |
| Prometheus | `prom/prometheus:v2.51.0` | 9090 | Metrics collection |
| Grafana | `grafana/grafana:10.4.0` | 3001 | Dashboards and alerting |

---

## 1. OpenTelemetry Tracing

### Bootstrap

Tracing MUST be initialized before any other imports in `apps/api/src/main.ts`:

```typescript
import { initTracing, shutdownTracing } from './core/telemetry/tracing';
initTracing();
// All other imports follow
```

### Configuration

`apps/api/src/core/telemetry/tracing.ts`:

```typescript
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'privacyops-api';
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
  }),
  spanProcessors: [new BatchSpanProcessor(exporter)],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-pg': {
        addSqlCommenterComment: false,
        enhancedDatabaseReporting: false,
      },
    }),
  ],
});
```

### Auto-Instrumented Libraries

| Library | Instrumentation | Notes |
|---------|----------------|-------|
| HTTP (inbound) | `@opentelemetry/instrumentation-http` | All API routes |
| HTTP (outbound) | `@opentelemetry/instrumentation-http` | Connector API calls |
| Express | `@opentelemetry/instrumentation-express` | Middleware spans |
| Prisma / pg | `@opentelemetry/instrumentation-pg` | Database queries |
| ioredis | `@opentelemetry/instrumentation-ioredis` | Cache operations |
| NATS | `@opentelemetry/instrumentation-nats` | Event publish/subscribe |

Filesystem and DNS instrumentation are disabled to reduce noise.

### Environment Variables

```bash
OTEL_ENABLED=true                                    # Set to 'false' to disable
OTEL_SERVICE_NAME=privacyops-api                     # Service name in traces
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318    # OTLP HTTP endpoint
```

### Correlation ID

`apps/api/src/core/telemetry/correlation-id.middleware.ts` generates a unique correlation ID per request and propagates it to:
- HTTP response headers
- Log entries
- NATS event `correlationId` field
- OpenTelemetry trace context

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await app.close();
  await shutdownTracing();  // Flush pending spans
  process.exit(0);
});
```

---

## 2. Prometheus Metrics

### Metrics Endpoint

```
GET /api/v1/metrics
```

Exposed by `apps/api/src/core/telemetry/prometheus.controller.ts`. Returns Prometheus exposition format.

### Metric Categories

`apps/api/src/core/telemetry/prometheus.service.ts` defines all custom metrics:

#### HTTP Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `http_requests_total` | Counter | `method`, `route`, `status_code` |
| `http_errors_total` | Counter | `method`, `route` |

Buckets: `[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`

#### Connector Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `connector_health_status` | Gauge | `connector_type`, `data_source_id` |
| `connector_sync_duration_seconds` | Histogram | `connector_type` |
| `connector_sync_errors_total` | Counter | `connector_type` |

#### Workflow Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `workflow_execution_duration_seconds` | Histogram | `workflow_type` |
| `workflow_errors_total` | Counter | `workflow_type` |
| `workflow_active_count` | Gauge | `workflow_type` |

#### Event Pipeline Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `event_published_total` | Counter | `event_type` |
| `event_consumed_total` | Counter | `event_type` |
| `event_failed_total` | Counter | `event_type` |
| `event_dlq_total` | Counter | `event_type` |
| `event_processing_duration_seconds` | Histogram | `event_type` |

#### Business Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `scan_job_duration_seconds` | Histogram | `connector_type` |
| `assets_discovered_total` | Counter | `connector_type` |
| `classification_job_duration_seconds` | Histogram | -- |
| `risk_score_calculation_duration_seconds` | Histogram | -- |
| `remediation_execution_duration_seconds` | Histogram | `action_type` |
| `dsar_workflow_duration_seconds` | Histogram | `request_type` |
| `breach_workflow_duration_seconds` | Histogram | `severity` |

#### Infrastructure Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `dependency_up` | Gauge | `dependency` |
| `slo_error_budget_remaining` | Gauge | `slo_name` |
| `ai_call_total` | Counter | `tenant_id`, `provider`, `method`, `status` |
| `ai_call_duration_seconds` | Histogram | `tenant_id`, `provider`, `method` |
| `ai_circuit_state` | Gauge | `provider` |

Default Node.js runtime metrics (GC, event-loop lag, heap) are collected automatically via `collectDefaultMetrics()`.

---

## 3. Prometheus Configuration

`infra/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'privacyops-api'
    metrics_path: /api/v1/metrics
    static_configs:
      - targets: ['host.docker.internal:4000']
        labels:
          service: 'privacyops-api'

  - job_name: 'nats'
    metrics_path: /metrics
    static_configs:
      - targets: ['nats:8222']
        labels:
          service: 'nats'
```

### Kubernetes ServiceMonitor

`infra/helm/privacyops/templates/servicemonitor.yaml` enables auto-discovery:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: privacyops-api
spec:
  selector:
    matchLabels:
      app: privacyops-api
  endpoints:
    - port: http
      path: /api/v1/metrics
      interval: 15s
      scrapeTimeout: 10s
```

---

## 4. Grafana Dashboards

Pre-built dashboards are at `infra/grafana/dashboards/`:

| Dashboard | File | Key Panels |
|-----------|------|------------|
| System Overview | `system-overview.json` | Request rate, error rate, latency percentiles, dependency health |
| API Performance | `api-performance.json` | Per-route latency, throughput, error breakdown |
| Connector Health | `connector-health.json` | Connector status, sync duration, error rates by type |
| Event Pipeline | `event-pipeline.json` | Published/consumed rates, DLQ accumulation, processing latency |
| Workflow Health | `workflow-health.json` | Active workflows, execution duration, error rates |
| SLO Overview | `slo-overview.json` | Availability gauge (99.9% target), error budget remaining |

### Provisioning

Dashboards are auto-provisioned via `infra/grafana/provisioning/`:

```yaml
# infra/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: 'PrivacyOps'
    folder: 'PrivacyOps'
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

```yaml
# infra/grafana/provisioning/datasources/datasources.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

---

## 5. Alert Rules

`infra/helm/privacyops/templates/prometheus-rules.yaml` defines alert rules in 5 groups:

### API Health

```yaml
- alert: API5xxErrorSpike
  expr: (sum(rate(http_errors_total[5m])) / max(sum(rate(http_requests_total[5m])), 1)) > 0.05
  for: 2m
  labels: { severity: critical }

- alert: APILatencyDegradation
  expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2
  for: 5m
  labels: { severity: warning }
```

### Dependencies

```yaml
- alert: PostgreSQLDown      # severity: critical, for: 1m
- alert: RedisDown            # severity: critical, for: 1m
- alert: NATSDown             # severity: critical, for: 2m
- alert: TemporalDown         # severity: warning,  for: 2m
- alert: OpenSearchDown       # severity: warning,  for: 5m
```

### Connectors

```yaml
- alert: ConnectorSyncFailure
  expr: increase(connector_sync_errors_total[15m]) > 3
  labels: { severity: warning }

- alert: ConnectorHealthUnhealthy
  expr: connector_health_status == 0
  for: 5m
  labels: { severity: warning }
```

### Event Pipeline

```yaml
- alert: EventConsumerFailure
  expr: increase(event_failed_total[10m]) > 5
  labels: { severity: warning }

- alert: HighDeadLetterQueueCount
  expr: increase(event_dlq_total[30m]) > 10
  labels: { severity: critical }
```

### Critical Business Flows

```yaml
- alert: BreachWorkflowFailure
  expr: increase(workflow_errors_total{workflow_type="breach"}[1h]) > 0
  for: 1m
  labels: { severity: critical }
  annotations: { summary: "Breach response workflow failed -- regulatory SLA at risk" }

- alert: RiskEngineFailure    # severity: warning, for: 5m
- alert: RemediationExecutionFailure  # severity: warning
```

---

## 6. Structured Logging

### Logger

`apps/api/src/core/telemetry/structured-logger.service.ts` implements the NestJS `LoggerService` interface with JSON output:

```json
{
  "level": "log",
  "message": "Scan completed",
  "context": "DiscoveryService",
  "timestamp": "2026-05-10T14:30:00.000Z",
  "correlationId": "req-abc-123",
  "tenantId": "tenant-uuid",
  "scanJobId": "scan-uuid",
  "assetsDiscovered": 150
}
```

### Log Levels

| Level | `LOG_LEVEL` Value | Use Case |
|-------|-------------------|----------|
| Error | `error` | Unrecoverable failures |
| Warn | `warn` | Degraded operation, security events |
| Log | `log` | Business events (production default) |
| Debug | `debug` | Development detail (dev default) |
| Verbose | `verbose` | Trace-level detail |

### Request Logging

`apps/api/src/core/security/request-logger.middleware.ts` logs every HTTP request with:
- Method, URL, status code
- Response time
- IP address (for audit)
- Correlation ID

---

## 7. SLI/SLO Definitions

### SLO Targets

| SLO | Target | Measurement |
|-----|--------|-------------|
| API Availability | 99.9% | `1 - (sum(http_errors_total) / sum(http_requests_total))` |
| API Latency (p95) | < 2s | `histogram_quantile(0.95, http_request_duration_seconds)` |
| DSAR Completion | 100% within 30 days | `dsar_workflow_duration_seconds` |
| Breach Notification | 100% within 72h | `breach_workflow_duration_seconds` |
| Scan Success Rate | > 99% | `1 - (connector_sync_errors_total / scan_job_total)` |
| Event Processing | 99.9% | `1 - (event_failed_total / event_published_total)` |

### Error Budget

The `slo_error_budget_remaining` gauge tracks remaining error budget as a fraction:

```
1.0 = 100% budget remaining (no errors)
0.5 = 50% budget consumed
0.0 = budget exhausted -- freeze deployments
```

The SLO Overview dashboard at `infra/grafana/dashboards/slo-overview.json` displays gauge panels with thresholds:
- Green: >= 99.9%
- Yellow: >= 99.5%
- Orange: >= 99%
- Red: < 99%

---

## 8. Trace Correlation

Traces, logs, and metrics are correlated via:

1. **Correlation ID**: Generated by `CorrelationIdMiddleware`, propagated through HTTP headers, NATS events, and log entries
2. **OpenTelemetry Trace ID**: Auto-injected into HTTP responses and linked in log entries
3. **Prometheus exemplars**: Link metrics to specific trace IDs for drill-down

### Example Query Flow

```
Grafana Dashboard (high latency alert)
  -> Click metric exemplar
  -> Jaeger trace view (distributed timeline)
  -> Click span (Prisma query)
  -> View SQL query duration
  -> Correlate with audit log via correlationId
```

---

## 9. Health Check Dashboard

The readiness endpoint (`/api/v1/health/ready`) checks all 5 critical dependencies and sets Prometheus gauges:

```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "nats": "connected",
  "temporal": "connected",
  "opensearch": "connected"
}
```

Each dependency status is exported as `dependency_up{dependency="<name>"}` with value 1 (up) or 0 (down).
