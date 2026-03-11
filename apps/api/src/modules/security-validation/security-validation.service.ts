import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { PostureScorer } from './posture-scorer.service';

@Injectable()
export class SecurityValidationService {
  private readonly logger = new Logger(SecurityValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly postureScorer: PostureScorer,
  ) {}

  // ---------------------------------------------------------------------------
  // Start Validation Run
  // ---------------------------------------------------------------------------

  async startValidationRun(
    tenantId: string,
    runType: string,
    userId: string,
  ) {
    const run = await this.prisma.validationRun.create({
      data: {
        tenantId,
        runType,
        status: 'running',
        startedAt: new Date(),
        startedBy: userId,
      },
    });

    const results = { passed: 0, failed: 0, skipped: 0 };
    const findings: any[] = [];

    try {
      if (runType === 'access_control' || runType === 'full') {
        const accessResults = await this.runAccessControlTests(tenantId);
        results.passed += accessResults.passed;
        results.failed += accessResults.failed;
        findings.push(...accessResults.findings);
      }

      if (runType === 'encryption' || runType === 'full') {
        const encryptionResults = await this.runEncryptionTests(tenantId);
        results.passed += encryptionResults.passed;
        results.failed += encryptionResults.failed;
        findings.push(...encryptionResults.findings);
      }

      if (runType === 'remediation_verify' || runType === 'full') {
        const remediationResults = await this.runRemediationVerifyTests(tenantId);
        results.passed += remediationResults.passed;
        results.failed += remediationResults.failed;
        findings.push(...remediationResults.findings);
      }

      const postureScore = this.postureScorer.calculatePosture(results);

      const updatedRun = await this.prisma.validationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          postureScore,
          results: {
            ...results,
            findings,
          },
        },
      });

      await this.events.publish({
        type: 'validation.run.completed',
        tenantId,
        data: {
          runId: run.id,
          runType,
          postureScore,
          passed: results.passed,
          failed: results.failed,
        },
        timestamp: new Date(),
      });

      await this.audit.log({
        tenantId,
        actorId: userId,
        actorType: 'user',
        action: 'validation.run_completed',
        entityType: 'validation_run',
        entityId: run.id,
        changes: {
          after: {
            runType,
            postureScore,
            passed: results.passed,
            failed: results.failed,
          },
        },
      });

      this.logger.log(
        `Validation run ${run.id} completed: ${results.passed} passed, ${results.failed} failed, score: ${postureScore}`,
      );

      return updatedRun;
    } catch (error) {
      await this.prisma.validationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          results: { error: error.message },
        },
      });

      this.logger.error(`Validation run ${run.id} failed: ${error.message}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Access Control Tests
  // ---------------------------------------------------------------------------

  private async runAccessControlTests(tenantId: string) {
    const results = { passed: 0, failed: 0, findings: [] as any[] };

    // Query IdentityAccessMapping, check for public access on sensitive assets
    const sensitiveAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        sensitivity: { gte: 4 },
      },
      select: { id: true, name: true },
    });

    for (const asset of sensitiveAssets) {
      const publicAccess = await this.prisma.identityAccessMapping.findFirst({
        where: {
          assetId: asset.id,
          accessLevel: 'public',
        },
      });

      if (publicAccess) {
        results.failed += 1;
        results.findings.push({
          testCategory: 'access_control',
          assetId: asset.id,
          assetName: asset.name,
          finding: 'Public access detected on sensitive asset',
          severity: 'high',
        });
      } else {
        results.passed += 1;
      }
    }

    // If no sensitive assets found, mark as passed
    if (sensitiveAssets.length === 0) {
      results.passed += 1;
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Encryption Tests
  // ---------------------------------------------------------------------------

  private async runEncryptionTests(tenantId: string) {
    const results = { passed: 0, failed: 0, findings: [] as any[] };

    // Query assets with sensitivity >= 4, check encryptionStatus in metadata
    const sensitiveAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        sensitivity: { gte: 4 },
      },
      select: { id: true, name: true, metadata: true },
    });

    for (const asset of sensitiveAssets) {
      const metadata = (asset.metadata as Record<string, any>) || {};
      const encryptionStatus = metadata.encryptionStatus;

      if (encryptionStatus === 'encrypted' || encryptionStatus === 'active') {
        results.passed += 1;
      } else {
        results.failed += 1;
        results.findings.push({
          testCategory: 'encryption',
          assetId: asset.id,
          assetName: asset.name,
          finding: `Encryption not verified (status: ${encryptionStatus || 'unknown'})`,
          severity: 'high',
        });
      }
    }

    // If no sensitive assets found, mark as passed
    if (sensitiveAssets.length === 0) {
      results.passed += 1;
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Remediation Verify Tests
  // ---------------------------------------------------------------------------

  private async runRemediationVerifyTests(tenantId: string) {
    const results = { passed: 0, failed: 0, findings: [] as any[] };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query completed RemediationActions from last 30 days
    const completedActions = await this.prisma.remediationAction.findMany({
      where: {
        tenantId,
        status: 'completed',
        completedAt: { gte: thirtyDaysAgo },
      },
    });

    for (const action of completedActions) {
      // Verify the associated finding is still mitigated
      const finding = await this.prisma.riskFinding.findFirst({
        where: { id: action.findingId },
      });

      if (finding && (finding.status === 'mitigated' || finding.status === 'resolved')) {
        results.passed += 1;
      } else {
        results.failed += 1;
        results.findings.push({
          testCategory: 'remediation_verify',
          actionId: action.id,
          findingId: action.findingId,
          finding: `Remediated finding has regressed (status: ${finding?.status || 'unknown'})`,
          severity: 'medium',
        });
      }
    }

    // If no completed actions found, mark as passed
    if (completedActions.length === 0) {
      results.passed += 1;
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Get Validation Runs
  // ---------------------------------------------------------------------------

  async getValidationRuns(
    tenantId: string,
    filters: {
      runType?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, runType, status } = filters;

    const where: any = {
      tenantId,
      ...(runType && { runType }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.validationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.validationRun.count({ where }),
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
  // Get Validation Run By Id
  // ---------------------------------------------------------------------------

  async getValidationRunById(tenantId: string, id: string) {
    const run = await this.prisma.validationRun.findFirst({
      where: { id, tenantId },
    });

    if (!run) {
      throw new NotFoundException(`Validation run ${id} not found`);
    }

    return run;
  }

  // ---------------------------------------------------------------------------
  // Get Current Posture
  // ---------------------------------------------------------------------------

  async getCurrentPosture(tenantId: string) {
    const latestRun = await this.prisma.validationRun.findFirst({
      where: { tenantId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestRun) {
      return {
        postureScore: null,
        lastRunAt: null,
        findings: [],
        message: 'No completed validation runs found',
      };
    }

    const results = (latestRun.results as Record<string, any>) || {};

    return {
      postureScore: latestRun.postureScore,
      lastRunAt: latestRun.completedAt,
      runType: latestRun.runType,
      passed: results.passed || 0,
      failed: results.failed || 0,
      findings: results.findings || [],
    };
  }

  // ---------------------------------------------------------------------------
  // Get Tests
  // ---------------------------------------------------------------------------

  async getTests(
    tenantId: string,
    filters: {
      testCategory?: string;
      isEnabled?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, testCategory, isEnabled } = filters;

    const where: any = {
      tenantId,
      ...(testCategory && { testCategory }),
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.validationTest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.validationTest.count({ where }),
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
  // Create Test
  // ---------------------------------------------------------------------------

  async createTest(
    tenantId: string,
    dto: {
      testName: string;
      testCategory: string;
      testLogic: any;
      isEnabled?: boolean;
    },
  ) {
    const test = await this.prisma.validationTest.create({
      data: {
        tenantId,
        testName: dto.testName,
        testCategory: dto.testCategory,
        testLogic: dto.testLogic,
        isEnabled: dto.isEnabled ?? true,
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'validation.test_created',
      entityType: 'validation_test',
      entityId: test.id,
      changes: {
        after: {
          testName: dto.testName,
          testCategory: dto.testCategory,
          isEnabled: dto.isEnabled ?? true,
        },
      },
    });

    this.logger.log(`Validation test "${dto.testName}" created`);

    return test;
  }

  // ---------------------------------------------------------------------------
  // Update Test
  // ---------------------------------------------------------------------------

  async updateTest(
    tenantId: string,
    id: string,
    dto: Partial<{ testLogic: any; isEnabled: boolean }>,
  ) {
    const existing = await this.prisma.validationTest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Validation test ${id} not found`);
    }

    const updated = await this.prisma.validationTest.update({
      where: { id },
      data: {
        ...(dto.testLogic !== undefined && { testLogic: dto.testLogic }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });

    await this.audit.log({
      tenantId,
      actorType: 'system',
      action: 'validation.test_updated',
      entityType: 'validation_test',
      entityId: id,
      changes: {
        before: {
          testLogic: existing.testLogic,
          isEnabled: existing.isEnabled,
        },
        after: dto,
      },
    });

    this.logger.log(`Validation test ${id} updated`);

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Verify Remediation
  // ---------------------------------------------------------------------------

  async verifyRemediation(tenantId: string, actionId: string) {
    const action = await this.prisma.remediationAction.findFirst({
      where: { id: actionId, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Remediation action ${actionId} not found`);
    }

    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: action.findingId },
    });

    const verified =
      finding !== null &&
      (finding.status === 'mitigated' || finding.status === 'resolved');

    const details = {
      actionId,
      findingId: action.findingId,
      findingStatus: finding?.status || 'not_found',
      actionStatus: action.status,
      verified,
      verifiedAt: new Date().toISOString(),
    };

    this.logger.log(
      `Remediation verification for action ${actionId}: ${verified ? 'verified' : 'not verified'}`,
    );

    return { verified, details };
  }
}
