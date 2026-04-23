import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Histogram,
  Counter,
  Gauge,
  collectDefaultMetrics,
  register,
} from 'prom-client';

/**
 * Prometheus metrics singleton.
 *
 * Registers standard HTTP metrics plus business-domain gauges/counters
 * for connector health, workflow execution, event pipeline, and SLOs.
 *
 * The default Node.js runtime metrics (GC, event-loop lag, heap) are
 * collected automatically via `collectDefaultMetrics`.
 */
@Injectable()
export class PrometheusService implements OnModuleInit {
  readonly registry: Registry;

  // ── HTTP ──────────────────────────────────────────────────────────────────
  readonly httpRequestDuration: Histogram;
  readonly httpRequestsTotal: Counter;
  readonly httpErrorsTotal: Counter;

  // ── Connectors ────────────────────────────────────────────────────────────
  readonly connectorHealthStatus: Gauge;
  readonly connectorSyncDuration: Histogram;
  readonly connectorSyncErrorsTotal: Counter;

  // ── Workflows ─────────────────────────────────────────────────────────────
  readonly workflowExecutionDuration: Histogram;
  readonly workflowErrorsTotal: Counter;
  readonly workflowActiveCount: Gauge;

  // ── Event pipeline ────────────────────────────────────────────────────────
  readonly eventPublishedTotal: Counter;
  readonly eventConsumedTotal: Counter;
  readonly eventFailedTotal: Counter;
  readonly eventDlqTotal: Counter;
  readonly eventProcessingDuration: Histogram;

  // ── Discovery / Classification ────────────────────────────────────────────
  readonly scanJobDuration: Histogram;
  readonly assetsDiscoveredTotal: Counter;
  readonly classificationJobDuration: Histogram;

  // ── Risk / Remediation ────────────────────────────────────────────────────
  readonly riskScoreCalculationDuration: Histogram;
  readonly remediationExecutionDuration: Histogram;

  // ── DSAR / Breach ─────────────────────────────────────────────────────────
  readonly dsarWorkflowDuration: Histogram;
  readonly breachWorkflowDuration: Histogram;

  // ── Health ────────────────────────────────────────────────────────────────
  readonly dependencyUp: Gauge;

  // ── SLO ───────────────────────────────────────────────────────────────────
  readonly sloRequestBudget: Gauge;

  // ── AI / LLM ──────────────────────────────────────────────────────────────
  readonly aiCallTotal: Counter;
  readonly aiCallDuration: Histogram;
  readonly aiCircuitState: Gauge;

  constructor() {
    this.registry = register;

    // --- HTTP ---
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total',
      help: 'Total HTTP 5xx errors',
      labelNames: ['method', 'route'],
    });

    // --- Connectors ---
    this.connectorHealthStatus = new Gauge({
      name: 'connector_health_status',
      help: 'Connector health (1=healthy, 0.5=degraded, 0=unhealthy)',
      labelNames: ['connector_type', 'data_source_id'],
    });

    this.connectorSyncDuration = new Histogram({
      name: 'connector_sync_duration_seconds',
      help: 'Connector sync duration in seconds',
      labelNames: ['connector_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    });

    this.connectorSyncErrorsTotal = new Counter({
      name: 'connector_sync_errors_total',
      help: 'Total connector sync failures',
      labelNames: ['connector_type'],
    });

    // --- Workflows ---
    this.workflowExecutionDuration = new Histogram({
      name: 'workflow_execution_duration_seconds',
      help: 'Workflow execution duration in seconds',
      labelNames: ['workflow_type'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
    });

    this.workflowErrorsTotal = new Counter({
      name: 'workflow_errors_total',
      help: 'Total workflow execution failures',
      labelNames: ['workflow_type'],
    });

    this.workflowActiveCount = new Gauge({
      name: 'workflow_active_count',
      help: 'Number of currently active workflows',
      labelNames: ['workflow_type'],
    });

    // --- Event pipeline ---
    this.eventPublishedTotal = new Counter({
      name: 'event_published_total',
      help: 'Total events published to NATS',
      labelNames: ['event_type'],
    });

    this.eventConsumedTotal = new Counter({
      name: 'event_consumed_total',
      help: 'Total events successfully consumed',
      labelNames: ['event_type'],
    });

    this.eventFailedTotal = new Counter({
      name: 'event_failed_total',
      help: 'Total events that failed all retries',
      labelNames: ['event_type'],
    });

    this.eventDlqTotal = new Counter({
      name: 'event_dlq_total',
      help: 'Total events sent to dead-letter queue',
      labelNames: ['event_type'],
    });

    this.eventProcessingDuration = new Histogram({
      name: 'event_processing_duration_seconds',
      help: 'Event processing duration in seconds',
      labelNames: ['event_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
    });

    // --- Discovery / Classification ---
    this.scanJobDuration = new Histogram({
      name: 'scan_job_duration_seconds',
      help: 'Scan job execution duration in seconds',
      labelNames: ['connector_type'],
      buckets: [5, 10, 30, 60, 120, 300, 600, 1800],
    });

    this.assetsDiscoveredTotal = new Counter({
      name: 'assets_discovered_total',
      help: 'Total assets discovered across all scans',
      labelNames: ['connector_type'],
    });

    this.classificationJobDuration = new Histogram({
      name: 'classification_job_duration_seconds',
      help: 'Classification job duration in seconds',
      buckets: [0.1, 0.5, 1, 5, 10, 30],
    });

    // --- Risk / Remediation ---
    this.riskScoreCalculationDuration = new Histogram({
      name: 'risk_score_calculation_duration_seconds',
      help: 'Risk score calculation duration in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    this.remediationExecutionDuration = new Histogram({
      name: 'remediation_execution_duration_seconds',
      help: 'Remediation action execution duration in seconds',
      labelNames: ['action_type'],
      buckets: [0.5, 1, 5, 10, 30, 60],
    });

    // --- DSAR / Breach ---
    this.dsarWorkflowDuration = new Histogram({
      name: 'dsar_workflow_duration_seconds',
      help: 'DSAR workflow total duration in seconds',
      labelNames: ['request_type'],
      buckets: [60, 300, 600, 1800, 3600, 86400],
    });

    this.breachWorkflowDuration = new Histogram({
      name: 'breach_workflow_duration_seconds',
      help: 'Breach response workflow duration in seconds',
      labelNames: ['severity'],
      buckets: [60, 300, 600, 3600, 86400, 259200],
    });

    // --- Dependency health ---
    this.dependencyUp = new Gauge({
      name: 'dependency_up',
      help: 'Whether a dependency is up (1) or down (0)',
      labelNames: ['dependency'],
    });

    // --- SLO ---
    this.sloRequestBudget = new Gauge({
      name: 'slo_error_budget_remaining',
      help: 'Remaining error budget as fraction (1.0 = 100%)',
      labelNames: ['slo_name'],
    });

    // --- AI / LLM ---
    this.aiCallTotal = new Counter({
      name: 'ai_call_total',
      help: 'Total AI provider calls',
      labelNames: ['tenant_id', 'provider', 'method', 'status'],
    });
    this.aiCallDuration = new Histogram({
      name: 'ai_call_duration_seconds',
      help: 'AI provider call latency in seconds',
      labelNames: ['tenant_id', 'provider', 'method'],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    });
    this.aiCircuitState = new Gauge({
      name: 'ai_circuit_state',
      help: 'AI circuit-breaker state (1=open, 0=closed)',
      labelNames: ['provider'],
    });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  /** Return Prometheus exposition text. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header value for Prometheus scraping. */
  getContentType(): string {
    return this.registry.contentType;
  }
}
