import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/retention.activities';
import type * as approvalActivities from '../activities/approval.activities';

const { findExpiredAssets, executeDisposal, logDisposal } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '60 minutes',
    scheduleToCloseTimeout: '3 hours',
    heartbeatTimeout: '10 minutes',
    retry: { maximumAttempts: 2, backoffCoefficient: 2 },
  });

const { checkLegalHolds } = proxyActivities<typeof approvalActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

interface RetentionInput {
  policyId: string;
  tenantId: string;
  action: string; // 'delete' | 'anonymize' | 'archive'
}

export async function retentionDisposalWorkflow(input: RetentionInput): Promise<{
  assetsProcessed: number;
  assetsHeld: number;
}> {
  // Step 1: Find assets that have exceeded retention period
  const expiredAssets = await findExpiredAssets({
    tenantId: input.tenantId,
    policyId: input.policyId,
  });

  if (expiredAssets.length === 0) {
    return { assetsProcessed: 0, assetsHeld: 0 };
  }

  // Step 2: Check legal holds — filter out assets under active holds
  const holdCheck = await checkLegalHolds({
    tenantId: input.tenantId,
    assetIds: expiredAssets,
  });

  const eligibleAssets = holdCheck.eligibleAssetIds;
  const assetsHeld = expiredAssets.length - eligibleAssets.length;

  // Step 3: Execute disposal action on each eligible asset
  let assetsProcessed = 0;
  for (const assetId of eligibleAssets) {
    await executeDisposal({
      tenantId: input.tenantId,
      assetId,
      action: input.action,
    });
    assetsProcessed++;
  }

  // Step 4: Log the disposal for audit trail
  await logDisposal({
    tenantId: input.tenantId,
    policyId: input.policyId,
    assetsProcessed,
    action: input.action,
  });

  return { assetsProcessed, assetsHeld };
}
