import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/approval.activities';

const { validateAssessment, assignReviewer, awaitReview, recordDecision, notifyOutcome } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 minutes',
    retry: { maximumAttempts: 3 },
  });

interface DpiaApprovalInput {
  assessmentId: string;
  tenantId: string;
  reviewerId: string;
}

export async function dpiaApprovalWorkflow(input: DpiaApprovalInput): Promise<{
  status: string;
  decision: string;
}> {
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

  // Step 3: Await the reviewer's decision
  const review = await awaitReview({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
    reviewerId: input.reviewerId,
  });

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
