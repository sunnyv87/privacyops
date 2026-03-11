// Breach notification workflow activities

export async function assessBreachScope(input: {
  tenantId: string;
  incidentId: string;
}): Promise<{
  affectedCount: number;
  dataCategories: string[];
  requiresSubjectNotification: boolean;
}> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyInternalTeam(input: {
  tenantId: string;
  incidentId: string;
  severity: string;
  scope: Record<string, unknown>;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function prepareNotification(input: {
  tenantId: string;
  incidentId: string;
  scope: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyRegulator(input: {
  tenantId: string;
  incidentId: string;
  notification: Record<string, unknown>;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}

export async function notifyDataSubjects(input: {
  tenantId: string;
  incidentId: string;
  affectedCount: number;
}): Promise<void> {
  throw new Error('Activity must be registered with NestJS DI container via worker bootstrap');
}
