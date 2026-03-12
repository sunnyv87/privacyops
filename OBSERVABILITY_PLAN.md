# Observability Audit & Fix Plan — TechD PrivacyOps + DSPM Platform

**Date**: 2026-03-12
**Reviewer**: Principal Platform Reliability Engineer
**Current Score**: 78/100 (Observability: 54/100)
**Target Score**: 85+/100 (Observability: 80+/100)

---

## 1. Executive Summary

Observability is the single remaining production blocker. The platform has strong security (87/100) and improving performance (73/100), but operational visibility is critically underdeveloped. There is **zero distributed tracing**, **no Prometheus metrics export**, **no external alerting integration**, **no global exception filter**, and **no Grafana dashboards**. The audit trail is excellent (chain-hashed, tamper-detected, redacted), but operational telemetry — the data operators need to debug, alert, and respond — is near-absent.

**Key findings:**
- 86 services use NestJS native Logger with no structured transport
- MetricsInterceptor exists but is **not globally registered** — HTTP metrics are not being collected
- OpenTelemetry API is in the lock file but **zero instrumentation exists**
- Health probes check only Postgres + Redis; NATS, Temporal, OpenSearch are unchecked
- Workers have **no health endpoints at all**
- Alerts are stored in a DB table with no external routing (no PagerDuty/Slack/Grafana)
- Zero SLO/SLI tracking
- No correlation IDs propagated across HTTP → Events → Workflows
- 11 `console.warn` calls bypass the logger entirely

---

## 2. Current Observability Audit

### A. LOGGING

| Aspect | Status | Detail |
|--------|--------|--------|
| Library | NestJS native Logger | No Winston/Pino. No structured transport. |
| Structured JSON | **Partial** | Request middleware (request-logger.middleware.ts) outputs JSON. 86 other services use string interpolation. |
| Correlation IDs | **Not implemented** | `correlationId` field exists in PlatformEvent interface but is never set or propagated. No x-request-id middleware. |
| Tenant ID in logs | Good | Request logger includes tenantId from req.user. Service logs include tenantId in ~60% of calls. |
| Sensitive masking | **Audit only** | audit.service.ts has 20+ redaction patterns. Application logs have zero redaction. |
| Log shipping | **None** | stdout/stderr only. No ELK, Fluentd, Datadog, or CloudWatch transport. |
| Log levels | Good | log/warn/error/debug used appropriately. LOG_LEVEL env var exists. |
| Console bypasses | 11 occurrences | Connectors (S3, Azure, MySQL, Snowflake, GCP) + main.ts use console.warn/console.log. |

### B. METRICS

| Aspect | Status | Detail |
|--------|--------|--------|
| Prometheus export | **None** | No prom-client dependency. No /metrics endpoint. |
| MetricsInterceptor | **Not activated** | Exists in observability.module.ts but NOT registered as APP_INTERCEPTOR in app.module.ts. |
| Metric types | 2 only | request_latency_ms, request_error. No histograms, gauges, counters. |
| Storage | PostgreSQL | Metrics written to serviceMetric table. Not time-series optimized. |
| Connector metrics | Health only | ConnectorHealthLog tracks response time and status. No sync duration, throughput, or failure rate metrics. |
| Workflow metrics | **None** | No workflow execution duration, success/failure rate, or queue depth metrics. |
| Event pipeline metrics | In-memory only | EventBusService tracks success/failure counts in a Map. Lost on restart. No persistence. |
| Business metrics | **None** | No scan count, classification count, risk score distribution, or DSAR completion rate metrics. |

### C. TRACING

| Aspect | Status | Detail |
|--------|--------|--------|
| OpenTelemetry | **Zero instrumentation** | @opentelemetry/api in lock file but no SDK, no exporters, no auto-instrumentation. |
| Request tracing | **None** | No trace context headers (traceparent, tracestate, x-request-id) extracted or propagated. |
| Inter-service tracing | **None** | NATS events have optional correlationId but it's never populated. |
| Workflow tracing | **None** | Temporal activities log manually but no trace context passed. |
| DB query tracing | **None** | Prisma has no query-level tracing enabled. |
| Connector tracing | **None** | Connector operations not traced. |

### D. HEALTH CHECKS

