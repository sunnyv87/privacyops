import { proxyActivities, sleep, condition } from '@temporalio/workflow';
import type * as activities from '../activities/dsar.activities';

const {
  verifyIdentity,
  collectData,
  generateResponse,
  notifyCompletion,
  notifyOverdue,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  scheduleToCloseTimeout: '1 hour',
  heartbeatTimeout: '3 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

interface DsarInput {
  requestId: string;
  tenantId: string;
  type: string;
  dueDateIso: string;
}

export async function dsarWorkflow(input: DsarInput): Promise<{ status: string }> {
  const dueDate = new Date(input.dueDateIso);

  // Step 1: Identity verification
  const verified = await verifyIdentity({
    tenantId: input.tenantId,
    requestId: input.requestId,
  });

  if (!verified) {
    return { status: 'identity_verification_failed' };
  }

  // Step 2: Collect data from all connected sources
  const collectedData = await collectData({
    tenantId: input.tenantId,
    requestId: input.requestId,
    type: input.type,
  });

  // Step 3: Generate response package
  await generateResponse({
    tenantId: input.tenantId,
    requestId: input.requestId,
    type: input.type,
    data: collectedData,
  });

  // Step 4: Check if we're past due date
  if (new Date() > dueDate) {
    await notifyOverdue({
      tenantId: input.tenantId,
      requestId: input.requestId,
    });
  }

  // Step 5: Notify completion
  await notifyCompletion({
    tenantId: input.tenantId,
    requestId: input.requestId,
  });

  return { status: 'completed' };
}
