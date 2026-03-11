import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

interface TriggerCondition {
  signal: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
}

interface EvaluationResult {
  triggered: boolean;
  matchedConditions: TriggerCondition[];
  signalValues: Record<string, number>;
}

@Injectable()
export class PolicyEvaluationEngine {
  private readonly logger = new Logger(PolicyEvaluationEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(tenantId: string, policy: any): Promise<EvaluationResult> {
    const triggerConditions: TriggerCondition[] = policy.triggerConditions || [];
    const signalValues = await this.collectSignals(tenantId);

    const matchedConditions: TriggerCondition[] = [];

    for (const condition of triggerConditions) {
      const signalValue = signalValues[condition.signal];
      if (signalValue === undefined) {
        this.logger.warn(`Unknown signal: ${condition.signal}`);
        continue;
      }

      const matched = this.compareValue(signalValue, condition.operator, condition.threshold);
      if (matched) {
        matchedConditions.push(condition);
      }
    }

    // Policy triggers if ALL conditions are matched
    const triggered =
      triggerConditions.length > 0 &&
      matchedConditions.length === triggerConditions.length;

    this.logger.debug(
      `Policy ${policy.id} evaluation: triggered=${triggered}, matched=${matchedConditions.length}/${triggerConditions.length}`,
    );

    return {
      triggered,
      matchedConditions,
      signalValues,
    };
  }

  async collectSignals(tenantId: string): Promise<Record<string, number>> {
    const [
      riskScoreAvg,
      excessiveAccessCount,
      openFindingsCount,
      shadowDataCount,
    ] = await Promise.all([
      this.prisma.entityRiskProfile
        .aggregate({
          where: { tenantId },
          _avg: { compositeScore: true },
        })
        .then((r) => r._avg.compositeScore || 0),

      this.prisma.identityAccessMapping.count({
        where: { tenantId, isExcessive: true },
      }),

      this.prisma.riskFinding.count({
        where: { tenantId, status: 'open' },
      }),

      this.prisma.shadowDataAlert.count({
        where: { tenantId, status: 'open' },
      }),
    ]);

    return {
      risk_score_avg: riskScoreAvg,
      excessive_access_count: excessiveAccessCount,
      open_findings_count: openFindingsCount,
      shadow_data_count: shadowDataCount,
    };
  }

  private compareValue(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        this.logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }
}