| Aspect | Status | Detail |
|--------|--------|--------|
| Liveness | Basic | GET /health → {status: "ok", timestamp}. No dependency checks. |
| Readiness | Partial | GET /health/ready checks Postgres + Redis. Returns 200 always (even when not_ready). |
| NATS health | **Not checked** | Connection tested at startup; failures logged but not exposed. |
| Temporal health | **Not checked** | Worker connects or logs warning. No health endpoint. |
| OpenSearch health | **Not checked** | SearchService.onModuleInit logs connection but no ongoing check. |
| Worker health | **None** | temporal-worker.ts and scan-worker.ts have no health endpoints or heartbeats. |
| K8s probes | API only | Worker deployment has no liveness/readiness probes configured. |

### E. ALERTING

| Aspect | Status | Detail |
|--------|--------|--------|
| Alert creation | DB-backed | PlatformAlertService stores alerts in platformAlert table. |
| Event triggers | 6 types | breach, risk score high, remediation, connector health, unauthorized access, suspicious activity. |
| Threshold alerts | **None** | No automatic alerts for latency, error rate, queue depth, or resource usage. |
| External routing | **None** | No PagerDuty, OpsGenie, Slack, or Grafana Alertmanager integration. |
| Alert aggregation | **None** | No deduplication, grouping, or suppression. |
| Escalation | **None** | No severity-based escalation or on-call routing. |
| Alert rules config | **None** | No Prometheus alerting rules, no AlertManager config. |

### F. DASHBOARDS

| Aspect | Status | Detail |
|--------|--------|--------|
| Grafana dashboards | **None** | Zero dashboard JSON files in repo. |
| API dashboard | Minimal | GET /observability/dashboard returns JSON with 24h performance summary + connector health + alert stats. |
| Service dashboards | **None** | No per-service operational visibility. |
| SLO dashboards | **None** | No SLI tracking, no error budget visualization. |

---

## 3. Critical Production Blockers

### CRITICAL (Must fix before production)

| # | Blocker | Risk | Effort |
|---|---------|------|--------|
| C1 | **Zero distributed tracing** | Cannot debug request flows across API → NATS → Temporal → Connectors | Medium |
| C2 | **MetricsInterceptor not globally registered** | HTTP metrics not being collected at all — the existing infrastructure is silently broken | Trivial |
| C3 | **No Prometheus /metrics endpoint** | Cannot integrate with any standard monitoring stack | Medium |
| C4 | **No global exception filter** | Unhandled errors return raw NestJS stack traces; no tenant-aware error tracking | Small |
| C5 | **Health probes missing NATS/Temporal/OpenSearch** | K8s can't properly determine readiness; traffic routed to unhealthy pods | Small |
| C6 | **No correlation IDs** | Cannot trace a single request through logs, events, and workflows | Medium |

### HIGH PRIORITY (Should fix before production)

| # | Gap | Risk | Effort |
|---|-----|------|--------|
| H1 | No worker health checks or K8s probes | Workers silently fail; K8s can't restart them | Small |
| H2 | No threshold-based alerting | No automatic detection of latency spikes, error surges, or queue backlogs | Medium |
| H3 | Application logs not structured/redacted | Sensitive data may leak in logs; logs not parseable by aggregators | Medium |
| H4 | Event pipeline metrics lost on restart | In-memory Map not persisted; no DLQ depth visibility | Small |
| H5 | Readiness probe returns 200 even when not_ready | K8s routes traffic to pods that can't serve | Trivial |

### MEDIUM PRIORITY (Important for operational maturity)

| # | Improvement | Benefit | Effort |
|---|-------------|---------|--------|
| M1 | Grafana dashboard provisioning (JSON) | Visual operational visibility | Medium |
| M2 | SLO/SLI tracking for key flows | Error budget visibility; data-driven reliability decisions | Medium |
| M3 | Prometheus ServiceMonitor CRDs | Auto-discovery by Prometheus Operator in K8s | Small |
| M4 | Docker Compose monitoring stack | Dev/staging parity with production monitoring | Small |
| M5 | Console.warn cleanup (11 occurrences) | Consistent logging through Logger | Trivial |

### OPTIONAL ENHANCEMENTS

| # | Enhancement | Benefit |
|---|-------------|---------|
| O1 | PagerDuty/OpsGenie webhook integration | On-call alerting |
| O2 | Audit vs operational log separation at transport level | Compliance isolation |
| O3 | Custom Prisma query tracing middleware | DB performance visibility |

---

## 4. Logging Gaps

