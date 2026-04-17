import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ABAC_POLICY_KEY,
  AbacPolicyMetadata,
} from '../decorators/abac-policy.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  AbacEngine,
  AbacContext,
  AbacResource,
  AbacEnvironment,
} from '../policies/abac-engine';
import { AuditService } from '@/core/audit/audit.service';
import { PrismaService } from '@/core/prisma/prisma.service';

/**
 * Map of Prisma model delegate names by resourceType.
 * The key matches the resourceType string used in @RequireAbacPolicy.
 */
const PRISMA_MODEL_MAP: Record<string, string> = {
  DataSource: 'dataSource',
  Asset: 'asset',
  AssetField: 'assetField',
  Classification: 'classification',
  ClassificationLabel: 'classificationLabel',
  ScanJob: 'scanJob',
  DsarRequest: 'dsarRequest',
  DataSubject: 'dataSubject',
  ConsentRecord: 'consentRecord',
  ConsentNotice: 'consentNotice',
  ProcessingPurpose: 'processingPurpose',
  PrivacyAssessment: 'privacyAssessment',
  Incident: 'incident',
  RetentionPolicy: 'retentionPolicy',
  Vendor: 'vendor',
  VendorAssessment: 'vendorAssessment',
  Regulation: 'regulation',
  RiskFinding: 'riskFinding',
  RopaEntry: 'ropaEntry',
  User: 'user',
  Role: 'role',
  Tenant: 'tenant',
  Workflow: 'workflow',
  EvidenceArtifact: 'evidenceArtifact',
  AuditLog: 'auditLog',
  ApprovalRequest: 'approvalRequest',
};

const TENANT_EXEMPT_MODELS = new Set(['Tenant', 'Role', 'Plan']);

@Injectable()
export class AbacGuard implements CanActivate {
  private readonly logger = new Logger(AbacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly abacEngine: AbacEngine,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Read ABAC policy metadata from the decorator
    const policyMeta = this.reflector.getAllAndOverride<AbacPolicyMetadata>(
      ABAC_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequireAbacPolicy is set, the guard does not apply
    if (!policyMeta) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Build resource object, optionally loading from Prisma
    const resource = await this.buildResource(policyMeta, request);

    // Build environment context
    const environment: AbacEnvironment = {
      ip: request.ip || request.connection?.remoteAddress,
      time: new Date(),
      riskLevel: request.headers?.['x-risk-level'] as any,
    };

    const abacCtx: AbacContext = {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roles: user.roles || [],
        permissions: user.permissions || [],
        department: user.department,
        clearanceLevel: user.clearanceLevel,
      },
      resource,
      action: policyMeta.action,
      environment,
    };

    const result = this.abacEngine.evaluate(abacCtx);

    if (!result.allowed) {
      // Log denied access as a security audit event
      await this.logDeniedAccess(abacCtx, result.reason, result.matchedPolicy, request);

      throw new ForbiddenException(result.reason);
    }

    return true;
  }

  /**
   * Build the AbacResource, optionally loading the entity from the database
   * when a resourceIdParam is specified.
   */
  private async buildResource(
    meta: AbacPolicyMetadata,
    request: any,
  ): Promise<AbacResource> {
    const resource: AbacResource = {
      type: meta.resourceType,
    };

    // If there is no resource ID param, return a basic resource
    if (!meta.resourceIdParam) {
      // For creation actions, use tenantId from the request body or user
      resource.tenantId = request.body?.tenantId || request.user?.tenantId;
      return resource;
    }

    // Extract resource ID from route params, query, or body
    const resourceId =
      request.params?.[meta.resourceIdParam] ||
      request.query?.[meta.resourceIdParam] ||
      request.body?.[meta.resourceIdParam];

    if (!resourceId) {
      // No ID available — evaluate with what we have
      resource.tenantId = request.user?.tenantId;
      return resource;
    }

    resource.id = resourceId;

    // Attempt to load the resource from Prisma to enrich context
    const loaded = await this.loadResource(
      meta.resourceType,
      resourceId,
      request.user?.tenantId,
    );

    if (loaded) {
      resource.tenantId = loaded.tenantId ?? undefined;

      // Extract owner from configured field path
      if (meta.ownerField) {
        resource.ownerId = this.getNestedField(loaded, meta.ownerField);
      }

      // Extract classification/sensitivity from configured field path
      if (meta.classificationField) {
        const classValue = this.getNestedField(
          loaded,
          meta.classificationField,
        );
        if (typeof classValue === 'number') {
          resource.sensitivity = classValue;
        } else if (typeof classValue === 'string') {
          resource.classification = classValue;
        }
      }

      // Extract department if available
      if (meta.departmentField) {
        resource.department = this.getNestedField(loaded, meta.departmentField);
      }

      // Attach to request for downstream use (avoid re-fetching)
      request.abacResource = loaded;
    }

    return resource;
  }

  /**
   * Load a resource from Prisma by type and ID, scoped to the requesting
   * user's tenant. We never rely solely on RLS because the session variable
   * may not be set on this connection.
   */
  private async loadResource(
    resourceType: string,
    id: string,
    tenantId?: string,
  ): Promise<any | null> {
    const modelName = PRISMA_MODEL_MAP[resourceType];
    if (!modelName) {
      this.logger.warn(
        `No Prisma model mapping for resourceType "${resourceType}"`,
      );
      return null;
    }

    const delegate = (this.prisma as any)[modelName];
    if (!delegate?.findFirst) {
      this.logger.warn(
        `Prisma delegate "${modelName}" does not support findFirst`,
      );
      return null;
    }

    try {
      const where: Record<string, unknown> = { id };
      // Tenant-scoped models get an explicit filter (defense in depth over RLS)
      if (tenantId && !TENANT_EXEMPT_MODELS.has(resourceType)) {
        where.tenantId = tenantId;
      }
      return await delegate.findFirst({ where });
    } catch (err) {
      this.logger.warn(
        `Failed to load ${resourceType}(${id}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Access a nested field value using dot notation (e.g. 'metadata.department').
   */
  private getNestedField(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current == null) return undefined;
      return current[key];
    }, obj);
  }

  /**
   * Log a denied ABAC access decision as a security audit event.
   */
  private async logDeniedAccess(
    ctx: AbacContext,
    reason: string,
    matchedPolicy: string | undefined,
    request: any,
  ): Promise<void> {
    try {
      await this.auditService.log({
        tenantId: ctx.user.tenantId,
        actorId: ctx.user.id,
        actorType: 'user',
        action: 'security.abac.denied',
        entityType: ctx.resource.type,
        entityId: ctx.resource.id || 'unknown',
        changes: {
          after: {
            attemptedAction: ctx.action,
            reason,
            matchedPolicy,
            environment: {
              ip: ctx.environment.ip,
              time: ctx.environment.time?.toISOString(),
              riskLevel: ctx.environment.riskLevel,
            },
          },
        },
        ipAddress: request.ip || request.connection?.remoteAddress,
        userAgent: request.headers?.['user-agent'],
      });
    } catch (err) {
      this.logger.error(
        `Failed to log ABAC denial: ${(err as Error).message}`,
      );
    }
  }
}
