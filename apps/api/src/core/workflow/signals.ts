/**
 * Shared Temporal signal definitions.
 *
 * Signals let external services unblock a running workflow that is
 * waiting on a human-in-the-loop decision (DPIA review, vendor
 * questionnaire submission, remediation approval).
 *
 * Adding a signal is non-destructive: workflows that don't wire the
 * handler continue to work as before. Workflows that do wire the
 * handler expose a new interaction surface; the sender must call
 * `temporal.client.workflow.getHandle(id).signal(signalDef, payload)`.
 */
import { defineSignal } from '@temporalio/workflow';

export interface DecisionSignalPayload {
  decision: 'approved' | 'rejected';
  comments?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface VendorResponseSignalPayload {
  answers: Record<string, unknown>;
  submittedBy?: string;
  submittedAt?: string;
}

export const dpiaDecisionSignal = defineSignal<[DecisionSignalPayload]>(
  'dpiaDecision',
);
export const remediationApprovalSignal = defineSignal<[DecisionSignalPayload]>(
  'remediationApproval',
);
export const vendorResponseSignal = defineSignal<[VendorResponseSignalPayload]>(
  'vendorResponse',
);

export const SIGNAL_NAMES = {
  DPIA_DECISION: 'dpiaDecision',
  REMEDIATION_APPROVAL: 'remediationApproval',
  VENDOR_RESPONSE: 'vendorResponse',
} as const;
