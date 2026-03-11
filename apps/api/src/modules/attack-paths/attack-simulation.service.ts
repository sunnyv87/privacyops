import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class AttackSimulationService {
  private readonly logger = new Logger(AttackSimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async runSimulation(tenantId: string, scenarioType: string, config: any, userId: string) {
    const startTime = Date.now();

    const simulation = await this.prisma.attackSimulation.create({
      data: {
        tenantId,
        scenarioType,
        config,
        status: 'running',
        createdBy: userId,
      },
    });

    this.logger.log(`Starting ${scenarioType} simulation ${simulation.id} for tenant ${tenantId}`);

    try {
      let results: any;

      switch (scenarioType) {
        case 'identity_compromise':
          results = await this.simulateIdentityCompromise(tenantId, config.identityId);
          break;
        case 'data_exfiltration':
          results = await this.simulateDataExfiltration(tenantId, config.assetId);
          break;
        case 'privilege_escalation':
          results = await this.simulatePrivilegeEscalation(tenantId, config.identityId);
          break;
        default:
          results = { paths: [], maxRiskScore: 0 };
      }

      const executionTimeMs = Date.now() - startTime;

      // Create SimulatedAttackPath records
      for (const path of results.paths) {
        await this.prisma.simulatedAttackPath.create({
          data: {
            tenantId,
            simulationId: simulation.id,
            title: path.title,
            description: path.description,
            riskScore: path.riskScore,
            steps: path.steps,
            entryPoint: path.entryPoint,
            targetAsset: path.targetAsset,
          },
        });
      }

      const updated = await this.prisma.attackSimulation.update({
        where: { id: simulation.id },
        data: {
          status: 'completed',
          results,
          pathsFound: results.paths.length,
          maxRiskScore: results.maxRiskScore,
          executionTimeMs,
          completedAt: new Date(),
        },
      });

      await this.audit.log({
        tenantId,
        actorId: userId,
        actorType: 'user',
        action: 'attack.simulation.completed',
        entityType: 'attack_simulation',
        entityId: simulation.id,
        changes: {
          after: {
            scenarioType,
            pathsFound: results.paths.length,
            maxRiskScore: results.maxRiskScore,
            executionTimeMs,
          },
        },
      });

      await this.events.publish({
        type: 'attack.simulation.completed',
        tenantId,
        data: {
          simulationId: simulation.id,
          scenarioType,
          pathsFound: results.paths.length,
          maxRiskScore: results.maxRiskScore,
        },
        timestamp: new Date(),
      });

      return updated;
    } catch (error) {
      await this.prisma.attackSimulation.update({
        where: { id: simulation.id },
        data: {
          status: 'failed',
          results: { error: error.message },
          executionTimeMs: Date.now() - startTime,
        },
      });

      this.logger.error(`Simulation ${simulation.id} failed: ${error.message}`);
      throw error;
    }
  }

  async simulateIdentityCompromise(tenantId: string, identityId: string) {
    const accessMappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, identityId },
    });

    const paths: any[] = [];
    let maxRiskScore = 0;

    for (const mapping of accessMappings) {
      // Check if accessible asset has high-severity findings
      const findings = await this.prisma.riskFinding.findMany({
        where: {
          tenantId,
          assetId: mapping.assetId,
          deletedAt: null,
          severity: { in: ['critical', 'high'] },
          status: { in: ['open', 'acknowledged'] },
        },
        include: {
          asset: { select: { id: true, name: true, type: true } },
        },
      });

      // Find downstream assets via lineage
      const downstream = await this.prisma.dataLineageRecord.findMany({
        where: { tenantId, sourceAssetId: mapping.assetId },
      });

      for (const finding of findings) {
        const steps = [
          {
            order: 1,
            description: `Compromised identity ${mapping.identityName} accesses ${finding.asset?.name || mapping.assetId}`,
            assetId: mapping.assetId,
          },
        ];

        for (const lineage of downstream) {
          steps.push({
            order: steps.length + 1,
            description: `Data flows to ${lineage.targetAssetId} via ${lineage.transformType}`,
            assetId: lineage.targetAssetId,
          });
        }

        const riskScore = this.calculatePathRiskScore(
          mapping.identityType === 'public',
          mapping.isExcessive,
          finding.severity,
          steps.length,
        );

        if (riskScore > maxRiskScore) maxRiskScore = riskScore;

        paths.push({
          title: `Identity compromise: ${mapping.identityName} → ${finding.asset?.name || mapping.assetId}`,
          description: `Compromised identity can access asset with ${finding.severity} severity finding`,
          riskScore,
          steps,
          entryPoint: {
            identityId: mapping.identityId,
            identityName: mapping.identityName,
            identityType: mapping.identityType,
            accessLevel: mapping.accessLevel,
          },
          targetAsset: {
            assetId: finding.assetId,
            assetName: finding.asset?.name,
            assetType: finding.asset?.type,
          },
        });
      }
    }

    return { paths, maxRiskScore };
  }

  async simulateDataExfiltration(tenantId: string, assetId: string) {
    // Find all identities that can access this asset
    const accessMappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, assetId },
    });

    // Find all lineage paths TO this asset
    const inboundLineage = await this.prisma.dataLineageRecord.findMany({
      where: { tenantId, targetAssetId: assetId },
    });

    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      select: { id: true, name: true, type: true },
    });

    const paths: any[] = [];
    let maxRiskScore = 0;

    for (const mapping of accessMappings) {
      const steps = [
        {
          order: 1,
          description: `${mapping.identityName} (${mapping.identityType}) has ${mapping.accessLevel} access to ${asset?.name || assetId}`,
          assetId,
        },
      ];

      const riskScore = this.calculatePathRiskScore(
        mapping.identityType === 'public',
        mapping.isExcessive,
        'high',
        steps.length,
      );

      if (riskScore > maxRiskScore) maxRiskScore = riskScore;

      paths.push({
        title: `Exfiltration path: ${mapping.identityName} → ${asset?.name || assetId}`,
        description: `Identity ${mapping.identityName} can exfiltrate data from ${asset?.name || assetId}`,
        riskScore,
        steps,
        entryPoint: {
          identityId: mapping.identityId,
          identityName: mapping.identityName,
          identityType: mapping.identityType,
          accessLevel: mapping.accessLevel,
        },
        targetAsset: {
          assetId,
          assetName: asset?.name,
          assetType: asset?.type,
        },
      });
    }

    for (const lineage of inboundLineage) {
      const sourceAsset = await this.prisma.asset.findFirst({
        where: { id: lineage.sourceAssetId, tenantId },
        select: { id: true, name: true, type: true },
      });

      const steps = [
        {
          order: 1,
          description: `Data flows from ${sourceAsset?.name || lineage.sourceAssetId} via ${lineage.transformType}`,
          assetId: lineage.sourceAssetId,
        },
        {
          order: 2,
          description: `Data arrives at target ${asset?.name || assetId}`,
          assetId,
        },
      ];

      const riskScore = this.calculatePathRiskScore(false, false, 'medium', steps.length);

      if (riskScore > maxRiskScore) maxRiskScore = riskScore;

      paths.push({
        title: `Inbound data flow: ${sourceAsset?.name || lineage.sourceAssetId} → ${asset?.name || assetId}`,
        description: `Data flows into target asset via ${lineage.transformType}`,
        riskScore,
        steps,
        entryPoint: {
          assetId: lineage.sourceAssetId,
          assetName: sourceAsset?.name,
          transformType: lineage.transformType,
        },
        targetAsset: {
          assetId,
          assetName: asset?.name,
          assetType: asset?.type,
        },
      });
    }

    return { paths, maxRiskScore };
  }

  async simulatePrivilegeEscalation(tenantId: string, identityId: string) {
    const accessMappings = await this.prisma.identityAccessMapping.findMany({
      where: { tenantId, identityId },
    });

    const paths: any[] = [];
    let maxRiskScore = 0;

    for (const mapping of accessMappings) {
      // Check if accessible assets have lineage to higher-privilege assets
      const downstream = await this.prisma.dataLineageRecord.findMany({
        where: { tenantId, sourceAssetId: mapping.assetId },
      });

      for (const lineage of downstream) {
        // Check if target asset has higher-privilege access mappings
        const targetMappings = await this.prisma.identityAccessMapping.findMany({
          where: {
            tenantId,
            assetId: lineage.targetAssetId,
            accessLevel: { in: ['admin', 'owner', 'write'] },
          },
        });

        if (targetMappings.length > 0) {
          const targetAsset = await this.prisma.asset.findFirst({
            where: { id: lineage.targetAssetId, tenantId },
            select: { id: true, name: true, type: true },
          });

          const steps = [
            {
              order: 1,
              description: `Identity ${mapping.identityName} accesses ${mapping.assetId} with ${mapping.accessLevel}`,
              assetId: mapping.assetId,
            },
            {
              order: 2,
              description: `Data flows via ${lineage.transformType} to ${targetAsset?.name || lineage.targetAssetId}`,
              assetId: lineage.targetAssetId,
            },
            {
              order: 3,
              description: `Target asset has ${targetMappings.length} privileged access mappings`,
              assetId: lineage.targetAssetId,
            },
          ];

          const riskScore = this.calculatePathRiskScore(
            mapping.identityType === 'public',
            mapping.isExcessive,
            'high',
            steps.length,
          );

          if (riskScore > maxRiskScore) maxRiskScore = riskScore;

          paths.push({
            title: `Privilege escalation: ${mapping.identityName} → ${targetAsset?.name || lineage.targetAssetId}`,
            description: `Identity can escalate privileges through data lineage to higher-privilege asset`,
            riskScore,
            steps,
            entryPoint: {
              identityId: mapping.identityId,
              identityName: mapping.identityName,
              identityType: mapping.identityType,
              accessLevel: mapping.accessLevel,
            },
            targetAsset: {
              assetId: lineage.targetAssetId,
              assetName: targetAsset?.name,
              assetType: targetAsset?.type,
              privilegedMappings: targetMappings.length,
            },
          });
        }
      }
    }

    return { paths, maxRiskScore };
  }

  async getSimulations(tenantId: string, filters: { scenarioType?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const { page = 1, pageSize = 20, scenarioType, status } = filters;

    const where: any = {
      tenantId,
      ...(scenarioType && { scenarioType }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.attackSimulation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attackSimulation.count({ where }),
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

  async getSimulationById(tenantId: string, id: string) {
    const simulation = await this.prisma.attackSimulation.findFirst({
      where: { id, tenantId },
      include: {
        simulatedPaths: true,
      },
    });

    if (!simulation) {
      throw new NotFoundException(`Attack simulation ${id} not found`);
    }

    return simulation;
  }

  async getSimulatedPaths(tenantId: string, simulationId: string, page: number = 1, pageSize: number = 20) {
    const where: any = {
      tenantId,
      simulationId,
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.simulatedAttackPath.findMany({
        where,
        orderBy: { riskScore: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.simulatedAttackPath.count({ where }),
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

  private calculatePathRiskScore(
    isPublic: boolean,
    isExcessive: boolean,
    targetSeverity: string,
    pathLength: number,
  ): number {
    let score = 0;

    // Entry point risk (same base as AttackPathAnalyzer.calculatePathRisk)
    if (isPublic) score += 40;
    else if (isExcessive) score += 25;

    // Target sensitivity
    const severityScores: Record<string, number> = {
      critical: 50,
      high: 40,
      medium: 25,
      low: 10,
    };
    score += severityScores[targetSeverity] || 10;

    // Path length penalty: -5 per extra hop beyond 1, minimum result 10
    if (pathLength > 1) {
      score -= (pathLength - 1) * 5;
    }

    return Math.max(10, Math.min(100, score));
  }
}
