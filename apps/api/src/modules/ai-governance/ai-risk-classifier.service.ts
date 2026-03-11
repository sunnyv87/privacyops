import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class AiRiskClassifierService {
  private readonly logger = new Logger(AiRiskClassifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async classifyRisk(tenantId: string, aiSystemId: string) {
    const system = await this.prisma.aiSystem.findFirst({
      where: { id: aiSystemId, tenantId },
      include: {
        datasetUsages: true,
      },
    });

    if (!system) {
      throw new NotFoundException(`AI system ${aiSystemId} not found`);
    }

    const riskCategory = this.determineRiskCategory(system);

    // Count PII datasets for data protection impact
    const datasetIds = system.datasetUsages.map((u) => u.datasetId);
    let piiDatasetCount = 0;

    if (datasetIds.length > 0) {
      piiDatasetCount = await this.prisma.asset.count({
        where: {
          id: { in: datasetIds },
          tenantId,
          classifications: {
            some: {
              sensitivity: { gte: 3 },
            },
          },
        },
      });
    }

    const riskFactors = this.buildRiskFactors(system, riskCategory);
    const regulatoryMapping = this.buildRegulatoryMapping(riskCategory, system);
    const recommendations = this.buildRecommendations(riskCategory);

    const assessment = await this.prisma.aiRiskAssessment.create({
      data: {
        tenantId,
        aiSystemId,
        riskCategory,
        riskFactors,
        regulatoryMapping,
        dataProtectionImpact: {
          piiDatasets: piiDatasetCount,
          totalDatasets: datasetIds.length,
        },
        recommendations,
      },
    });

    // Update the AI system's risk category
    await this.prisma.aiSystem.update({
      where: { id: aiSystemId },
      data: {
        riskCategory,
        lastRiskAssessment: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'ai_governance.risk.assessed',
      entityType: 'ai_risk_assessment',
      entityId: assessment.id,
      changes: {
        after: {
          aiSystemId,
          riskCategory,
          piiDatasets: piiDatasetCount,
        },
      },
    });

    await this.events.publish({
      type: 'ai_governance.risk.assessed',
      tenantId,
      data: {
        assessmentId: assessment.id,
        aiSystemId,
        riskCategory,
      },
      timestamp: new Date(),
    });

    this.logger.log(`AI system ${aiSystemId} classified as ${riskCategory} risk`);

    return assessment;
  }

  async getRiskAssessments(tenantId: string, filters: { aiSystemId?: string; riskCategory?: string; page?: number; pageSize?: number } = {}) {
    const { page = 1, pageSize = 20, aiSystemId, riskCategory } = filters;

    const where: any = {
      tenantId,
      ...(aiSystemId && { aiSystemId }),
      ...(riskCategory && { riskCategory }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.aiRiskAssessment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiRiskAssessment.count({ where }),
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

  async getRegulatoryMap(tenantId: string) {
    const systems = await this.prisma.aiSystem.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        riskCategory: true,
        purpose: true,
        regulatoryBasis: true,
        status: true,
      },
    });

    const byRiskCategory: Record<string, any[]> = {
      unacceptable: [],
      high: [],
      limited: [],
      minimal: [],
    };

    for (const system of systems) {
      const category = system.riskCategory || 'minimal';
      if (!byRiskCategory[category]) {
        byRiskCategory[category] = [];
      }

      byRiskCategory[category].push({
        id: system.id,
        name: system.name,
        purpose: system.purpose,
        status: system.status,
        regulatoryBasis: system.regulatoryBasis,
        regulations: {
          euAiAct: this.getEuAiActRequirements(category),
          gdpr: this.getGdprRequirements(category),
        },
      });
    }

    return {
      byRiskCategory,
      totalSystems: systems.length,
      summary: {
        unacceptable: byRiskCategory.unacceptable.length,
        high: byRiskCategory.high.length,
        limited: byRiskCategory.limited.length,
        minimal: byRiskCategory.minimal.length,
      },
    };
  }

  private determineRiskCategory(system: any): string {
    const purpose = (system.purpose || '').toLowerCase();
    const name = (system.name || '').toLowerCase();
    const description = (system.description || '').toLowerCase();
    const combined = `${purpose} ${name} ${description}`;

    if (combined.includes('biometric') || combined.includes('surveillance')) {
      return 'unacceptable';
    }

    if (
      combined.includes('employment') ||
      combined.includes('education') ||
      combined.includes('credit') ||
      combined.includes('law')
    ) {
      return 'high';
    }

    if (combined.includes('chatbot') || combined.includes('content-generation')) {
      return 'limited';
    }

    return 'minimal';
  }

  private buildRiskFactors(system: any, riskCategory: string): any {
    const factors: any[] = [];

    if (riskCategory === 'unacceptable') {
      factors.push({ factor: 'Involves biometric or surveillance capabilities', severity: 'critical' });
    }

    if (riskCategory === 'high') {
      factors.push({ factor: 'Used in high-impact decision making domain', severity: 'high' });
    }

    if (system.datasetUsages?.length > 0) {
      factors.push({ factor: `Uses ${system.datasetUsages.length} datasets`, severity: 'medium' });
    }

    if (!system.regulatoryBasis || (system.regulatoryBasis as string[]).length === 0) {
      factors.push({ factor: 'No regulatory basis documented', severity: 'medium' });
    }

    return factors;
  }

  private buildRegulatoryMapping(riskCategory: string, system: any): any {
    return {
      euAiAct: {
        riskCategory,
        requirements: this.getEuAiActRequirements(riskCategory),
      },
      gdpr: {
        applicable: true,
        requirements: this.getGdprRequirements(riskCategory),
      },
    };
  }

  private getEuAiActRequirements(riskCategory: string): string[] {
    switch (riskCategory) {
      case 'unacceptable':
        return ['Prohibited - must be decommissioned or re-scoped'];
      case 'high':
        return [
          'Risk management system required',
          'Data governance measures required',
          'Technical documentation required',
          'Record keeping required',
          'Transparency and user information required',
          'Human oversight measures required',
          'Accuracy, robustness, and cybersecurity required',
        ];
      case 'limited':
        return ['Transparency obligations - users must be informed of AI interaction'];
      case 'minimal':
        return ['Voluntary codes of conduct recommended'];
      default:
        return [];
    }
  }

  private getGdprRequirements(riskCategory: string): string[] {
    const base = [
      'Lawful basis for processing',
      'Data minimization',
      'Purpose limitation',
    ];

    if (riskCategory === 'high' || riskCategory === 'unacceptable') {
      return [
        ...base,
        'Data Protection Impact Assessment (DPIA) required',
        'Automated decision-making safeguards (Art. 22)',
        'Right to explanation',
      ];
    }

    return base;
  }

  private buildRecommendations(riskCategory: string): string[] {
    switch (riskCategory) {
      case 'unacceptable':
        return [
          'Immediately review system scope and purpose',
          'Consider decommissioning or re-scoping to lower risk category',
          'Conduct urgent legal review',
        ];
      case 'high':
        return [
          'Implement comprehensive risk management system',
          'Conduct Data Protection Impact Assessment',
          'Establish human oversight mechanisms',
          'Document technical specifications and training data',
          'Implement bias testing and monitoring',
        ];
      case 'limited':
        return [
          'Implement transparency measures for users',
          'Document AI interaction disclosure mechanisms',
        ];
      case 'minimal':
        return [
          'Consider adopting voluntary code of conduct',
          'Monitor for scope changes that may increase risk category',
        ];
      default:
        return [];
    }
  }
}
