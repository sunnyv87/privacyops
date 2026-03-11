// Approval and remediation workflow activities — executed by Temporal workers
// Each activity is an idempotent unit of work

export async function validateAssessment(input: {
  tenantId: string;
  assessmentId: string;
}): Promise<{ valid: boolean }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function assignReviewer(input: {
  tenantId: string;
  assessmentId: string;
  reviewerId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function awaitReview(input: {
  tenantId: string;
  assessmentId: string;
  reviewerId: string;
}): Promise<{ decision: string; comments: string }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function recordDecision(input: {
  tenantId: string;
  assessmentId: string;
  decision: string;
  comments: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyOutcome(input: {
  tenantId: string;
  assessmentId: string;
  decision: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function validateFinding(input: {
  tenantId: string;
  findingId: string;
}): Promise<{ valid: boolean }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function proposeAction(input: {
  tenantId: string;
  findingId: string;
  actionType: string;
}): Promise<{ proposalId: string }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function awaitApproval(input: {
  tenantId: string;
  proposalId: string;
}): Promise<{ approved: boolean }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function executeRemediation(input: {
  tenantId: string;
  findingId: string;
  proposalId: string;
}): Promise<{ remediationId: string }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function validateResult(input: {
  tenantId: string;
  findingId: string;
  remediationId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyRemediationComplete(input: {
  tenantId: string;
  findingId: string;
  remediationId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function checkLegalHolds(input: {
  tenantId: string;
  assetIds: string[];
}): Promise<{ eligibleAssetIds: string[] }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function requestDeletionApproval(input: {
  tenantId: string;
  policyId: string;
  assetIds: string[];
}): Promise<{ approved: boolean }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function executeDisposal(input: {
  tenantId: string;
  policyId: string;
  assetIds: string[];
}): Promise<{ deletedAssetIds: string[] }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function generateCertificate(input: {
  tenantId: string;
  policyId: string;
  deletedAssetIds: string[];
}): Promise<{ certificateId: string }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyDeletionComplete(input: {
  tenantId: string;
  policyId: string;
  certificateId: string;
  deletedCount: number;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
