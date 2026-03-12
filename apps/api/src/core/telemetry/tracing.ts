/**
 * OpenTelemetry tracing bootstrap.
 *
 * This file MUST be imported before any other application code in main.ts.
 * It initialises the NodeSDK with auto-instrumentation for:
 *  - HTTP (inbound + outbound)
 *  - Express
 *  - Prisma (database queries)
 *  - ioredis
 *  - nats
 *
 * Traces are exported via OTLP/HTTP to the endpoint specified by
 * `OTEL_EXPORTER_OTLP_ENDPOINT` (defaults to http://localhost:4318).
 *
 * If `OTEL_ENABLED` is explicitly set to 'false', tracing is disabled
 * and this module becomes a no-op.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

let sdk: NodeSDK | undefined;

export function initTracing(): void {
  if (process.env.OTEL_ENABLED === 'false') return;

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
        // Disable fs instrumentation — too noisy
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}
