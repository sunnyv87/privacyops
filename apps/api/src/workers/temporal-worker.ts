// Temporal Worker Bootstrap
// Runs as a separate process: node dist/workers/temporal-worker.js
//
// This worker registers Temporal activities backed by NestJS services.
// It creates a NestJS application context (without HTTP listener) to
// access DI-injected services, then wraps them as Temporal activities.

import { NestFactory } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { AppModule } from '../app.module';
import { DiscoveryService } from '../modules/discovery/discovery.service';
import { ClassificationService } from '../modules/classification/classification.service';
import { DspmService } from '../modules/dspm/dspm.service';
import { Logger } from '@nestjs/common';
import { createServer } from 'http';

const logger = new Logger('TemporalWorker');

/** Minimal HTTP health server for K8s probes. */
function startHealthServer(port: number, isReady: () => boolean) {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', worker: 'temporal', timestamp: new Date().toISOString() }));
    } else if (req.url === '/health/ready') {
      const ready = isReady();
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', worker: 'temporal' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => {
    logger.log(`Worker health server listening on port ${port}`);
  });
  return server;
}

async function bootstrap() {
  let workerReady = false;

  // Start health server before anything else so K8s can probe during init
  const healthPort = parseInt(process.env.WORKER_HEALTH_PORT ?? '4001', 10);
  startHealthServer(healthPort, () => workerReady);

  // Create NestJS app context for DI (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule);
  const discoveryService = app.get(DiscoveryService);
  const classificationService = app.get(ClassificationService);
  const dspmService = app.get(DspmService);

  // Connect to Temporal
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  // Create activities backed by NestJS services
  const activities = {
    discoverAssets: async (input: { scanJobId: string; tenantId: string; dataSourceId: string }) => {
      const result = await discoveryService.executeScan(input.scanJobId);
      // Return asset IDs (fetch from DB after scan)
      const assets = await discoveryService.findAllAssets(input.tenantId, {
        dataSourceId: input.dataSourceId,
        page: 1,
        pageSize: 1000,
      });
      return assets.data.map((a: any) => a.id);
    },
    classifyAsset: async (input: { tenantId: string; assetId: string }) => {
      await classificationService.classifyAsset(input.tenantId, 'system', {
        assetId: input.assetId,
      });
    },
    calculateRiskScore: async (input: { tenantId: string; assetId: string }) => {
      await dspmService.recalculateRisk(input.tenantId, input.assetId);
    },
    notifyScanComplete: async (input: {
      tenantId: string;
      scanJobId: string;
      assetsDiscovered: number;
      assetsClassified: number;
    }) => {
      logger.log(
        `Scan ${input.scanJobId} complete: ${input.assetsDiscovered} assets, ${input.assetsClassified} classified`,
      );
    },
  };

  // Start worker for scan queue
  const scanWorker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'privacyops',
    taskQueue: 'scan-queue',
    workflowsPath: require.resolve('../core/workflow/workflows/scan.workflow'),
    activities,
  });

  workerReady = true;
  logger.log('Temporal worker started, listening on scan-queue');
  await scanWorker.run();
}

bootstrap().catch((err) => {
  logger.error('Temporal worker failed to start', err);
  process.exit(1);
});
