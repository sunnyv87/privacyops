import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/breach.activities';

const {
  assessBreachScope,
  prepareNotification,
  notifyRegulator,
  notifyDataSubjects,
  notifyInternalTeam,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 3 },
});

interface BreachInput {
  incidentId: string;
  tenantId: string;
  severity: string;
  deadlineIso: string;
}

export async function breachNotificationWorkflow(input: BreachInput): Promise<{
  notified: boolean;
}> {
  // Step 1: Assess breach scope
  const scope = await assessBreachScope({
    tenantId: input.tenantId,
    incidentId: input.incidentId,
  });

  // Step 2: Notify internal team immediately
  await notifyInternalTeam({
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    severity: input.severity,
    scope,
  });

  // Step 3: Prepare regulatory notification
  const notification = await prepareNotification({
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    scope,
  });

  // Step 4: Submit to regulators before deadline
  await notifyRegulator({
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    notification,
  });

  // Step 5: Notify affected data subjects if required
  if (scope.affectedCount > 0 && scope.requiresSubjectNotification) {
    await notifyDataSubjects({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      affectedCount: scope.affectedCount,
    });
  }

  return { notified: true };
}
