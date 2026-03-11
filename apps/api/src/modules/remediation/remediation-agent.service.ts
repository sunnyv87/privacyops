import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class RemediationAgentService {
  private readonly logger = new Logger(RemediationAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async analyzeFinding(tenantId: string, findingId: string, userId: string) {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: findingId, tenantId, deletedAt: null },
      include: {
        asset: {
          include: {
            classifications: true,
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException(`Risk finding ${findingId} not found`);
    }

    const steps = this.generateSteps(finding);

    const affectedMappings = await this.prisma.identityAccessMapping.count({
      where: { tenantId, assetId: finding.assetId },
    });

    const plan = await this.prisma.remediationPlan.create({
      data: {
        tenantId,
        findingId,
        status: 'draft',
        steps,
        riskAssessment: {
          severity: finding.severity,
          category: finding.category,
          source: finding.source,
        },
        estimatedImpact: {
          affectedMappings,
          assetId: finding.assetId,
          assetName: finding.asset?.name,
        },
        confidence: this.calculateConfidence(finding),
        createdBy: userId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'remediation.plan.generated',
      entityType: 'remediation_plan',
      entityId: plan.id,
      changes: {
        after: {
          findingId,
          stepsCount: steps.length,
          status: 'draft',
        },
      },
    });

    await this.events.publish({
      type: 'remediation.plan.generated',
      tenantId,
      data: { planId: plan.id, findingId, stepsCount: steps.length },
      timestamp: new Date(),
    });

    this.logger.log(`Remediation plan ${plan.id} generated for finding ${findingId}`);

    return plan;
  }

  validatePlanSafety(plan: any) {
    const steps = (plan.steps || []) as Array<{ actionType: string; order: number; risk: string }>;
    const warnings: string[] = [];

    const safetyScores: Record<string, number> = {
      delete_data: 0.3,
      mask_data: 0.5,
      quarantine: 0.7,
      encrypt: 0.9,
    };

    let totalScore = 0;
    let stepCount = 0;

    for (const step of steps) {
      const score = safetyScores[step.actionType] ?? 0.8;
      totalScore += score;
      stepCount++;

      if (score < 0.5) {
        warnings.push(`Step ${step.order}: '${step.actionType}' is a destructive action (safety score: ${score})`);
      }
    }

    const safetyScore = stepCount > 0 ? totalScore / stepCount : 1;
    const safe = safetyScore >= 0.5 && warnings.length === 0;

    return { safe, safetyScore, warnings };
  }

  async approvePlan(tenantId: string, planId: string, userId: string) {
    const plan = await this.prisma.remediationPlan.findFirst({
      where: { id: planId, tenantId },
    });

    if (!plan) {
      throw new NotFoundException(`Remediation plan ${planId} not found`);
    }

    const updated = await this.prisma.remediationPlan.update({
      where: { id: planId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'remediation.plan.approved',
      entityType: 'remediation_plan',
      entityId: planId,
      changes: {
        before: { status: plan.status },
        after: { status: 'approved' },
      },
    });

    return updated;
  }

  async executePlan(tenantId: string, planId: string, userId: string) {
    const plan = await this.prisma.remediationPlan.findFirst({
      where: { id: planId, tenantId },
    });

    if (!plan) {
      throw new NotFoundException(`Remediation plan ${planId} not found`);
    }

    await this.prisma.remediationPlan.update({
      where: { id: planId },
      data: { status: 'executing' },
    });

    const steps = (plan.steps || []) as Array<{ order: number; actionType: string; risk: string }>;
    const executionLog: Array<{ step: number; actionType: string; status: string; actionId?: string; error?: string }> = [];
    let allSucceeded = true;

    for (const step of steps) {
      try {
        const action = await this.prisma.remediationAction.create({
          data: {
            tenantId,
            findingId: plan.findingId,
            actionType: step.actionType,
            status: 'completed',
            proposedBy: userId,
            aiGenerated: true,
            planId,
            executedAt: new Date(),
            completedAt: new Date(),
            rollbackData: {},
          },
        });

        executionLog.push({
          step: step.order,
          actionType: step.actionType,
          status: 'completed',
          actionId: action.id,
        });
      } catch (error) {
        allSucceeded = false;
        executionLog.push({
          step: step.order,
          actionType: step.actionType,
          status: 'failed',
          error: error.message,
        });

        this.logger.error(`Plan ${planId} step ${step.order} failed: ${error.message}`);
        break;
      }
    }

    const finalStatus = allSucceeded ? 'completed' : 'failed';

    const updated = await this.prisma.remediationPlan.update({
      where: { id: planId },
      data: {
        status: finalStatus,
        executionLog,
        completedAt: allSucceeded ? new Date() : undefined,
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: `remediation.plan.${finalStatus}`,
      entityType: 'remediation_plan',
      entityId: planId,
      changes: {
        after: { status: finalStatus, executionLog },
      },
    });

    await this.events.publish({
      type: `remediation.plan.${finalStatus}`,
      tenantId,
      data: { planId, status: finalStatus, executionLog },
      timestamp: new Date(),
    });

    return updated;
  }

  async getPlans(tenantId: string, filters: { findingId?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const { page = 1, pageSize = 20, status, findingId } = filters;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(findingId && { findingId }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.remediationPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.remediationPlan.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getPlanById(tenantId: string, id: string) {
    const plan = await this.prisma.remediationPlan.findFirst({
      where: { id, tenantId },
    });

    if (!plan) {
      throw new NotFoundException(`Remediation plan ${id} not found`);
    }

    return plan;
  }

  async bulkAnalyze(tenantId: string, findingIds: string[], userId: string) {
    const plans = [];

    for (const findingId of findingIds) {
      const plan = await this.analyzeFinding(tenantId, findingId, userId);
      plans.push(plan);
    }

    return plans;
  }

  private generateSteps(finding: any): Array<{ order: number; actionType: string; risk: string }> {
    const severity = finding.severity;
    const source = (finding.source || '').toLowerCase();
    const category = (finding.category || '').toLowerCase();

    if (severity === 'critical' && (source.includes('public') || category.includes('public'))) {
      return [
        { order: 1, actionType: 'restrict_public', risk: 'low' },
        { order: 2, actionType: 'revoke_access', risk: 'medium' },
      ];
    }

    if (category.includes('encryption') || source.includes('encryption') || category.includes('unencrypted')) {
      return [
        { order: 1, actionType: 'encrypt', risk: 'low' },
      ];
    }

    if (category.includes('excessive') || source.includes('excessive') || category.includes('over-privileged')) {
      return [
        { order: 1, actionType: 'revoke_access', risk: 'medium' },
        { order: 2, actionType: 'enable_mfa', risk: 'low' },
      ];
    }

    return [
      { order: 1, actionType: 'quarantine', risk: 'low' },
    ];
  }

  private calculateConfidence(finding: any): number {
    let confidence = 0.7;

    if (finding.severity === 'critical' || finding.severity === 'high') {
      confidence += 0.1;
    }

    if (finding.asset?.classifications?.length > 0) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }
}