1. **No correlation ID middleware**: Requests cannot be traced across services
2. **86 services use unstructured string interpolation**: Only request-logger.middleware.ts outputs JSON
3. **No sensitive data redaction in application logs**: audit.service.ts redacts, but logger.log/warn/error calls don't
4. **No log transport configuration**: Logs go to stdout only; no ability to ship to ELK/Datadog
5. **11 console.warn/log bypasses**: Connector implementations skip the logger
6. **No log format standardization**: Each service formats differently
7. **No request context propagation**: Logger calls don't include requestId, traceId, or spanId

---

## 5. Metrics Gaps

1. **MetricsInterceptor not globally registered**: The interceptor exists but is dead code — never applied
2. **No Prometheus client library**: No prom-client, no /metrics endpoint, no exposition format
3. **Only 2 metric types**: Missing histograms (latency distribution), gauges (queue depth, active connections), counters (requests total, errors total)
4. **No workflow metrics**: Scan duration, classification throughput, risk calculation time — all unmeasured
5. **No connector sync metrics**: Sync duration, assets discovered per scan, failure rate — unmeasured
6. **No event pipeline metrics persisted**: In-memory Map lost on restart
7. **No business metrics**: DSAR completion rate, breach response time, consent update latency
8. **Metrics stored in PostgreSQL**: Not designed for time-series workloads; no retention automation active

---

## 6. Tracing Gaps

1. **Zero OpenTelemetry instrumentation**: API available in dependencies but never initialized
2. **No trace context propagation**: HTTP requests don't extract or inject trace headers
3. **No NATS trace context**: Events don't carry trace/span IDs
4. **No Temporal trace context**: Workflow activities don't propagate traces
5. **No Prisma query tracing**: Database queries not instrumented
6. **No connector operation tracing**: Connector initialize/listAssets/disconnect not traced
7. **No trace exporter configured**: No Jaeger, OTLP, or console exporter

---

## 7. Health Check Gaps

1. **NATS not checked**: EventBusService connects at startup but health not exposed
2. **Temporal not checked**: Worker connects but no health endpoint
3. **OpenSearch not checked**: SearchService.onModuleInit tests connection but no ongoing health check
4. **Workers have no health endpoints**: temporal-worker.ts and scan-worker.ts expose nothing
5. **Readiness probe returns HTTP 200 even when not_ready**: Should return 503 for K8s to stop routing traffic
6. **Worker K8s deployment has no probes**: worker-deployment.yaml lacks liveness/readiness configuration
7. **No dependency degradation model**: No circuit breaker or graceful degradation when dependencies are partially down

---

## 8. Alerting Gaps

1. **No threshold-based alerts**: Metrics are recorded but never evaluated against thresholds
2. **No external alert routing**: Alerts stored in DB only; no PagerDuty, Slack, or email escalation
3. **No alert deduplication**: Identical alerts can flood the system
4. **No Prometheus AlertManager rules**: No alerting rules YAML files exist
5. **No alerts for**: API 5xx spike, latency degradation, DB connectivity, queue backlog, DLQ accumulation, workflow stuck, worker heartbeat missing
6. **No escalation policy**: All alerts treated equally regardless of severity

---

## 9. Dashboard Gaps

1. **Zero Grafana dashboards**: No JSON dashboard files in the repository
2. **No visual monitoring**: Only a JSON API endpoint exists (GET /observability/dashboard)
3. **No per-service dashboards**: No visibility into individual service health
4. **No workflow execution dashboard**: Can't visualize Temporal workflow states
5. **No connector sync dashboard**: No historical view of connector health trends
6. **No SLO/SLA dashboard**: No error budget tracking or compliance visualization
7. **No event pipeline dashboard**: No visibility into NATS throughput, consumer lag, DLQ depth

---

