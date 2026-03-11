import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/vendor.activities';

const {
  prepareAssessment,
  sendQuestionnaire,
  awaitVendorResponse,
  reviewResponses,
  scoreVendor,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 3 },
});

interface VendorReviewInput {
  vendorId: string;
  assessmentId: string;
  tenantId: string;
  dueDate: string;
}

export async function vendorReviewWorkflow(input: VendorReviewInput): Promise<{
  status: string;
  score: number;
}> {
  // Step 1: Prepare the vendor assessment
  const assessment = await prepareAssessment({
    tenantId: input.tenantId,
    vendorId: input.vendorId,
    assessmentId: input.assessmentId,
  });

  // Step 2: Send questionnaire to the vendor
  await sendQuestionnaire({
    tenantId: input.tenantId,
    vendorId: input.vendorId,
    assessmentId: input.assessmentId,
    dueDate: input.dueDate,
  });

  // Step 3: Await vendor response
  const response = await awaitVendorResponse({
    tenantId: input.tenantId,
    vendorId: input.vendorId,
    assessmentId: input.assessmentId,
  });

  // Step 4: Review the vendor responses
  const review = await reviewResponses({
    tenantId: input.tenantId,
    assessmentId: input.assessmentId,
    responses: response.answers,
  });

  // Step 5: Score the vendor based on review
  const scoring = await scoreVendor({
    tenantId: input.tenantId,
    vendorId: input.vendorId,
    assessmentId: input.assessmentId,
    reviewResult: review,
  });

  return { status: 'completed', score: scoring.score };
}
