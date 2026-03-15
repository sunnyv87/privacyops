import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/scan.activities';

const { discoverAssets, classifyAsset, calculateRiskScore, notifyScanComplete } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 minutes',
    scheduleToCloseTimeout: '2 hours',
    heartbeatTimeout: '5 minutes',
    retry: { maximumAttempts: 3, backoffCoefficient: 2 },
  });

interface ScanInput {
  scanJobId: string;
  tenantId: string;
  dataSourceId: string;
}

const CONCURRENCY_LIMIT = 10;

/**
 * Processes items in parallel with a concurrency limit.
 * Prevents overwhelming the database while still parallelizing work.
 */
async function parallelBatch<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(fn));
  }
}

export async function scanWorkflow(input: ScanInput): Promise<{
  assetsDiscovered: number;
  assetsClassified: number;
}> {
  // Step 1: Discover assets from the data source
  const discoveredAssets = await discoverAssets(input);

  // Step 2+3: Classify and score assets in parallel batches
  let assetsClassified = 0;

  await parallelBatch(discoveredAssets, CONCURRENCY_LIMIT, async (assetId: string) => {
    await classifyAsset({ tenantId: input.tenantId, assetId });
    await calculateRiskScore({ tenantId: input.tenantId, assetId });
    assetsClassified++;
  });

  // Step 4: Send completion notification
  await notifyScanComplete({
    tenantId: input.tenantId,
    scanJobId: input.scanJobId,
    assetsDiscovered: discoveredAssets.length,
    assetsClassified,
  });

  return {
    assetsDiscovered: discoveredAssets.length,
    assetsClassified,
  };
}
