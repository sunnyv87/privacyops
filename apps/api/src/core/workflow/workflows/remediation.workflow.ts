import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities/approval.activities';
import { remediationApprovalSignal, DecisionSignalPayload } from '../signals';

const {
  validateFinding,
  proposeAction,
  awaitApproval,
  executeRemediation,
  validateResult,
  notifyRemediationComplete,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  scheduleToCloseTimeout: '2 hours',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

const APPROVAL_SIGNAL_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface RemediationInput {
  findingId: string;
  tenantId: string;
  actionType: string;
}

export async function remediationWorkflow(input: RemediationInput): Promise<{
  status: string;
  remediationId: string;
}> {
  // Signal handler for approval decision
  let signalPayload: DecisionSignalPayload | null = null;
  setHandler(remediationApprovalSignal, (p) => {
    signalPayload = p;
  });

  // Step 1: Validate the finding exists and is actionable
  const finding = await validateFinding({
    tenantId: input.tenantId,
    findingId: input.findingId,
  });

  if (!finding.valid) {
    return { status: 'invalid_finding', remediationId: '' };
  }

  // Step 2: Propose a remediation action
  const proposal = await proposeAction({
    tenantId: input.tenantId,
    findingId: input.findingId,
    actionType: input.actionType,
  });

  // Step 3: Await approval — prefer signal, fall back to DB poll.
  const gotSignal = await condition(
    () => signalPayload !== null,
    APPROVAL_SIGNAL_TIMEOUT_MS,
  );
  let approval: { approved: boolean };
  if (gotSignal && signalPayload) {
    const sp = signalPayload as DecisionSignalPayload;
    approval = { approved: sp.decision === 'approved' };
  } else {
    approval = await awaitApproval({
      tenantId: input.tenantId,
      proposalId: proposal.proposalId,
    });
  }

  if (!approval.approved) {
    return { status: 'rejected', remediationId: proposal.proposalId };
  }

  // Step 4: Execute the remediation
  const result = await executeRemediation({
    tenantId: input.tenantId,
    findingId: input.findingId,
    proposalId: proposal.proposalId,
  });

  // Step 5: Validate the remediation result
  await validateResult({
    tenantId: input.tenantId,
    findingId: input.findingId,
    remediationId: result.remediationId,
  });

  // Step 6: Notify stakeholders of completion
  await notifyRemediationComplete({
    tenantId: input.tenantId,
    findingId: input.findingId,
    remediationId: result.remediationId,
  });

  return { status: 'completed', remediationId: result.remediationId };
}