## 10. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `apps/api/src/main.ts` | Add OpenTelemetry SDK bootstrap (must be first import), configure Logger |
| 2 | `apps/api/src/app.module.ts` | Register MetricsInterceptor as APP_INTERCEPTOR, register global exception filter, import tracing module |
| 3 | `apps/api/src/core/health/health.controller.ts` | Add NATS, Temporal, OpenSearch health checks; return 503 when not ready |
| 4 | `apps/api/src/core/health/health.module.ts` | Import dependencies for new health checks |
| 5 | `apps/api/src/core/security/request-logger.middleware.ts` | Add correlation ID extraction/generation, add trace context to log entries |
| 6 | `apps/api/src/core/events/event-bus.service.ts` | Propagate trace context in published events, persist event metrics |
| 7 | `apps/api/src/modules/observability/observability.module.ts` | Import new services (Prometheus, tracing) |
| 8 | `apps/api/src/modules/observability/observability.controller.ts` | Add /metrics Prometheus endpoint |
| 9 | `apps/api/src/modules/observability/metrics.interceptor.ts` | Record Prometheus histogram/counter metrics alongside DB metrics |
| 10 | `apps/api/src/modules/observability/metrics-collector.service.ts` | Add Prometheus registry, register core metrics |
| 11 | `apps/api/package.json` | Add prom-client, @opentelemetry/sdk-node, @opentelemetry/auto-instrumentations-node, @opentelemetry/exporter-trace-otlp-http |
| 12 | `apps/api/src/workers/temporal-worker.ts` | Add health endpoint (HTTP server on separate port) |
| 13 | `infra/helm/privacyops/templates/worker-deployment.yaml` | Add liveness/readiness probes |
| 14 | `infra/helm/privacyops/templates/configmap.yaml` | Add OTEL_*, PROMETHEUS_* env vars |
| 15 | `infra/helm/privacyops/values.yaml` | Add observability configuration section |
| 16 | `.env.example` | Add OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME |
| 17 | `docker-compose.yml` | Add Jaeger, Prometheus, Grafana services |

---

