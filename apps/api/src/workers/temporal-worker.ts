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
import { createDsarActivities } from './activity-implementations/dsar.activities.impl';
import { createBreachActivities } from './activity-implementations/breach.activities.impl';
import { createRetentionActivities } from './activity-implementations/retention.activities.impl';
import { createVendorActivities } from './activity-implementations/vendor.activities.impl';
import { createApprovalActivities } from './activity-implementations/approval.activities.impl';

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

  // Start worker for scan queue (existing, unchanged)
  const scanWorker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'privacyops',
    taskQueue: 'scan-queue',
    workflowsPath: require.resolve('../core/workflow/workflows/scan.workflow'),
    activities,
  });

  // ---------------------------------------------------------------------
  // Additional workers — one per task queue. Each failure is isolated:
  // if any of these workers throws during creation, the others still run
  // (and the scan worker is unaffected).
  // ---------------------------------------------------------------------
  const namespace = process.env.TEMPORAL_NAMESPACE || 'privacyops';
  const extraWorkers: Worker[] = [];
  const workerSpecs: Array<{ taskQueue: string; workflowsPath: string; activities: any; label: string }> = [
    {
      taskQueue: 'dsar-queue',
      workflowsPath: require.resolve('../core/workflow/workflows/dsar.workflow'),
      activities: createDsarActivities(app),
      label: 'dsar-queue',
    },
    {
      taskQueue: 'breach-queue',
      workflowsPath: require.resolve('../core/workflow/workflows/breach.workflow'),
      activities: createBreachActivities(app),
      label: 'breach-queue',
    },
    {
      taskQueue: 'retention-queue',
      workflowsPath: require.resolve('../core/workflow/workflows/retention.workflow'),
      activities: {
        ...createRetentionActivities(app),
        // data-deletion.workflow uses approval activities on the same queue
        ...createApprovalActivities(app),
      },
      label: 'retention-queue',
    },
    {
      taskQueue: 'approval-queue',
      workflowsPath: require.resolve('../core/workflow/workflows/dpia-approval.workflow'),
      activities: createApprovalActivities(app),
      label: 'approval-queue',
    },
    {
      taskQueue: 'vendor-queue',
      workflowsPath: require.resolve('../core/workflow/workflows/vendor-review.workflow'),
      activities: createVendorActivities(app),
      label: 'vendor-queue',
    },
  ];

  for (const spec of workerSpecs) {
    try {
      const w = await Worker.create({
        connection,
        namespace,
        taskQueue: spec.taskQueue,
        workflowsPath: spec.workflowsPath,
        activities: spec.activities,
      });
      extraWorkers.push(w);
      logger.log(`Worker registered for ${spec.label}`);
    } catch (err) {
      logger.error(`Failed to register worker for ${spec.label}: ${(err as Error).message}`);
      // Isolated failure — continue with remaining workers.
    }
  }

  workerReady = true;
  logger.log(`Temporal workers ready — scan + ${extraWorkers.length} additional queue(s)`);

  // Run all workers concurrently. If any worker exits, log and continue
  // running the rest until process shutdown.
  await Promise.all(
    [scanWorker, ...extraWorkers].map((w) =>
      w.run().catch((err) => {
        logger.error(`Worker exited unexpectedly: ${(err as Error).message}`);
      }),
    ),
  );
}

bootstrap().catch((err) => {
  logger.error('Temporal worker failed to start', err);
  process.exit(1);
});
