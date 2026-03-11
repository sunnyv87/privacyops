// DSAR workflow activities — executed by Temporal workers

export async function verifyIdentity(input: {
  tenantId: string;
  requestId: string;
}): Promise<boolean> {
  // In production: send verification email/SMS, wait for confirmation
  // Stub: auto-verify
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function collectData(input: {
  tenantId: string;
  requestId: string;
  type: string;
}): Promise<Record<string, unknown>> {
  // Queries all connected data sources for data subject's data
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function generateResponse(input: {
  tenantId: string;
  requestId: string;
  type: string;
  data: Record<string, unknown>;
}): Promise<string> {
  // Generates response package (PDF/ZIP) and uploads to S3
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyCompletion(input: {
  tenantId: string;
  requestId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyOverdue(input: {
  tenantId: string;
  requestId: string;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
