import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class ComplianceAdvisorService {
  private readonly logger = new Logger(ComplianceAdvisorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Ask Compliance Question
  // ---------------------------------------------------------------------------

  async askComplianceQuestion(tenantId: string, question: string) {
    const keywords = question.toLowerCase().split(/\s+/);

    // Determine context from keywords
    const regulationKeywords: Record<string, string[]> = {
      gdpr: ['gdpr', 'data protection', 'eu', 'european', 'dpa', 'right to erasure', 'consent'],
      hipaa: ['hipaa', 'health', 'phi', 'medical', 'healthcare'],
      ccpa: ['ccpa', 'california', 'consumer', 'cpra'],
      'pci-dss': ['pci', 'payment', 'card', 'cardholder'],
      sox: ['sox', 'sarbanes', 'financial reporting'],
    };

    const matchedRegulationKeys: string[] = [];
    for (const [key, terms] of Object.entries(regulationKeywords)) {
      if (terms.some((term) => keywords.some((kw) => term.includes(kw) || kw.includes(term)))) {
        matchedRegulationKeys.push(key);
      }
    }

    // Query relevant regulations
    const regulations = await this.prisma.regulation.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null },
        ],
        ...(matchedRegulationKeys.length > 0 && {
          shortName: {
            in: matchedRegulationKeys,
            mode: 'insensitive',
          },
        }),
      },
      include: {
        obligations: true,
      },
      take: 10,
    });

    // Query relevant controls
    const controls = await this.prisma.control.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      take: 20,
    });

    // Build citations from matched regulations
    const citations = regulations.map((reg) => ({
      regulationId: reg.id,
      regulationName: reg.shortName || reg.name,
      obligationCount: reg.obligations.length,
    }));

    // Generate advice text summarizing relevant regulations/controls
    const regulationSummary = regulations.length > 0
      ? `Based on ${regulations.length} relevant regulation(s): ${regulations.map((r) => r.shortName || r.name).join(', ')}.`
      : 'No specific regulations matched your question.';

    const controlSummary = controls.length > 0
      ? ` There are ${controls.length} controls that may be relevant to your inquiry.`
      : '';

    const adviceText = `${regulationSummary}${controlSummary} Question analyzed: "${question}". Keywords identified: ${matchedRegulationKeys.length > 0 ? matchedRegulationKeys.join(', ') : 'general compliance'}.`;

    const advice = await this.prisma.complianceAdvice.create({
      data: {
        tenantId,
        adviceType: 'interpretation',
        question,
        advice: adviceText,
        citations,
        regulationId: regulations.length > 0 ? regulations[0].id : null,
        confidence: regulations.length > 0 ? 0.85 : 0.50,
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'compliance.advice_generated',
      entityType: 'compliance_advice',
      entityId: advice.id,
      changes: {
        after: {
          adviceType: 'interpretation',
          question,
          matchedRegulations: matchedRegulationKeys,
        },
      },
    });

    this.logger.log(`Compliance advice generated for question: "${question.substring(0, 50)}..."`);

    return advice;
  }

  // ---------------------------------------------------------------------------
  // Advise Gap Remediation
  // ---------------------------------------------------------------------------

  async adviseGapRemediation(tenantId: string, gapId: string) {
    const gap = await this.prisma.controlGap.findFirst({
      where: { id: gapId, tenantId },
    });

    if (!gap) {
      throw new NotFoundException(`Control gap ${gapId} not found`);
    }

    // Query related regulation and obligation
    let regulation = null;
    let obligation = null;

    if (gap.regulationId) {
      regulation = await this.prisma.regulation.findUnique({
        where: { id: gap.regulationId },
      });
    }

    if (gap.obligationId) {
      obligation = await this.prisma.obligation.findUnique({
        where: { id: gap.obligationId },
      });
    }

    // Generate remediation advice based on severity and obligation requirements
    const severityGuidance: Record<string, string> = {
      critical: 'Immediate action required. This gap poses a critical compliance risk and must be addressed within 24 hours.',
      high: 'Urgent remediation needed. This gap should be addressed within 1 week to maintain compliance posture.',
      medium: 'Remediation recommended within 30 days. Consider implementing controls to close this gap.',
      low: 'Address during next compliance review cycle. Monitor for any escalation in risk.',
    };

    const severity = (gap.severity as string) || 'medium';
    const guidanceText = severityGuidance[severity] || severityGuidance.medium;

    const obligationContext = obligation
      ? ` Obligation "${obligation.reference || obligation.title}" requires: ${obligation.description || 'compliance with stated requirements'}.`
      : '';

    const regulationContext = regulation
      ? ` Under ${regulation.shortName || regulation.name} regulation.`
      : '';

    const adviceText = `${guidanceText}${regulationContext}${obligationContext} Recommended steps: 1) Identify responsible control owner, 2) Define implementation timeline based on ${severity} severity, 3) Implement appropriate controls, 4) Collect evidence of implementation, 5) Schedule verification review.`;

    const advice = await this.prisma.complianceAdvice.create({
      data: {
        tenantId,
        adviceType: 'gap_remediation',
        question: `Gap remediation for ${gapId}`,
        advice: adviceText,
        citations: regulation ? [{ regulationId: regulation.id, regulationName: regulation.shortName || regulation.name }] : [],
        regulationId: gap.regulationId || null,
        confidence: 0.80,
        metadata: {
          gapId,
          severity,
          obligationId: gap.obligationId,
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'compliance.gap_remediation_advised',
      entityType: 'compliance_advice',
      entityId: advice.id,
      changes: {
        after: {
          gapId,
          severity,
          adviceType: 'gap_remediation',
        },
      },
    });

    this.logger.log(`Gap remediation advice generated for gap ${gapId}`);

    return advice;
  }

  // ---------------------------------------------------------------------------
  // Generate Control Mappings
  // ---------------------------------------------------------------------------

  async generateControlMappings(
    tenantId: string,
    sourceFramework: string,
    targetFramework: string,
  ) {
    // Query controls from both frameworks
    const sourceControls = await this.prisma.control.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        category: sourceFramework,
      },
    });

    const targetControls = await this.prisma.control.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        category: targetFramework,
      },
    });

    const mappings: any[] = [];

    for (const source of sourceControls) {
      for (const target of targetControls) {
        let confidence = 0;
        let matchType = '';

        // Exact code match
        if (
          source.code &&
          target.code &&
          source.code.toLowerCase() === target.code.toLowerCase()
        ) {
          confidence = 0.95;
          matchType = 'exact_code';
        }
        // Partial code match (shared prefix or suffix)
        else if (
          source.code &&
          target.code &&
          (source.code.toLowerCase().includes(target.code.toLowerCase()) ||
            target.code.toLowerCase().includes(source.code.toLowerCase()))
        ) {
          confidence = 0.70;
          matchType = 'partial_code';
        }
        // Description similarity (simple keyword overlap)
        else if (source.description && target.description) {
          const sourceWords = new Set(
            source.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
          );
          const targetWords = new Set(
            target.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
          );
          const overlap = [...sourceWords].filter((w) => targetWords.has(w)).length;
          const totalUnique = new Set([...sourceWords, ...targetWords]).size;

          if (totalUnique > 0 && overlap / totalUnique > 0.3) {
            confidence = 0.50;
            matchType = 'related_description';
          }
        }

        if (confidence > 0) {
          mappings.push({
            tenantId,
            sourceControlId: source.id,
            targetControlId: target.id,
            sourceFramework,
            targetFramework,
            confidence,
            matchType,
          });
        }
      }
    }

    // Create ControlMapping records
    let created = 0;
    if (mappings.length > 0) {
      const result = await this.prisma.controlMapping.createMany({
        data: mappings,
        skipDuplicates: true,
      });
      created = result.count;
    }

    await this.audit.log({
      tenantId,
      actorId: 'system',
      actorType: 'system',
      action: 'compliance.control_mappings_generated',
      entityType: 'control_mapping',
      entityId: 'bulk',
      changes: {
        after: {
          sourceFramework,
          targetFramework,
          mappingsCreated: created,
        },
      },
    });

    this.logger.log(
      `Generated ${created} control mappings from ${sourceFramework} to ${targetFramework}`,
    );

    return { created, mappings };
  }

  // ---------------------------------------------------------------------------
  // Get Control Mappings
  // ---------------------------------------------------------------------------

  async getControlMappings(
    tenantId: string,
    filters: { sourceFramework?: string; page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 20, sourceFramework } = filters;

    const where: any = {
      tenantId,
      ...(sourceFramework && { sourceFramework }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.controlMapping.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.controlMapping.count({ where }),
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

  // ---------------------------------------------------------------------------
  // Assess Dataset Compliance
  // ---------------------------------------------------------------------------

  async assessDatasetCompliance(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      include: {
        classifications: true,
        retentionPolicies: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    // Determine applicable regulations based on data categories
    const categoryRegulationMap: Record<string, string[]> = {
      pii: ['GDPR'],
      personal_data: ['GDPR'],
      financial: ['PCI-DSS', 'SOX'],
      payment: ['PCI-DSS'],
      health: ['HIPAA'],
      medical: ['HIPAA'],
      phi: ['HIPAA'],
    };

    const applicableRegulations = new Set<string>();
    const gaps: string[] = [];

    for (const classification of asset.classifications) {
      const category = ((classification as any).category || '').toLowerCase();
      const mapped = categoryRegulationMap[category];
      if (mapped) {
        mapped.forEach((reg) => applicableRegulations.add(reg));
      }
    }

    // Check for retention policy gaps
    if (asset.retentionPolicies.length === 0 && applicableRegulations.size > 0) {
      gaps.push('No retention policy defined for regulated data');
    }

    // Check for encryption (from metadata)
    const metadata = (asset.metadata as Record<string, any>) || {};
    if (applicableRegulations.size > 0 && !metadata.encryptionStatus) {
      gaps.push('Encryption status not verified for regulated data');
    }

    const assessment = {
      assetId,
      assetName: asset.name,
      classificationsCount: asset.classifications.length,
      applicableRegulations: Array.from(applicableRegulations),
      retentionPoliciesCount: asset.retentionPolicies.length,
      gaps,
      compliant: gaps.length === 0,
      assessedAt: new Date().toISOString(),
    };

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'compliance.dataset_assessed',
      entityType: 'asset',
      entityId: assetId,
      changes: {
        after: {
          applicableRegulations: Array.from(applicableRegulations),
          gapsFound: gaps.length,
          compliant: gaps.length === 0,
        },
      },
    });

    this.logger.log(`Dataset compliance assessment completed for asset ${assetId}`);

    return assessment;
  }

  // ---------------------------------------------------------------------------
  // Get Advice History
  // ---------------------------------------------------------------------------

  async getAdviceHistory(
    tenantId: string,
    filters: { adviceType?: string; regulationId?: string; page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 20, adviceType, regulationId } = filters;

    const where: any = {
      tenantId,
      ...(adviceType && { adviceType }),
      ...(regulationId && { regulationId }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.complianceAdvice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.complianceAdvice.count({ where }),
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
}
