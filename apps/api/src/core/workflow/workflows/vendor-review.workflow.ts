import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities/vendor.activities';
import { vendorResponseSignal, VendorResponseSignalPayload } from '../signals';

const {
  prepareAssessment,
  sendQuestionnaire,
  awaitVendorResponse,
  reviewResponses,
  scoreVendor,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  scheduleToCloseTimeout: '2 hours',
  heartbeatTimeout: '5 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

const VENDOR_RESPONSE_SIGNAL_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  // Signal handler for vendor response submission
  let signalPayload: VendorResponseSignalPayload | null = null;
  setHandler(vendorResponseSignal, (p) => {
    signalPayload = p;
  });

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

  // Step 3: Await vendor response — prefer signal, fall back to DB poll.
  const gotSignal = await condition(
    () => signalPayload !== null,
    VENDOR_RESPONSE_SIGNAL_TIMEOUT_MS,
  );
  let response: { answers: Record<string, unknown> };
  if (gotSignal && signalPayload) {
    const sp = signalPayload as VendorResponseSignalPayload;
    response = { answers: sp.answers };
  } else {
    response = await awaitVendorResponse({
      tenantId: input.tenantId,
      vendorId: input.vendorId,
      assessmentId: input.assessmentId,
    });
  }

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
