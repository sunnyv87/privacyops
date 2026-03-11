// Vendor review workflow activities — executed by Temporal workers
// Each activity is an idempotent unit of work

export async function prepareAssessment(input: {
  tenantId: string;
  vendorId: string;
  assessmentId: string;
}): Promise<{ templateId: string }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function sendQuestionnaire(input: {
  tenantId: string;
  vendorId: string;
  assessmentId: string;
  dueDate: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function awaitVendorResponse(input: {
  tenantId: string;
  vendorId: string;
  assessmentId: string;
}): Promise<{ answers: Record<string, unknown> }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function reviewResponses(input: {
  tenantId: string;
  assessmentId: string;
  responses: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function scoreVendor(input: {
  tenantId: string;
  vendorId: string;
  assessmentId: string;
  reviewResult: Record<string, unknown>;
}): Promise<{ score: number }> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
