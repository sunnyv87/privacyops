import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class GraphEnrichmentService {
  private readonly logger = new Logger(GraphEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async enrichWithRiskSignals(tenantId: string) {
    this.logger.log(
      `Enriching graph with risk signals for tenant ${tenantId}`,
    );

    const openFindings = await this.prisma.riskFinding.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['open', 'acknowledged'] },
      },
      select: {
        id: true,
        title: true,
        severity: true,
        riskScore: true,
        assetId: true,
      },
    });

    let count = 0;

    for (const finding of openFindings) {
      // Create a risk_signal node for the finding
      const signalNode = await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'risk_signal',
            entityId: finding.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'risk_signal',
          entityId: finding.id,
          label: finding.title,
          metadata: {
            severity: finding.severity,
            riskScore: Number(finding.riskScore),
          },
        },
        update: {
          label: finding.title,
          metadata: {
            severity: finding.severity,
            riskScore: Number(finding.riskScore),
          },
        },
      });

      // Create EXPOSED_TO edge to affected asset
      if (finding.assetId) {
        const assetNode = await this.prisma.dataGraphNode.findFirst({
          where: { tenantId, nodeType: 'asset', entityId: finding.assetId },
        });

        if (assetNode) {
          // Check if edge already exists
          const existingEdge = await this.prisma.dataGraphEdge.findFirst({
            where: {
              tenantId,
              sourceNodeId: assetNode.id,
              targetNodeId: signalNode.id,
              relationshipType: 'EXPOSED_TO',
            },
          });

          if (!existingEdge) {
            await this.prisma.dataGraphEdge.create({
              data: {
                tenantId,
                sourceNodeId: assetNode.id,
                targetNodeId: signalNode.id,
                relationshipType: 'EXPOSED_TO',
                metadata: { severity: finding.severity },
              },
            });
          }
        }
      }

      count++;
    }

    this.logger.log(
      `Enriched graph with ${count} risk signal nodes for tenant ${tenantId}`,
    );

    return { count };
  }

  async enrichWithAttackVectors(tenantId: string) {
    this.logger.log(
      `Enriching graph with attack vectors for tenant ${tenantId}`,
    );

    const attackPaths = await this.prisma.attackPath.findMany({
      where: {
        tenantId,
        status: 'active',
      },
      select: {
        id: true,
        title: true,
        severity: true,
        score: true,
        targetAssetId: true,
      },
    });

    let count = 0;

    for (const path of attackPaths) {
      // Create attack_vector node
      const vectorNode = await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'attack_vector',
            entityId: path.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'attack_vector',
          entityId: path.id,
          label: path.title,
          metadata: {
            severity: path.severity,
            score: Number(path.score),
          },
        },
        update: {
          label: path.title,
          metadata: {
            severity: path.severity,
            score: Number(path.score),
          },
        },
      });

      // Create edge to target asset
      const targetNode = await this.prisma.dataGraphNode.findFirst({
        where: {
          tenantId,
          nodeType: 'asset',
          entityId: path.targetAssetId,
        },
      });

      if (targetNode) {
        const existingEdge = await this.prisma.dataGraphEdge.findFirst({
          where: {
            tenantId,
            sourceNodeId: vectorNode.id,
            targetNodeId: targetNode.id,
            relationshipType: 'TARGETS',
          },
        });

        if (!existingEdge) {
          await this.prisma.dataGraphEdge.create({
            data: {
              tenantId,
              sourceNodeId: vectorNode.id,
              targetNodeId: targetNode.id,
              relationshipType: 'TARGETS',
              metadata: { severity: path.severity },
            },
          });
        }
      }

      count++;
    }

    this.logger.log(
      `Enriched graph with ${count} attack vector nodes for tenant ${tenantId}`,
    );

    return { count };
  }

  async enrichWithControls(tenantId: string) {
    this.logger.log(
      `Enriching graph with controls for tenant ${tenantId}`,
    );

    const controls = await this.prisma.control.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      select: {
        id: true,
        code: true,
        title: true,
        category: true,
        implementationStatus: true,
      },
    });

    let count = 0;

    for (const control of controls) {
      // Create control node
      const controlNode = await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'control',
            entityId: control.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'control',
          entityId: control.id,
          label: `${control.code}: ${control.title}`,
          metadata: {
            category: control.category,
            implementationStatus: control.implementationStatus,
          },
        },
        update: {
          label: `${control.code}: ${control.title}`,
          metadata: {
            category: control.category,
            implementationStatus: control.implementationStatus,
          },
        },
      });

      // Create CONTROLLED_BY_POLICY edges to all asset nodes in this tenant
      // (Controls apply broadly; link to assets that have risk findings in control's category)
      const relatedFindings = await this.prisma.riskFinding.findMany({
        where: {
          tenantId,
          deletedAt: null,
          category: control.category,
          status: { in: ['open', 'acknowledged'] },
          assetId: { not: null },
        },
        select: { assetId: true },
        distinct: ['assetId'],
      });

      for (const finding of relatedFindings) {
        if (!finding.assetId) continue;

        const assetNode = await this.prisma.dataGraphNode.findFirst({
          where: {
            tenantId,
            nodeType: 'asset',
            entityId: finding.assetId,
          },
        });

        if (assetNode) {
          const existingEdge = await this.prisma.dataGraphEdge.findFirst({
            where: {
              tenantId,
              sourceNodeId: assetNode.id,
              targetNodeId: controlNode.id,
              relationshipType: 'CONTROLLED_BY_POLICY',
            },
          });

          if (!existingEdge) {
            await this.prisma.dataGraphEdge.create({
              data: {
                tenantId,
                sourceNodeId: assetNode.id,
                targetNodeId: controlNode.id,
                relationshipType: 'CONTROLLED_BY_POLICY',
                metadata: { controlCode: control.code },
              },
            });
          }
        }
      }

      count++;
    }

    this.logger.log(
      `Enriched graph with ${count} control nodes for tenant ${tenantId}`,
    );

    return { count };
  }

  async syncEntities(tenantId: string) {
    this.logger.log(`Syncing all entities to graph for tenant ${tenantId}`);

    let created = 0;
    let updated = 0;

    // Sync Assets
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });

    for (const asset of assets) {
      const existing = await this.prisma.dataGraphNode.findFirst({
        where: { tenantId, nodeType: 'asset', entityId: asset.id },
      });

      await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'asset',
            entityId: asset.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'asset',
          entityId: asset.id,
          label: asset.name,
          metadata: { type: asset.type },
        },
        update: {
          label: asset.name,
          metadata: { type: asset.type },
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    // Sync Vendors
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, type: true, status: true },
    });

    for (const vendor of vendors) {
      const existing = await this.prisma.dataGraphNode.findFirst({
        where: { tenantId, nodeType: 'vendor', entityId: vendor.id },
      });

      await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'vendor',
            entityId: vendor.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'vendor',
          entityId: vendor.id,
          label: vendor.name,
          metadata: { type: vendor.type, status: vendor.status },
        },
        update: {
          label: vendor.name,
          metadata: { type: vendor.type, status: vendor.status },
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    // Sync AiSystems
    const aiSystems = await this.prisma.aiSystem.findMany({
      where: { tenantId },
      select: { id: true, name: true, type: true, status: true, riskCategory: true },
    });

    for (const ai of aiSystems) {
      const existing = await this.prisma.dataGraphNode.findFirst({
        where: { tenantId, nodeType: 'ai_system', entityId: ai.id },
      });

      await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'ai_system',
            entityId: ai.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'ai_system',
          entityId: ai.id,
          label: ai.name,
          metadata: { type: ai.type, status: ai.status, riskCategory: ai.riskCategory },
        },
        update: {
          label: ai.name,
          metadata: { type: ai.type, status: ai.status, riskCategory: ai.riskCategory },
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    // Sync Identities (users)
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'active', deletedAt: null },
      select: { id: true, name: true, email: true },
    });

    for (const user of users) {
      const existing = await this.prisma.dataGraphNode.findFirst({
        where: { tenantId, nodeType: 'identity', entityId: user.id },
      });

      await this.prisma.dataGraphNode.upsert({
        where: {
          tenantId_nodeType_entityId: {
            tenantId,
            nodeType: 'identity',
            entityId: user.id,
          },
        },
        create: {
          tenantId,
          nodeType: 'identity',
          entityId: user.id,
          label: user.name,
          metadata: { email: user.email },
        },
        update: {
          label: user.name,
          metadata: { email: user.email },
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    this.logger.log(
      `Entity sync complete for tenant ${tenantId}: ${created} created, ${updated} updated`,
    );

    return { created, updated };
  }
}
