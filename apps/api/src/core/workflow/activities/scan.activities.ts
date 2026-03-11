// Scan workflow activities — executed by Temporal workers
// Each activity is an idempotent unit of work

export async function discoverAssets(input: {
  scanJobId: string;
  tenantId: string;
  dataSourceId: string;
}): Promise<string[]> {
  // Delegated to DiscoveryService.executeScan at runtime
  // Returns array of discovered asset IDs
  const { DiscoveryService } = await import('../../../modules/discovery/discovery.service');
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function classifyAsset(input: {
  tenantId: string;
  assetId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function calculateRiskScore(input: {
  tenantId: string;
  assetId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyScanComplete(input: {
  tenantId: string;
  scanJobId: string;
  assetsDiscovered: number;
  assetsClassified: number;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
