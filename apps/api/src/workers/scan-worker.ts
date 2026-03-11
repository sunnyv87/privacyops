// Scan Worker — Standalone process that listens to NATS for scan jobs
// and executes them using the DiscoveryService.
//
// Run: node dist/workers/scan-worker.js
//
// This is an alternative to the Temporal worker for simpler deployments.
// It uses NATS JetStream subscriptions to pick up scan.queued events.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { EventBusService } from '../core/events/event-bus.service';
import { DiscoveryService } from '../modules/discovery/discovery.service';

const logger = new Logger('ScanWorker');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const events = app.get(EventBusService);
  const discovery = app.get(DiscoveryService);

  logger.log('Scan worker started, listening for scan.queued events...');

  await events.subscribe('privacyops.scan.queued', 'scan-worker', async (event) => {
    const { scanJobId } = event.payload as { scanJobId: string };
    logger.log(`Received scan job: ${scanJobId}`);

    try {
      const result = await discovery.executeScan(scanJobId);
      logger.log(`Scan ${scanJobId} completed: ${result.assetsDiscovered} assets discovered`);
    } catch (error) {
      logger.error(`Scan ${scanJobId} failed: ${error}`);
    }
  });
}

bootstrap().catch((err) => {
  logger.error('Scan worker failed to start', err);
  process.exit(1);
});
