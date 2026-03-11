import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { createHash } from 'crypto';
import {
  CreateRetentionPolicyDto,
  UpdateRetentionPolicyDto,
  RetentionFilterDto,
} from './dto/retention.dto';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateRetentionPolicyDto) {
    const policy = await this.prisma.retentionPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        recordCategory: dto.recordCategory,
        retentionPeriodDays: dto.retentionDays,
        actionOnExpiry: dto.actionOnExpiry,
        legalBasis: dto.legalBasis,
        applicableRegulations: dto.regulationReference
          ? [dto.regulationReference]
          : undefined,
        status: 'active',
        createdBy: actorId,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.created',
      entityType: 'retention_policy',
      entityId: policy.id,
      changes: { after: dto },
    });

    this.logger.log(`Retention policy ${policy.id} created by ${actorId}`);

    return policy;
  }

  async findAll(
    tenantId: string,
    filters?: RetentionFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, recordCategory, activeOnly } = filters || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(recordCategory && { recordCategory }),
      ...(activeOnly && { status: 'active' }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.retentionPolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.retentionPolicy.count({ where }),
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

  async findById(tenantId: string, id: string) {
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!policy) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    return policy;
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateRetentionPolicyDto,
  ) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    const updated = await this.prisma.retentionPolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.recordCategory !== undefined && { recordCategory: dto.recordCategory }),
        ...(dto.retentionDays !== undefined && { retentionPeriodDays: dto.retentionDays }),
        ...(dto.actionOnExpiry !== undefined && { actionOnExpiry: dto.actionOnExpiry }),
        ...(dto.legalBasis !== undefined && { legalBasis: dto.legalBasis }),
        ...(dto.isActive !== undefined && { status: dto.isActive ? 'active' : 'inactive' }),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.updated',
      entityType: 'retention_policy',
      entityId: id,
      changes: {
        before: {
          name: existing.name,
          recordCategory: existing.recordCategory,
          retentionPeriodDays: existing.retentionPeriodDays,
          actionOnExpiry: existing.actionOnExpiry,
          status: existing.status,
        },
        after: dto,
      },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, actorId: string) {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Retention policy ${id} not found`);
    }

    const deactivated = await this.prisma.retentionPolicy.update({
      where: { id },
      data: {
        status: 'inactive',
        deletedAt: new Date(),
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention_policy.deactivated',
      entityType: 'retention_policy',
      entityId: id,
      changes: {
        before: { status: existing.status },
        after: { status: 'inactive' },
      },
    });

    return deactivated;
  }

  async triggerDisposal(tenantId: string, policyId: string, actorId: string) {
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: { id: policyId, tenantId, deletedAt: null },
    });

    if (!policy) {
      throw new NotFoundException(`Retention policy ${policyId} not found`);
    }

    // Create a workflow record for the disposal process
    const workflow = await this.prisma.workflow.create({
      data: {
        tenantId,
        type: 'retention',
        status: 'active',
        entityType: 'retention_policy',
        entityId: policyId,
        currentStep: 'disposal_initiated',
        metadata: {
          policyName: policy.name,
          actionOnExpiry: policy.actionOnExpiry,
          recordCategory: policy.recordCategory,
          triggeredBy: actorId,
          triggeredAt: new Date().toISOString(),
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'retention.disposal.triggered',
      entityType: 'retention_policy',
      entityId: policyId,
      changes: {
        after: {
          workflowId: workflow.id,
          actionOnExpiry: policy.actionOnExpiry,
        },
      },
    });

    await this.events.publish({
      type: 'retention.policy.triggered',
      tenantId,
      data: {
        policyId,
        workflowId: workflow.id,
        actionOnExpiry: policy.actionOnExpiry,
        recordCategory: policy.recordCategory,
        actorId,
      },
      timestamp: new Date(),
    });

    await this.events.publish({
      type: 'retention.disposal.completed',
      tenantId,
      data: {
        policyId,
        workflowId: workflow.id,
        actionOnExpiry: policy.actionOnExpiry,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Disposal triggered for retention policy ${policyId} (action: ${policy.actionOnExpiry})`,
    );

    return {
      workflowId: workflow.id,
      policyId,
      action: policy.actionOnExpiry,
      status: 'disposal_initiated',
    };
  }

  // ---------------------------------------------------------------------------
  // Detect Violations
  // ---------------------------------------------------------------------------

  async detectViolations(tenantId: string) {
    const now = new Date();
    const violations: any[] = [];

    // 1. Assets without retention policies (no_policy)
    const allAssets = await this.prisma.dataAsset.findMany({
      where: { tenantId },
      select: { id: true, name: true, type: true },
    });

    const policiedCategories = await this.prisma.retentionPolicy.findMany({
      where: { tenantId, deletedAt: null, status: 'active' },
      select: { recordCategory: true },
    });
    const coveredCategories = new Set(
      policiedCategories.map((p) => p.recordCategory),
    );

    for (const asset of allAssets) {
      if (!coveredCategories.has(asset.type)) {
        violations.push({
          tenantId,
          violationType: 'no_policy',
          entityType: 'data_asset',
          entityId: asset.id,
          description: `Asset "${asset.name}" has no applicable retention policy`,
          status: 'open',
          detectedAt: now,
        });
      }
    }

    // 2. Policies not reviewed in 365+ days (overdue_review)
    const overdueReviewThreshold = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1000,
    );

    const overduePolicies = await this.prisma.retentionPolicy.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'active',
        OR: [
          { lastReviewedAt: { lt: overdueReviewThreshold } },
          { lastReviewedAt: null },
        ],
      },
    });

    for (const policy of overduePolicies) {
      violations.push({
        tenantId,
        violationType: 'overdue_review',
        entityType: 'retention_policy',
        entityId: policy.id,
        description: `Policy "${policy.name}" has not been reviewed in over 365 days`,
        status: 'open',
        detectedAt: now,
      });
    }

    // Create violation records
    if (violations.length > 0) {
      await this.prisma.retentionViolation.createMany({
        data: violations,
      });
    }

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'retention.violations_detected',
      entityType: 'retention_violation',
      entityId: tenantId,
      changes: {
        after: {
          totalViolations: violations.length,
          byType: {
            no_policy: violations.filter((v) => v.violationType === 'no_policy')
              .length,
            overdue_review: violations.filter(
              (v) => v.violationType === 'overdue_review',
            ).length,
          },
        },
      },
    });

    this.logger.log(
      `Detected ${violations.length} retention violations for tenant ${tenantId}`,
    );

    return { totalViolations: violations.length };
  }

  // ---------------------------------------------------------------------------
  // Enforce Policy
  // ---------------------------------------------------------------------------

  async enforcePolicy(tenantId: string, policyId: string) {
    const policy = await this.prisma.retentionPolicy.findFirst({
      where: { id: policyId, tenantId, deletedAt: null },
    });

    if (!policy) {
      throw new NotFoundException(`Retention policy ${policyId} not found`);
    }

    // Find applicable assets
    const assets = await this.prisma.dataAsset.findMany({
      where: { tenantId, type: policy.recordCategory },
      select: { id: true, name: true },
    });

    // Trigger retention workflow
    const workflow = await this.prisma.workflow.create({
      data: {
        tenantId,
        type: 'retention',
        status: 'active',
        entityType: 'retention_policy',
        entityId: policyId,
        currentStep: 'enforcement_initiated',
        metadata: {
          policyName: policy.name,
          actionOnExpiry: policy.actionOnExpiry,
          applicableAssets: assets.map((a) => a.id),
          enforcedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.retentionPolicy.update({
      where: { id: policyId },
      data: { lastEnforcedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'retention.policy_enforced',
      entityType: 'retention_policy',
      entityId: policyId,
      changes: {
        after: {
          workflowId: workflow.id,
          applicableAssetCount: assets.length,
        },
      },
    });

    await this.events.publish({
      type: 'retention.policy.enforced',
      tenantId,
      data: {
        policyId,
        workflowId: workflow.id,
        assetCount: assets.length,
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Retention policy ${policyId} enforced on ${assets.length} assets`,
    );

    return {
      policyId,
      workflowId: workflow.id,
      applicableAssets: assets.length,
      status: 'enforcement_initiated',
    };
  }

  // ---------------------------------------------------------------------------
  // Generate Disposition Certificate
  // ---------------------------------------------------------------------------

  async generateDispositionCertificate(
    tenantId: string,
    policyId: string,
    assetId: string,
    action: string,
    userId: string,
  ) {
    const timestamp = new Date().toISOString();
    const integrityHash = createHash('sha256')
      .update(`${action}:${assetId}:${timestamp}`)
      .digest('hex');

    const certificate = await this.prisma.dispositionCertificate.create({
      data: {
        tenantId,
        policyId,
        assetId,
        action,
        executedBy: userId,
        executedAt: new Date(),
        integrityHash,
        metadata: {
          timestamp,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await this.audit.log({
      tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'retention.disposition_certificate_generated',
      entityType: 'disposition_certificate',
      entityId: certificate.id,
      changes: {
        after: {
          policyId,
          assetId,
          action,
          integrityHash,
        },
      },
    });

    return certificate;
  }

  // ---------------------------------------------------------------------------
  // Get Violations
  // ---------------------------------------------------------------------------

  async getViolations(
    tenantId: string,
    filters?: {
      violationType?: string;
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
      ...(filters?.violationType && { violationType: filters.violationType }),
      ...(filters?.status && { status: filters.status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.retentionViolation.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.retentionViolation.count({ where }),
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
  // Get Disposition Certificates
  // ---------------------------------------------------------------------------

  async getDispositionCertificates(
    tenantId: string,
    filters?: { page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = { tenantId };

    const [data, totalItems] = await Promise.all([
      this.prisma.dispositionCertificate.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.dispositionCertificate.count({ where }),
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
  // Get Coverage
  // ---------------------------------------------------------------------------

  async getCoverage(tenantId: string) {
    const [totalAssets, policies] = await Promise.all([
      this.prisma.dataAsset.count({ where: { tenantId } }),
      this.prisma.retentionPolicy.findMany({
        where: { tenantId, deletedAt: null, status: 'active' },
        select: { recordCategory: true },
      }),
    ]);

    const coveredCategories = new Set(
      policies.map((p) => p.recordCategory),
    );

    const coveredAssets = await this.prisma.dataAsset.count({
      where: {
        tenantId,
        type: { in: Array.from(coveredCategories) },
      },
    });

    return {
      totalAssets,
      coveredAssets,
      uncoveredAssets: totalAssets - coveredAssets,
      coveragePercentage:
        totalAssets > 0
          ? Math.round((coveredAssets / totalAssets) * 100 * 10) / 10
          : 100,
      activePolicies: policies.length,
    };
  }
}
