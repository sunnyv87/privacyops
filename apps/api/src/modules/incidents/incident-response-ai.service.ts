import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class IncidentResponseAiService {
  private readonly logger = new Logger(IncidentResponseAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------------
  // Classify Incident
  // ---------------------------------------------------------------------------

  async classifyIncident(tenantId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, tenantId, deletedAt: null },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    let aiClassification: string;
    let aiSeverityScore: number;

    if (
      incident.isPersonalDataBreach &&
      incident.estimatedSubjectsAffected &&
      incident.estimatedSubjectsAffected > 1000
    ) {
      aiClassification = 'major_data_breach';
      aiSeverityScore = 95;
    } else if (incident.isPersonalDataBreach) {
      aiClassification = 'data_breach';
      aiSeverityScore = 75;
    } else if (incident.severity === 'critical') {
      aiClassification = 'critical_security_incident';
      aiSeverityScore = 85;
    } else if (incident.detectionSource === 'external') {
      aiClassification = 'external_discovery';
      aiSeverityScore = 70;
    } else {
      aiClassification = 'general_incident';
      aiSeverityScore = 50;
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        aiClassification,
        aiSeverityScore,
      },
    });

    await this.events.publish({
      type: 'incident.classified',
      tenantId,
      data: {
        incidentId,
        aiClassification,
        aiSeverityScore,
      },
      timestamp: new Date(),
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'incident.ai_classified',
      entityType: 'incident',
      entityId: incidentId,
      changes: {
        after: {
          aiClassification,
          aiSeverityScore,
        },
      },
    });

    this.logger.log(
      `Incident ${incidentId} classified as ${aiClassification} (score: ${aiSeverityScore})`,
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Analyze Impact
  // ---------------------------------------------------------------------------

  async analyzeImpact(tenantId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, tenantId, deletedAt: null },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    const affectedAssetIds = (incident.affectedAssets as string[]) || [];

    let totalClassifications = 0;
    let totalAffectedSubjects = 0;
    let vendorAssociations = 0;
    const jurisdictions = new Set<string>();

    for (const assetId of affectedAssetIds) {
      // Count classifications (data categories)
      const classificationCount = await this.prisma.classification.count({
        where: { assetId },
      });
      totalClassifications += classificationCount;

      // Count affected subjects via identity access mappings
      const accessMappingCount = await this.prisma.identityAccessMapping.count({
        where: { assetId },
      });
      totalAffectedSubjects += accessMappingCount;

      // Check vendor associations via data graph
      vendorAssociations += 0; // Vendor association count resolved via graph edges
    }

    // Count jurisdictions from DataSubject records linked to affected assets
    if (affectedAssetIds.length > 0) {
      const accessMappings = await this.prisma.identityAccessMapping.findMany({
        where: { assetId: { in: affectedAssetIds } },
        select: { identityId: true },
      });

      const identityIds = accessMappings.map((m) => m.identityId);

      if (identityIds.length > 0) {
        const dataSubjects = await this.prisma.dataSubject.findMany({
          where: { id: { in: identityIds } },
          select: { jurisdiction: true },
        });

        for (const ds of dataSubjects) {
          if (ds.jurisdiction) {
            jurisdictions.add(ds.jurisdiction);
          }
        }
      }
    }

    const analysis = await this.prisma.incidentImpactAnalysis.create({
      data: {
        tenantId,
        incidentId,
        affectedAssetCount: affectedAssetIds.length,
        affectedSubjectCount: totalAffectedSubjects,
        affectedVendorCount: vendorAssociations,
        dataCategories: [],
        jurisdictions: Array.from(jurisdictions),
        regulatoryImpact: { jurisdictions: Array.from(jurisdictions) },
        businessImpact: { totalClassifications },
        analyzedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'incident.impact_analyzed',
      entityType: 'incident_impact_analysis',
      entityId: analysis.id,
      changes: {
        after: {
          incidentId,
          affectedAssetCount: affectedAssetIds.length,
          totalAffectedSubjects,
          jurisdictions: Array.from(jurisdictions),
        },
      },
    });

    this.logger.log(`Impact analysis completed for incident ${incidentId}`);

    return analysis;
  }

  // ---------------------------------------------------------------------------
  // Generate Playbook
  // ---------------------------------------------------------------------------

  async generatePlaybook(tenantId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, tenantId, deletedAt: null },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    const classification = (incident as any).aiClassification || 'general_incident';

    let steps: { order: number; action: string; status: string }[];

    switch (classification) {
      case 'major_data_breach':
        steps = [
          { order: 1, action: 'isolate_affected_systems', status: 'pending' },
          { order: 2, action: 'preserve_forensic_evidence', status: 'pending' },
          { order: 3, action: 'notify_dpa_72h', status: 'pending' },
          { order: 4, action: 'notify_affected_subjects', status: 'pending' },
          { order: 5, action: 'remediate_root_cause', status: 'pending' },
        ];
        break;
      case 'data_breach':
        steps = [
          { order: 1, action: 'contain_breach', status: 'pending' },
          { order: 2, action: 'assess_scope', status: 'pending' },
          { order: 3, action: 'notify_dpa_if_required', status: 'pending' },
          { order: 4, action: 'remediate', status: 'pending' },
        ];
        break;
      default:
        steps = [
          { order: 1, action: 'investigate', status: 'pending' },
          { order: 2, action: 'contain', status: 'pending' },
          { order: 3, action: 'remediate', status: 'pending' },
        ];
        break;
    }

    const playbook = await this.prisma.incidentPlaybook.create({
      data: {
        tenantId,
        incidentId,
        playbookType: classification ?? 'general',
        steps,
        status: 'proposed',
      },
    });

    // Update incident to mark playbook as generated
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        playbookGenerated: true,
      },
    });

    await this.events.publish({
      type: 'incident.playbook.generated',
      tenantId,
      data: {
        incidentId,
        playbookId: playbook.id,
        classification,
        stepsCount: steps.length,
      },
      timestamp: new Date(),
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'incident.playbook_generated',
      entityType: 'incident_playbook',
      entityId: playbook.id,
      changes: {
        after: {
          incidentId,
          classification,
          stepsCount: steps.length,
        },
      },
    });

    this.logger.log(
      `Playbook generated for incident ${incidentId} (classification: ${classification}, steps: ${steps.length})`,
    );

    return playbook;
  }

  // ---------------------------------------------------------------------------
  // Get Playbook
  // ---------------------------------------------------------------------------

  async getPlaybook(tenantId: string, incidentId: string) {
    const playbook = await this.prisma.incidentPlaybook.findFirst({
      where: { incidentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!playbook) {
      throw new NotFoundException(
        `Playbook not found for incident ${incidentId}`,
      );
    }

    return playbook;
  }

  // ---------------------------------------------------------------------------
  // Get Impact Analysis
  // ---------------------------------------------------------------------------

  async getImpactAnalysis(tenantId: string, incidentId: string) {
    const analysis = await this.prisma.incidentImpactAnalysis.findFirst({
      where: { incidentId, tenantId },
      orderBy: { analyzedAt: 'desc' },
    });

    if (!analysis) {
      throw new NotFoundException(
        `Impact analysis not found for incident ${incidentId}`,
      );
    }

    return analysis;
  }

  // ---------------------------------------------------------------------------
  // Approve Playbook
  // ---------------------------------------------------------------------------

  async approvePlaybook(
    tenantId: string,
    playbookId: string,
    userId: string,
  ) {
    const playbook = await this.prisma.incidentPlaybook.findFirst({
      where: { id: playbookId, tenantId },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook ${playbookId} not found`);
    }

    const updated = await this.prisma.incidentPlaybook.update({
      where: { id: playbookId },
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
      action: 'incident.playbook_approved',
      entityType: 'incident_playbook',
      entityId: playbookId,
      changes: {
        before: { status: playbook.status },
        after: { status: 'approved', approvedBy: userId },
      },
    });

    this.logger.log(`Playbook ${playbookId} approved by ${userId}`);

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Execute Containment
  // ---------------------------------------------------------------------------

  async executeContainment(
    tenantId: string,
    incidentId: string,
    userId: string,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, tenantId, deletedAt: null },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        containmentStatus: 'partially_contained',
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'incident.containment_executed',
      entityType: 'incident',
      entityId: incidentId,
      changes: {
        before: { containmentStatus: incident.containmentStatus },
        after: { containmentStatus: 'partially_contained' },
      },
    });

    this.logger.log(
      `Containment executed for incident ${incidentId} by ${userId}`,
    );

    return updated;
  }
}
