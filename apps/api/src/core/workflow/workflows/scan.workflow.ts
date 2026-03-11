import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/scan.activities';

const { discoverAssets, classifyAsset, calculateRiskScore, notifyScanComplete } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 minutes',
    retry: { maximumAttempts: 3 },
  });

interface ScanInput {
  scanJobId: string;
  tenantId: string;
  dataSourceId: string;
}

export async function scanWorkflow(input: ScanInput): Promise<{
  assetsDiscovered: number;
  assetsClassified: number;
}> {
  // Step 1: Discover assets from the data source
  const discoveredAssets = await discoverAssets(input);

  // Step 2: Classify each discovered asset
  let assetsClassified = 0;
  for (const assetId of discoveredAssets) {
    await classifyAsset({ tenantId: input.tenantId, assetId });
    assetsClassified++;

    // Step 3: Calculate risk score for the asset
    await calculateRiskScore({ tenantId: input.tenantId, assetId });
  }

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
