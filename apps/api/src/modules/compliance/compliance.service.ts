import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import {
  CreateControlDto,
  UpdateControlDto,
  AddEvidenceDto,
  ComplianceFilterDto,
} from './dto/compliance.dto';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async findAllRegulations(tenantId: string) {
    const regulations = await this.prisma.regulation.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        obligations: {
          include: {
            controls: {
              include: {
                control: {
                  select: {
                    id: true,
                    code: true,
                    implementationStatus: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { shortName: 'asc' },
    });

    return regulations.map((reg) => {
      const totalObligations = reg.obligations.length;
      const controlledObligations = reg.obligations.filter(
        (o) => o.controls.length > 0,
      ).length;

      const allControls = reg.obligations.flatMap((o) =>
        o.controls.map((oc) => oc.control),
      );
      const implementedControls = allControls.filter(
        (c) => c.implementationStatus === 'implemented',
      ).length;
      const totalControls = allControls.length;

      const complianceScore =
        totalControls > 0
          ? Math.round((implementedControls / totalControls) * 100)
          : 0;

      return {
        id: reg.id,
        name: reg.name,
        shortName: reg.shortName,
        jurisdiction: reg.jurisdiction,
        version: reg.version,
        effectiveDate: reg.effectiveDate,
        status: reg.status,
        complianceScore,
        totalObligations,
        controlledObligations,
        implementedControls,
        totalControls,
      };
    });
  }

  async findRegulationById(tenantId: string, id: string) {
    const regulation = await this.prisma.regulation.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        obligations: {
          include: {
            controls: {
              include: {
                control: true,
              },
            },
          },
          orderBy: { reference: 'asc' },
        },
      },
    });

    if (!regulation) {
      throw new NotFoundException(`Regulation ${id} not found`);
    }

    return regulation;
  }

  async findAllControls(
    tenantId: string,
    filters?: ComplianceFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, regulationId, controlStatus } = filters || {};

    const where: any = {
      OR: [{ tenantId }, { tenantId: null }],
      ...(controlStatus && { implementationStatus: controlStatus }),
    };

    // If filtering by regulation, we need to join through obligations
    if (regulationId) {
      where.obligations = {
        some: {
          obligation: {
            regulationId,
          },
        },
      };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.control.findMany({
        where,
        include: {
          obligations: {
            include: {
              obligation: {
                include: {
                  regulation: {
                    select: { id: true, shortName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.control.count({ where }),
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

  async createControl(
    tenantId: string,
    actorId: string,
    dto: CreateControlDto,
  ) {
    const control = await this.prisma.control.create({
      data: {
        tenantId,
        code: dto.code,
        title: dto.title,
        description: dto.description,
        category: 'custom',
        implementationStatus: 'planned',
        ownerId: dto.ownerId,
        obligations: {
          create: dto.obligationIds.map((obligationId) => ({
            obligationId,
          })),
        },
      },
      include: {
        obligations: {
          include: {
            obligation: {
              include: {
                regulation: {
                  select: { id: true, shortName: true },
                },
              },
            },
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'control.created',
      entityType: 'control',
      entityId: control.id,
      changes: {
        after: {
          code: dto.code,
          title: dto.title,
          obligationIds: dto.obligationIds,
        },
      },
    });

    this.logger.log(`Control ${control.code} created by ${actorId}`);

    return control;
  }

  async updateControl(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateControlDto,
  ) {
    const existing = await this.prisma.control.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Control ${id} not found`);
    }

    const previousStatus = existing.implementationStatus;

    const updated = await this.prisma.control.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { implementationStatus: dto.status }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
      },
      include: {
        obligations: {
          include: {
            obligation: true,
          },
        },
      },
    });

    // Update obligation mappings if provided
    if (dto.obligationIds) {
      await this.prisma.obligationControl.deleteMany({
        where: { controlId: id },
      });
      await this.prisma.obligationControl.createMany({
        data: dto.obligationIds.map((obligationId) => ({
          obligationId,
          controlId: id,
        })),
      });
    }

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'control.updated',
      entityType: 'control',
      entityId: id,
      changes: {
        before: {
          code: existing.code,
          title: existing.title,
          implementationStatus: previousStatus,
        },
        after: dto,
      },
    });

    // Publish event if status changed
    if (dto.status && dto.status !== previousStatus) {
      await this.events.publish({
        type: 'control.status.changed',
        tenantId,
        data: {
          controlId: id,
          previousStatus,
          newStatus: dto.status,
          actorId,
        },
        timestamp: new Date(),
      });

      // Recalculate compliance score and publish if it changed
      await this.events.publish({
        type: 'compliance.score.changed',
        tenantId,
        data: {
          controlId: id,
          controlStatus: dto.status,
        },
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async addEvidence(tenantId: string, actorId: string, dto: AddEvidenceDto) {
    const control = await this.prisma.control.findFirst({
      where: {
        id: dto.controlId,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!control) {
      throw new NotFoundException(`Control ${dto.controlId} not found`);
    }

    const evidence = await this.prisma.evidenceArtifact.create({
      data: {
        tenantId,
        name: dto.description || `Evidence for ${control.code}`,
        type: dto.type,
        filePath: dto.url,
        mimeType: dto.mimeType,
        linkedControlIds: [dto.controlId],
        metadata: {
          uploadedBy: actorId,
          description: dto.description,
        },
      },
    });

    // Update control's evidence IDs
    const existingEvidenceIds = (control.evidenceIds as string[]) || [];
    await this.prisma.control.update({
      where: { id: dto.controlId },
      data: {
        evidenceIds: [...existingEvidenceIds, evidence.id],
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'evidence.added',
      entityType: 'evidence_artifact',
      entityId: evidence.id,
      changes: {
        after: {
          controlId: dto.controlId,
          type: dto.type,
          url: dto.url,
        },
      },
    });

    this.logger.log(
      `Evidence ${evidence.id} added to control ${dto.controlId}`,
    );

    return evidence;
  }

  // ---------------------------------------------------------------------------
  // Detect Gaps
  // ---------------------------------------------------------------------------

  async detectGaps(tenantId: string, regulationId: string) {
    const regulation = await this.prisma.regulation.findFirst({
      where: {
        id: regulationId,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        obligations: {
          include: {
            controls: true,
          },
        },
      },
    });

    if (!regulation) {
      throw new NotFoundException(`Regulation ${regulationId} not found`);
    }

    const gaps: any[] = [];

    for (const obligation of regulation.obligations) {
      if (obligation.controls.length === 0) {
        gaps.push({
          tenantId,
          regulationId,
          obligationId: obligation.id,
          obligationReference: obligation.reference,
          obligationTitle: obligation.title,
          severity: obligation.priority || 'medium',
          status: 'open',
          detectedAt: new Date(),
        });
      }
    }

    if (gaps.length > 0) {
      await this.prisma.controlGap.createMany({
        data: gaps,
      });
    }

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'compliance.gaps_detected',
      entityType: 'regulation',
      entityId: regulationId,
      changes: {
        after: {
          regulationName: regulation.shortName,
          totalGaps: gaps.length,
        },
      },
    });

    this.logger.log(
      `Detected ${gaps.length} compliance gaps for regulation ${regulation.shortName}`,
    );

    return {
      regulationId,
      regulationName: regulation.shortName,
      totalGaps: gaps.length,
      gaps,
    };
  }

  // ---------------------------------------------------------------------------
  // Auto-Collect Evidence
  // ---------------------------------------------------------------------------

  async autoCollectEvidence(tenantId: string, controlId: string) {
    const control = await this.prisma.control.findFirst({
      where: {
        id: controlId,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!control) {
      throw new NotFoundException(`Control ${controlId} not found`);
    }

    const automatedCheck = (control.automatedCheck as Record<string, any>) || {};
    const checkType = automatedCheck.type || 'manual';

    let checkResult: Record<string, any> = {};
    let checkEvidence: Record<string, any> = {};

    // Execute automated checks based on type
    switch (checkType) {
      case 'audit_log_count': {
        const count = await this.prisma.auditLog.count({
          where: { tenantId },
        });
        checkResult = { type: 'audit_log_count', count, passed: count > 0 };
        checkEvidence = { auditLogCount: count, checkedAt: new Date().toISOString() };
        break;
      }
      case 'encryption_status': {
        // Check if encryption-related controls exist and are implemented
        const encryptionControls = await this.prisma.control.count({
          where: {
            OR: [{ tenantId }, { tenantId: null }],
            category: 'encryption',
            implementationStatus: 'implemented',
          },
        });
        checkResult = {
          type: 'encryption_status',
          implementedControls: encryptionControls,
          passed: encryptionControls > 0,
        };
        checkEvidence = {
          encryptionControlCount: encryptionControls,
          checkedAt: new Date().toISOString(),
        };
        break;
      }
      default: {
        checkResult = {
          type: 'manual',
          message: 'No automated check configured',
          passed: false,
        };
        checkEvidence = { checkedAt: new Date().toISOString() };
      }
    }

    await this.prisma.control.update({
      where: { id: controlId },
      data: {
        checkResult,
        checkEvidence,
        lastCheckedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'compliance.evidence_collected',
      entityType: 'control',
      entityId: controlId,
      changes: {
        after: { checkType, checkResult },
      },
    });

    this.logger.log(
      `Auto-collected evidence for control ${controlId} (type: ${checkType})`,
    );

    return {
      controlId,
      checkType,
      checkResult,
      checkEvidence,
      lastCheckedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Map Cross-Regulation
  // ---------------------------------------------------------------------------

  async mapCrossRegulation(tenantId: string) {
    const controls = await this.prisma.control.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        obligations: {
          include: {
            obligation: {
              include: {
                regulation: {
                  select: { id: true, shortName: true },
                },
              },
            },
          },
        },
      },
    });

    const crossMapped = controls
      .filter((control) => {
        const regulations = new Set(
          control.obligations.map(
            (oc) => oc.obligation.regulation?.id,
          ),
        );
        return regulations.size > 1;
      })
      .map((control) => {
        const regulations = control.obligations
          .map((oc) => ({
            regulationId: oc.obligation.regulation?.id,
            regulationName: oc.obligation.regulation?.shortName,
            obligationId: oc.obligation.id,
            obligationReference: oc.obligation.reference,
          }))
          .filter((r) => r.regulationId);

        // Deduplicate regulations
        const uniqueRegulations = Array.from(
          new Map(
            regulations.map((r) => [r.regulationId, r]),
          ).values(),
        );

        return {
          controlId: control.id,
          controlCode: control.code,
          controlTitle: control.title,
          regulations: uniqueRegulations,
          regulationCount: uniqueRegulations.length,
        };
      });

    return {
      totalCrossMappedControls: crossMapped.length,
      controls: crossMapped,
    };
  }

  // ---------------------------------------------------------------------------
  // Import Framework
  // ---------------------------------------------------------------------------

  async importFramework(dto: {
    name: string;
    shortName: string;
    version: string;
    obligations?: any[];
  }) {
    const framework = await this.prisma.complianceFramework.create({
      data: {
        name: dto.name,
        shortName: dto.shortName,
        version: dto.version,
        obligations: dto.obligations || [],
        status: 'active',
      },
    });

    this.logger.log(`Compliance framework "${dto.shortName}" imported`);

    return framework;
  }

  // ---------------------------------------------------------------------------
  // Find Frameworks
  // ---------------------------------------------------------------------------

  async findFrameworks() {
    return this.prisma.complianceFramework.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Find Gaps (paginated)
  // ---------------------------------------------------------------------------

  async findGaps(
    tenantId: string,
    filters?: {
      regulationId?: string;
      severity?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      tenantId,
      ...(filters?.regulationId && { regulationId: filters.regulationId }),
      ...(filters?.severity && { severity: filters.severity }),
      ...(filters?.status && { status: filters.status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.controlGap.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.controlGap.count({ where }),
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
  // Scorecard
  // ---------------------------------------------------------------------------

  async getScorecard(tenantId: string) {
    const regulations = await this.findAllRegulations(tenantId);

    const totalScore =
      regulations.length > 0
        ? Math.round(
            regulations.reduce((sum, r) => sum + r.complianceScore, 0) /
              regulations.length,
          )
        : 0;

    const totalObligations = regulations.reduce(
      (sum, r) => sum + r.totalObligations,
      0,
    );
    const totalControls = regulations.reduce(
      (sum, r) => sum + r.totalControls,
      0,
    );
    const implementedControls = regulations.reduce(
      (sum, r) => sum + r.implementedControls,
      0,
    );

    return {
      overallScore: totalScore,
      totalRegulations: regulations.length,
      totalObligations,
      totalControls,
      implementedControls,
      byRegulation: regulations.map((r) => ({
        regulationId: r.id,
        regulationName: r.shortName,
        jurisdiction: r.jurisdiction,
        complianceScore: r.complianceScore,
        totalObligations: r.totalObligations,
        controlledObligations: r.controlledObligations,
        implementedControls: r.implementedControls,
        totalControls: r.totalControls,
      })),
    };
  }
}
