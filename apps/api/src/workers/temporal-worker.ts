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

const logger = new Logger('TemporalWorker');

async function bootstrap() {
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

  logger.log('Temporal worker started, listening on scan-queue');
  await scanWorker.run();
}

bootstrap().catch((err) => {
  logger.error('Temporal worker failed to start', err);
  process.exit(1);
});
