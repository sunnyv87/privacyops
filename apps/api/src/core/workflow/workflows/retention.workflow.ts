import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/retention.activities';

const { findExpiredAssets, executeDisposal, logDisposal } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '60 minutes',
    scheduleToCloseTimeout: '3 hours',
    heartbeatTimeout: '10 minutes',
    retry: { maximumAttempts: 2, backoffCoefficient: 2 },
  });

interface RetentionInput {
  policyId: string;
  tenantId: string;
  action: string; // 'delete' | 'anonymize' | 'archive'
}

export async function retentionDisposalWorkflow(input: RetentionInput): Promise<{
  assetsProcessed: number;
}> {
  // Step 1: Find assets that have exceeded retention period
  const expiredAssets = await findExpiredAssets({
    tenantId: input.tenantId,
    policyId: input.policyId,
  });

  // Step 2: Execute disposal action on each asset
  let assetsProcessed = 0;
  for (const assetId of expiredAssets) {
    await executeDisposal({
      tenantId: input.tenantId,
      assetId,
      action: input.action,
    });
    assetsProcessed++;
  }

  // Step 3: Log the disposal for audit trail
  await logDisposal({
    tenantId: input.tenantId,
    policyId: input.policyId,
    assetsProcessed,
    action: input.action,
  });

  return { assetsProcessed };
}