## 11. New Files Needed

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/api/src/core/telemetry/telemetry.module.ts` | Core telemetry module (tracing + metrics bootstrap) |
| 2 | `apps/api/src/core/telemetry/telemetry.service.ts` | OpenTelemetry SDK initialization, tracer/meter providers |
| 3 | `apps/api/src/core/telemetry/correlation-id.middleware.ts` | Extract/generate x-request-id, set AsyncLocalStorage context |
| 4 | `apps/api/src/core/telemetry/prometheus.controller.ts` | GET /metrics endpoint for Prometheus scraping |
| 5 | `apps/api/src/core/telemetry/global-exception.filter.ts` | Global exception filter with error classification and metrics |
| 6 | `apps/api/src/core/telemetry/trace-context.interceptor.ts` | Inject trace/span IDs into NestJS execution context |
| 7 | `infra/helm/privacyops/templates/servicemonitor.yaml` | Prometheus Operator ServiceMonitor CRD |
| 8 | `infra/helm/privacyops/templates/prometheus-rules.yaml` | Prometheus alerting rules (14 production alerts) |
| 9 | `infra/grafana/dashboards/api-performance.json` | API latency, throughput, error rate dashboard |
| 10 | `infra/grafana/dashboards/workflow-health.json` | Temporal workflow execution dashboard |
| 11 | `infra/grafana/dashboards/connector-health.json` | Connector sync and health dashboard |
| 12 | `infra/grafana/dashboards/event-pipeline.json` | NATS event throughput, consumer lag, DLQ dashboard |
| 13 | `infra/grafana/dashboards/system-overview.json` | Executive operational health dashboard |
| 14 | `infra/grafana/dashboards/slo-overview.json` | SLO/SLA error budget dashboard |

---

## 12. Dependencies / Packages Missing

| Package | Version | Purpose |
|---------|---------|---------|
| `prom-client` | ^15.x | Prometheus client library for metrics exposition |
| `@opentelemetry/sdk-node` | ^0.57.x | OpenTelemetry SDK for Node.js |
| `@opentelemetry/auto-instrumentations-node` | ^0.55.x | Auto-instrumentation for HTTP, Express, Prisma, ioredis |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.57.x | OTLP trace exporter (Jaeger-compatible) |
| `@opentelemetry/exporter-metrics-otlp-http` | ^0.57.x | OTLP metrics exporter (optional, Prometheus pull preferred) |
| `@opentelemetry/resources` | ^1.30.x | Resource detection (service name, version) |
| `@opentelemetry/semantic-conventions` | ^1.30.x | Standard attribute names |
| `cls-hooked` or `AsyncLocalStorage` (built-in) | N/A | Correlation ID propagation (Node.js built-in preferred) |

**Note**: No new logging library needed. NestJS Logger can be configured with a custom transport that outputs structured JSON. Adding Winston/Pino would be scope creep.

---

## 13. Recommended Fix Order

### Phase 1: Unblock metrics (Day 1)
1. **Register MetricsInterceptor globally** in app.module.ts — trivially fixes the "metrics not collected" bug
2. **Add prom-client** and create Prometheus /metrics endpoint
3. **Register core Prometheus metrics**: http_request_duration_seconds (histogram), http_requests_total (counter), http_request_errors_total (counter)
4. **Fix readiness probe** to return HTTP 503 when not_ready

### Phase 2: Correlation + tracing (Day 2-3)
5. **Create correlation ID middleware** using AsyncLocalStorage — generates x-request-id if absent, propagates through context
6. **Update request-logger.middleware.ts** to include correlationId in all structured logs
7. **Add OpenTelemetry SDK** bootstrap in main.ts (before NestFactory.create)
8. **Configure OTLP trace exporter** for Jaeger
9. **Propagate trace context** in EventBusService NATS publishes

### Phase 3: Health + error handling (Day 3-4)
10. **Extend health controller** to check NATS, Temporal, OpenSearch
11. **Add worker health HTTP endpoints** (simple HTTP server on port 4001)
12. **Add worker K8s probes** in worker-deployment.yaml
13. **Create global exception filter** with error classification and Prometheus counter

### Phase 4: Alerting (Day 4-5)
14. **Create Prometheus alerting rules** for 14 production alert scenarios
15. **Create ServiceMonitor** CRD for Prometheus Operator auto-discovery
16. **Add Jaeger + Prometheus + Grafana** to docker-compose.yml

### Phase 5: Dashboards (Day 5-6)
17. **Create 6 Grafana dashboard JSON files** covering all required views
18. **Add SLO recording rules** for key product paths

### Phase 6: Cleanup (Day 6)
19. **Replace 11 console.warn calls** with Logger in connectors + main.ts
20. **Extend sensitive field redaction** to application logs (not just audit logs)
21. **Update .env.example** and Helm values with observability configuration

---

## 14. Expected Readiness Improvement

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Logging | 55 | 80 | +25 |
| Metrics | 60 | 85 | +25 |
| Tracing | 10 | 75 | +65 |
| Health Checks | 65 | 85 | +20 |
| Audit Trail | 80 | 82 | +2 |
| Error Handling | 50 | 80 | +30 |
| Alerting | 35 | 75 | +40 |
| Dashboards | 40 | 75 | +35 |
| **Observability Overall** | **54** | **80** | **+26** |

**Projected Platform Score**: 78 → **86/100** (FULL GO)

| Platform Dimension | Before | After |
|-------------------|--------|-------|
| Architecture | 82 | 82 |
| Security | 87 | 87 |
| Performance | 73 | 73 |
| Scalability | 72 | 74 |
| Observability | 54 | 80 |
| **Weighted Total** | **78** | **86** |

---

## 15. Risks / Assumptions

### Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | OpenTelemetry auto-instrumentation may add 2-5ms per request latency | Benchmark before/after; disable unnecessary instrumentations |
| R2 | Prometheus metrics cardinality explosion (tenant × route × method) | Use allowlist for label values; aggregate tenant metrics to "system" level |
| R3 | Jaeger storage requirements grow with traffic volume | Configure sampling rate (start at 10%); use probabilistic sampler |
| R4 | Worker health HTTP server on port 4001 may conflict | Make port configurable via env var |
| R5 | Adding 7 npm packages increases supply chain risk | Pin exact versions; audit with `npm audit` |
| R6 | Grafana dashboards may drift from actual metrics if metrics change | Use dashboard-as-code approach with CI validation |

### Assumptions

| # | Assumption |
|---|------------|
| A1 | Prometheus Operator is available in the target K8s cluster (for ServiceMonitor CRDs) |
| A2 | Jaeger or OTLP-compatible collector is available or will be deployed alongside |
| A3 | Grafana is available or will be deployed (dashboards are JSON provisioning files) |
| A4 | The NestJS Logger can be extended with a custom implementation without replacing it |
| A5 | AsyncLocalStorage (Node.js built-in since v16) is available in the runtime |
| A6 | Worker processes can bind an additional HTTP port for health checks |
| A7 | All observability data is operational (non-PII) — audit logs remain separate and unchanged |

---

## Approval Checklist

- [ ] Executive Summary reviewed
- [ ] Fix order agreed upon
- [ ] Package additions approved
- [ ] New file locations approved
- [ ] No conflicts with existing modules confirmed
- [ ] Tenant isolation in metrics/logs verified as requirement
- [ ] Dashboard scope agreed upon
