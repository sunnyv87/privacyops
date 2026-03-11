import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class PredictiveRiskService {
  private readonly logger = new Logger(PredictiveRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async generateForecasts(tenantId: string) {
    this.logger.log(`Generating all forecasts for tenant ${tenantId}`);

    const [shadowData, vendorExposure, accessRisk, governanceGaps] =
      await Promise.all([
        this.forecastShadowDataGrowth(tenantId),
        this.forecastVendorExposure(tenantId),
        this.forecastAccessRisk(tenantId),
        this.forecastGovernanceGaps(tenantId),
      ]);

    const summary = {
      shadowData,
      vendorExposure,
      accessRisk,
      governanceGaps,
      generatedAt: new Date(),
    };

    await this.events.publish({
      type: 'predictive.forecasts.generated',
      tenantId,
      data: summary,
      timestamp: new Date(),
    });

    return summary;
  }

  async forecastShadowDataGrowth(tenantId: string) {
    // Count ShadowDataAlert by month for last 6 months
    const monthlyCounts = await this.getMonthlyAlertCounts(tenantId);

    const forecasts = await this.createTimeHorizonForecasts(
      tenantId,
      'shadow_data_growth',
      monthlyCounts,
      {
        riskFactors: [
          { factor: 'shadow_data_proliferation', description: 'Unmanaged data copies growing' },
          { factor: 'saas_sprawl', description: 'New SaaS services storing data' },
        ],
        recommendations: [
          'Implement automated shadow data discovery scanning',
          'Enforce data governance policies across all storage locations',
          'Set up alerts for new unmanaged data stores',
        ],
      },
    );

    return { forecastsCreated: forecasts };
  }

  async forecastVendorExposure(tenantId: string) {
    // Count high-risk VendorAssessments trends
    const monthlyCounts = await this.getMonthlyVendorRiskCounts(tenantId);

    const forecasts = await this.createTimeHorizonForecasts(
      tenantId,
      'vendor_exposure',
      monthlyCounts,
      {
        riskFactors: [
          { factor: 'high_risk_vendors', description: 'Vendors with elevated risk scores' },
          { factor: 'assessment_gaps', description: 'Vendors with overdue assessments' },
        ],
        recommendations: [
          'Prioritize reassessment of high-risk vendors',
          'Implement continuous vendor monitoring',
          'Review vendor data sharing agreements',
        ],
      },
    );

    return { forecastsCreated: forecasts };
  }

  async forecastAccessRisk(tenantId: string) {
    // Count excessive/inactive IdentityAccessMappings trends
    const monthlyCounts = await this.getMonthlyAccessRiskCounts(tenantId);

    const forecasts = await this.createTimeHorizonForecasts(
      tenantId,
      'access_risk',
      monthlyCounts,
      {
        riskFactors: [
          { factor: 'excessive_permissions', description: 'Identities with over-provisioned access' },
          { factor: 'inactive_access', description: 'Unused access grants accumulating' },
        ],
        recommendations: [
          'Conduct access reviews for excessive permissions',
          'Implement automated access revocation for inactive accounts',
          'Enforce least-privilege access policies',
        ],
      },
    );

    return { forecastsCreated: forecasts };
  }

  async forecastGovernanceGaps(tenantId: string) {
    // Count ControlGaps identified vs closed trends
    const monthlyCounts = await this.getMonthlyGovernanceGapCounts(tenantId);

    const forecasts = await this.createTimeHorizonForecasts(
      tenantId,
      'governance_gap',
      monthlyCounts,
      {
        riskFactors: [
          { factor: 'open_control_gaps', description: 'Control gaps remaining unaddressed' },
          { factor: 'remediation_velocity', description: 'Rate of gap closure vs discovery' },
        ],
        recommendations: [
          'Accelerate control gap remediation efforts',
          'Assign ownership for all open control gaps',
          'Implement automated compliance monitoring',
        ],
      },
    );

    return { forecastsCreated: forecasts };
  }

  async getForecasts(
    tenantId: string,
    filters: {
      forecastType?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, forecastType } = filters;

    const where: any = {
      tenantId,
      expiresAt: { gt: new Date() },
      ...(forecastType && { forecastType }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.riskForecast.findMany({
        where,
        orderBy: [{ generatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.riskForecast.count({ where }),
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

  // --- Private helpers ---

  private async getMonthlyAlertCounts(tenantId: string): Promise<number[]> {
    const counts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const count = await this.prisma.shadowDataAlert.count({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
        },
      });
      counts.push(count);
    }
    return counts;
  }

  private async getMonthlyVendorRiskCounts(tenantId: string): Promise<number[]> {
    const counts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const count = await this.prisma.vendorAssessment.count({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
          riskScore: { gte: 70 },
        },
      });
      counts.push(count);
    }
    return counts;
  }

  private async getMonthlyAccessRiskCounts(tenantId: string): Promise<number[]> {
    const counts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const count = await this.prisma.identityAccessMapping.count({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
          OR: [{ isExcessive: true }, { isInactive: true }],
        },
      });
      counts.push(count);
    }
    return counts;
  }

  private async getMonthlyGovernanceGapCounts(tenantId: string): Promise<number[]> {
    const counts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const count = await this.prisma.controlGap.count({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
          status: { in: ['identified', 'planned', 'in_progress'] },
        },
      });
      counts.push(count);
    }
    return counts;
  }

  private async createTimeHorizonForecasts(
    tenantId: string,
    forecastType: string,
    monthlyCounts: number[],
    meta: {
      riskFactors: Record<string, unknown>[];
      recommendations: string[];
    },
  ): Promise<number> {
    const n = monthlyCounts.length;
    const currentValue = monthlyCounts[n - 1] || 0;

    // Calculate linear regression slope
    const xMean = (n - 1) / 2;
    const yMean = monthlyCounts.reduce((s, v) => s + v, 0) / n;

    let slope = 0;
    if (n > 1) {
      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (monthlyCounts[i] - yMean);
        denominator += (i - xMean) * (i - xMean);
      }
      slope = denominator !== 0 ? numerator / denominator : 0;
    }

    // Determine trend type
    const trend =
      slope > 1
        ? 'accelerating'
        : slope > 0.1
          ? 'linear'
          : slope < -0.1
            ? 'decelerating'
            : 'stable';

    // Confidence based on data consistency
    const variance =
      monthlyCounts.reduce((s, v) => s + (v - yMean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = yMean !== 0 ? stdDev / yMean : 1;
    const confidence = Math.min(0.95, Math.max(0.3, 0.9 - cv * 0.3));

    const horizons = [
      { label: '30d', days: 30, months: 1 },
      { label: '60d', days: 60, months: 2 },
      { label: '90d', days: 90, months: 3 },
    ];

    let created = 0;

    for (const horizon of horizons) {
      const forecastedValue = Math.max(
        0,
        currentValue + slope * horizon.months,
      );

      await this.prisma.riskForecast.create({
        data: {
          tenantId,
          forecastType,
          timeHorizon: horizon.label,
          currentValue,
          forecastedValue,
          confidence,
          trend,
          riskFactors: meta.riskFactors,
          recommendations: meta.recommendations,
          expiresAt: new Date(
            Date.now() + horizon.days * 24 * 60 * 60 * 1000,
          ),
        },
      });
      created++;
    }

    return created;
  }
}
