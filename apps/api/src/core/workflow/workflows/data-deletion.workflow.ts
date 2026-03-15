import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/approval.activities';

const {
  checkLegalHolds,
  requestDeletionApproval,
  executeDisposal,
  generateCertificate,
  notifyDeletionComplete,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  scheduleToCloseTimeout: '2 hours',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

interface DataDeletionInput {
  policyId: string;
  tenantId: string;
  assetIds: string[];
}

export async function dataDeletionWorkflow(input: DataDeletionInput): Promise<{
  status: string;
  deletedCount: number;
  certificateId: string;
}> {
  // Step 1: Check for any legal holds on the assets
  const holdCheck = await checkLegalHolds({
    tenantId: input.tenantId,
    assetIds: input.assetIds,
  });

  const eligibleAssets = holdCheck.eligibleAssetIds;

  if (eligibleAssets.length === 0) {
    return { status: 'all_assets_on_hold', deletedCount: 0, certificateId: '' };
  }

  // Step 2: Request approval for the deletion
  const approval = await requestDeletionApproval({
    tenantId: input.tenantId,
    policyId: input.policyId,
    assetIds: eligibleAssets,
  });

  if (!approval.approved) {
    return { status: 'approval_denied', deletedCount: 0, certificateId: '' };
  }

  // Step 3: Execute the disposal of eligible assets
  const disposal = await executeDisposal({
    tenantId: input.tenantId,
    policyId: input.policyId,
    assetIds: eligibleAssets,
  });

  // Step 4: Generate a deletion certificate
  const certificate = await generateCertificate({
    tenantId: input.tenantId,
    policyId: input.policyId,
    deletedAssetIds: disposal.deletedAssetIds,
  });

  // Step 5: Notify stakeholders of completion
  await notifyDeletionComplete({
    tenantId: input.tenantId,
    policyId: input.policyId,
    certificateId: certificate.certificateId,
    deletedCount: disposal.deletedAssetIds.length,
  });

  return {
    status: 'completed',
    deletedCount: disposal.deletedAssetIds.length,
    certificateId: certificate.certificateId,
  };
}
