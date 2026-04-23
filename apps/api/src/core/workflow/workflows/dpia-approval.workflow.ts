import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities/approval.activities';
import { dpiaDecisionSignal, DecisionSignalPayload } from '../signals';

const { validateAssessment, assignReviewer, awaitReview, recordDecision, notifyOutcome } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 minutes',
    scheduleToCloseTimeout: '2 hours',
    heartbeatTimeout: '5 minutes',
    retry: { maximumAttempts: 3, backoffCoefficient: 2 },
  });

interface DpiaApprovalInput {
  assessmentId: string;
  tenantId: string;
  reviewerId: string;
}

/**
 * Maximum time to wait for a reviewer's signal before falling back
 * to the DB-state poll activity. 7 days accommodates realistic
 * DPIA review timelines without holding the workflow open forever.
 */
const REVIEW_SIGNAL_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export async function dpiaApprovalWorkflow(input: DpiaApprovalInput): Promise<{
  status: string;
  decision: string;
}> {
  // Register signal handler so an external API call can post the decision.
  let signalPayload: DecisionSignalPayload | null = null;
  setHandler(dpiaDecisionSignal, (p) => {
    signalPayload = p;
  });

  // Step 1: Validate the assessment is complete and ready for review
  const validation = await validateAssessment({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
  });

  if (!validation.valid) {
    return { status: 'validation_failed', decision: 'none' };
  }

  // Step 2: Assign the reviewer to the assessment
  await assignReviewer({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
    reviewerId: input.reviewerId,
  });

  // Step 3: Await the reviewer's decision — prefer signal, fall back to
  // the existing DB-poll activity if no signal arrives in time.
  const gotSignal = await condition(() => signalPayload !== null, REVIEW_SIGNAL_TIMEOUT_MS);
  let review: { decision: string; comments: string };
  if (gotSignal && signalPayload) {
    const sp = signalPayload as DecisionSignalPayload;
    review = { decision: sp.decision, comments: sp.comments ?? '' };
  } else {
    review = await awaitReview({
      tenantId: input.tenantId,
      assessmentId: input.assessmentId,
      reviewerId: input.reviewerId,
    });
  }

  // Step 4: Record the decision
  await recordDecision({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
    decision: review.decision,
    comments: review.comments,
  });

  // Step 5: Notify stakeholders of the outcome
  await notifyOutcome({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
    decision: review.decision,
  });

  return { status: 'completed', decision: review.decision };
}
