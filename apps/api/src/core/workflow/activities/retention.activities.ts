// Retention disposal workflow activities

export async function findExpiredAssets(input: {
  tenantId: string;
  policyId: string;
}): Promise<string[]> {
  // Queries assets matching the retention policy that have exceeded retention period
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function executeDisposal(input: {
  tenantId: string;
  assetId: string;
  action: string; // 'delete' | 'anonymize' | 'archive'
}): Promise<void> {
  // Executes the disposal action on the asset via its connector
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function logDisposal(input: {
  tenantId: string;
  policyId: string;
  assetsProcessed: number;
  action: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
