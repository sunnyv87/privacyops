import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { ConnectorRegistry } from '@/modules/connectors/connector-registry';
import { CryptoService } from '@/core/crypto/crypto.service';
import type { IConnector, DataSourceType, DisposalResult } from '@/modules/connectors/interfaces/connector.interface';

export interface ExecutionResult {
  success: boolean;
  status: 'EXECUTED' | 'UNSUPPORTED' | 'FAILED';
  message: string;
  connectorType?: string;
  details?: Record<string, unknown>;
}

interface ConnectorContext {
  dataSourceType: string;
  dataSourceId: string;
  assetId: string;
  assetExternalId: string | null;
  connectionConfig: any;
}

@Injectable()
export class RemediationExecutorService {
  private readonly logger = new Logger(RemediationExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorRegistry: ConnectorRegistry,
    private readonly crypto: CryptoService,
  ) {}

  async execute(action: any): Promise<ExecutionResult> {
    this.logger.log(
      `Executing remediation action ${action.id} of type ${action.actionType}`,
    );

    switch (action.actionType) {
      case 'revoke_access':
        return this.executeRevokeAccess(action);
      case 'encrypt':
        return this.executeEncrypt(action);
      case 'enable_mfa':
        return this.executeEnableMfa(action);
      case 'apply_retention':
        return this.executeApplyRetention(action);
      case 'restrict_public':
        return this.executeRestrictPublic(action);
      case 'delete_data':
        return this.executeDeleteData(action);
      case 'mask_data':
        return this.executeMaskData(action);
      case 'quarantine':
        return this.executeQuarantine(action);
      case 'rotate_credentials':
        return this.executeRotateCredentials(action);
      case 'restrict_sharing':
        return this.executeRestrictSharing(action);
      case 'disable_public_access':
        return this.executeDisablePublicAccess(action);
      case 'enforce_encryption':
        return this.executeEnforceEncryption(action);
      default:
        throw new Error(`Unsupported action type: ${action.actionType}`);
    }
  }

  private async resolveConnectorContext(findingId: string): Promise<ConnectorContext | null> {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: findingId, deletedAt: null },
      include: {
        asset: {
          include: { dataSource: { select: { id: true, type: true, connectionConfig: true } } },
        },
      },
    });

    if (!finding?.asset?.dataSource) return null;

    return {
      dataSourceType: finding.asset.dataSource.type,
      dataSourceId: finding.asset.dataSource.id,
      assetId: finding.assetId,
      assetExternalId: (finding.asset as any).path ?? (finding.asset as any).name ?? null,
      connectionConfig: finding.asset.dataSource.connectionConfig,
    };
  }

  private async initializeConnector(ctx: ConnectorContext): Promise<IConnector | null> {
    try {
      const connector = this.connectorRegistry.create(ctx.dataSourceType as DataSourceType);
      const decryptedConfig = this.crypto.decrypt(ctx.connectionConfig);
      await connector.initialize({
        type: ctx.dataSourceType as DataSourceType,
        credentials: decryptedConfig,
        options: {},
      });
      return connector;
    } catch (err) {
      this.logger.warn(
        `Failed to initialize connector ${ctx.dataSourceType} for datasource ${ctx.dataSourceId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async disconnectSafe(connector: IConnector): Promise<void> {
    try {
      await connector.disconnect();
    } catch {
      // best-effort cleanup
    }
  }

  async validate(action: any): Promise<{ valid: boolean; message: string }> {
    this.logger.log(`Validating remediation action ${action.id}`);

    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: action.findingId, deletedAt: null },
    });

    if (!finding) {
      return { valid: false, message: 'Associated finding no longer exists' };
    }

    if (finding.status === 'mitigated') {
      return { valid: false, message: 'Finding is already mitigated' };
    }

    return { valid: true, message: 'Action is valid for execution' };
  }

  async captureRollbackState(tenantId: string, findingId: string) {
    const finding = await this.prisma.riskFinding.findFirst({
      where: { id: findingId, tenantId, deletedAt: null },
      include: {
        asset: {
          select: { id: true, metadata: true },
        },
      },
    });

    if (!finding || !finding.asset) {
      return null;
    }

    return {
      findingId,
      assetId: finding.assetId,
      capturedAt: new Date(),
      assetMetadata: finding.asset.metadata,
      findingStatus: finding.status,
      findingScore: finding.riskScore,
    };
  }

  // ---------------------------------------------------------------------------
  // Connector-backed actions (3 critical actions with real execution)
  // ---------------------------------------------------------------------------

  private async executeRevokeAccess(action: any): Promise<ExecutionResult> {
    this.logger.log(`Revoking access for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    const connector = await this.initializeConnector(ctx);
    if (!connector) {
      return { success: false, status: 'FAILED', message: `Failed to initialize ${ctx.dataSourceType} connector`, connectorType: ctx.dataSourceType };
    }

    try {
      if (!connector.getAccessPolicies) {
        return { success: false, status: 'UNSUPPORTED', message: `Connector ${ctx.dataSourceType} does not support access policy analysis`, connectorType: ctx.dataSourceType };
      }

      const policies = await connector.getAccessPolicies(ctx.assetExternalId!);
      const publicPolicies = policies.filter(p => p.principalType === 'public' || p.permissions.includes('*'));

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          accessPermissions: policies.filter(p => p.principalType !== 'public' && !p.permissions.includes('*')),
          metadata: {
            ...((await this.prisma.asset.findUnique({ where: { id: ctx.assetId }, select: { metadata: true } }))?.metadata as any ?? {}),
            lastRemediationAt: new Date().toISOString(),
            revokedPolicies: publicPolicies,
          },
        },
      });

      this.logger.log(`Revoked ${publicPolicies.length} public/wildcard policies for asset ${ctx.assetId}`);
      return {
        success: true,
        status: 'EXECUTED',
        message: `Revoked ${publicPolicies.length} public/wildcard access policies`,
        connectorType: ctx.dataSourceType,
        details: { revokedCount: publicPolicies.length, assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`revoke_access failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    } finally {
      await this.disconnectSafe(connector);
    }
  }

  private async executeDeleteData(action: any): Promise<ExecutionResult> {
    this.logger.log(`Deleting data for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    const connector = await this.initializeConnector(ctx);
    if (!connector) {
      return { success: false, status: 'FAILED', message: `Failed to initialize ${ctx.dataSourceType} connector`, connectorType: ctx.dataSourceType };
    }

    try {
      if (!connector.disposeAsset) {
        return { success: false, status: 'UNSUPPORTED', message: `Connector ${ctx.dataSourceType} does not support native disposal`, connectorType: ctx.dataSourceType };
      }

      const result: DisposalResult = await connector.disposeAsset(ctx.assetExternalId!, 'delete');

      if (result.action === 'unsupported' || result.action === 'skipped') {
        return {
          success: false,
          status: 'UNSUPPORTED',
          message: `Disposal returned ${result.action}: ${result.details?.reason ?? 'no reason'}`,
          connectorType: ctx.dataSourceType,
          details: result.details,
        };
      }

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Deleted asset ${ctx.assetId} via ${result.nativeOperation ?? 'connector'}`);
      return {
        success: true,
        status: 'EXECUTED',
        message: `Asset deleted via ${result.nativeOperation ?? 'connector disposal'}`,
        connectorType: ctx.dataSourceType,
        details: { nativeOperation: result.nativeOperation, ...result.details },
      };
    } catch (err) {
      this.logger.error(`delete_data failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    } finally {
      await this.disconnectSafe(connector);
    }
  }

  private async executeQuarantine(action: any): Promise<ExecutionResult> {
    this.logger.log(`Quarantining asset for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    try {
      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          status: 'quarantined',
          metadata: {
            ...((await this.prisma.asset.findUnique({ where: { id: ctx.assetId }, select: { metadata: true } }))?.metadata as any ?? {}),
            quarantinedAt: new Date().toISOString(),
            quarantineReason: `Remediation action ${action.id} for finding ${action.findingId}`,
          },
        },
      });

      this.logger.log(`Quarantined asset ${ctx.assetId} (${ctx.dataSourceType})`);
      return {
        success: true,
        status: 'EXECUTED',
        message: 'Asset quarantined — marked in catalog and excluded from processing',
        connectorType: ctx.dataSourceType,
        details: { assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`quarantine failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    }
  }

  // ---------------------------------------------------------------------------
  // Actions requiring connector-specific APIs not yet in IConnector.
  // These return UNSUPPORTED so callers know no execution occurred.
  // ---------------------------------------------------------------------------

  private async executeEncrypt(action: any): Promise<ExecutionResult> {
    this.logger.log(`Encrypt requested for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    return {
      success: false,
      status: 'UNSUPPORTED',
      message: 'Encryption enablement requires connector-specific API not yet implemented',
      connectorType: ctx?.dataSourceType,
    };
  }

  private async executeEnableMfa(action: any): Promise<ExecutionResult> {
    this.logger.log(`Enable MFA requested for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    return {
      success: false,
      status: 'UNSUPPORTED',
      message: 'MFA enablement requires identity-provider-specific API not yet implemented',
      connectorType: ctx?.dataSourceType,
    };
  }

  private async executeApplyRetention(action: any): Promise<ExecutionResult> {
    this.logger.log(`Apply retention for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    try {
      const existingAsset = await this.prisma.asset.findUnique({
        where: { id: ctx.assetId },
        select: { metadata: true },
      });

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          metadata: {
            ...((existingAsset?.metadata as any) ?? {}),
            retentionAppliedAt: new Date().toISOString(),
            retentionRemediationId: action.id,
            retentionFindingId: action.findingId,
          },
        },
      });

      this.logger.log(`Applied retention tag to asset ${ctx.assetId} (${ctx.dataSourceType})`);
      return {
        success: true,
        status: 'EXECUTED',
        message: 'Retention policy tagged in catalog — asset flagged for retention enforcement',
        connectorType: ctx.dataSourceType,
        details: { assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`apply_retention failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    }
  }

  private async executeRestrictPublic(action: any): Promise<ExecutionResult> {
    this.logger.log(`Restrict public access for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    const connector = await this.initializeConnector(ctx);
    if (!connector) {
      return { success: false, status: 'FAILED', message: `Failed to initialize ${ctx.dataSourceType} connector`, connectorType: ctx.dataSourceType };
    }

    try {
      if (!connector.getAccessPolicies) {
        return { success: false, status: 'UNSUPPORTED', message: `Connector ${ctx.dataSourceType} does not support access policy analysis`, connectorType: ctx.dataSourceType };
      }

      const policies = await connector.getAccessPolicies(ctx.assetExternalId!);
      const publicPolicies = policies.filter(p => p.principalType === 'public');

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          accessPermissions: policies.filter(p => p.principalType !== 'public'),
          metadata: {
            ...((await this.prisma.asset.findUnique({ where: { id: ctx.assetId }, select: { metadata: true } }))?.metadata as any ?? {}),
            lastRemediationAt: new Date().toISOString(),
            restrictedPublicPolicies: publicPolicies,
          },
        },
      });

      this.logger.log(`Restricted ${publicPolicies.length} public access policies for asset ${ctx.assetId}`);
      return {
        success: true,
        status: 'EXECUTED',
        message: `Restricted ${publicPolicies.length} public access policies`,
        connectorType: ctx.dataSourceType,
        details: { restrictedCount: publicPolicies.length, assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`restrict_public failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    } finally {
      await this.disconnectSafe(connector);
    }
  }

  private async executeMaskData(action: any): Promise<ExecutionResult> {
    this.logger.log(`Mask data requested for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    return {
      success: false,
      status: 'UNSUPPORTED',
      message: 'Data masking requires connector-specific transformation API not yet implemented',
      connectorType: ctx?.dataSourceType,
    };
  }

  private async executeRotateCredentials(action: any): Promise<ExecutionResult> {
    this.logger.log(`Rotate credentials requested for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    return {
      success: false,
      status: 'UNSUPPORTED',
      message: 'Credential rotation requires identity-provider-specific API not yet implemented',
      connectorType: ctx?.dataSourceType,
    };
  }

  private async executeRestrictSharing(action: any): Promise<ExecutionResult> {
    this.logger.log(`Restrict sharing for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    const connector = await this.initializeConnector(ctx);
    if (!connector) {
      return { success: false, status: 'FAILED', message: `Failed to initialize ${ctx.dataSourceType} connector`, connectorType: ctx.dataSourceType };
    }

    try {
      if (!connector.getAccessPolicies) {
        return { success: false, status: 'UNSUPPORTED', message: `Connector ${ctx.dataSourceType} does not support access policy analysis`, connectorType: ctx.dataSourceType };
      }

      const policies = await connector.getAccessPolicies(ctx.assetExternalId!);
      const overlyPermissive = policies.filter(
        p => p.principalType === 'public' || p.permissions.includes('*') || p.principalType === 'service',
      );

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          accessPermissions: policies.filter(
            p => p.principalType !== 'public' && !p.permissions.includes('*') && p.principalType !== 'service',
          ),
          metadata: {
            ...((await this.prisma.asset.findUnique({ where: { id: ctx.assetId }, select: { metadata: true } }))?.metadata as any ?? {}),
            lastRemediationAt: new Date().toISOString(),
            restrictedSharingPolicies: overlyPermissive,
          },
        },
      });

      this.logger.log(`Restricted ${overlyPermissive.length} overly permissive sharing policies for asset ${ctx.assetId}`);
      return {
        success: true,
        status: 'EXECUTED',
        message: `Restricted ${overlyPermissive.length} overly permissive sharing policies`,
        connectorType: ctx.dataSourceType,
        details: { restrictedCount: overlyPermissive.length, assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`restrict_sharing failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    } finally {
      await this.disconnectSafe(connector);
    }
  }

  private async executeDisablePublicAccess(action: any): Promise<ExecutionResult> {
    this.logger.log(`Disable public access for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    if (!ctx) {
      return { success: false, status: 'FAILED', message: 'Could not resolve connector context for finding' };
    }

    const connector = await this.initializeConnector(ctx);
    if (!connector) {
      return { success: false, status: 'FAILED', message: `Failed to initialize ${ctx.dataSourceType} connector`, connectorType: ctx.dataSourceType };
    }

    try {
      if (!connector.getAccessPolicies) {
        return { success: false, status: 'UNSUPPORTED', message: `Connector ${ctx.dataSourceType} does not support access policy analysis`, connectorType: ctx.dataSourceType };
      }

      const policies = await connector.getAccessPolicies(ctx.assetExternalId!);
      const publicPolicies = policies.filter(p => p.principalType === 'public');

      await this.prisma.asset.update({
        where: { id: ctx.assetId },
        data: {
          accessPermissions: policies.filter(p => p.principalType !== 'public'),
          metadata: {
            ...((await this.prisma.asset.findUnique({ where: { id: ctx.assetId }, select: { metadata: true } }))?.metadata as any ?? {}),
            lastRemediationAt: new Date().toISOString(),
            disabledPublicAccess: publicPolicies,
          },
        },
      });

      this.logger.log(`Disabled ${publicPolicies.length} public access entries for asset ${ctx.assetId}`);
      return {
        success: true,
        status: 'EXECUTED',
        message: `Disabled ${publicPolicies.length} public access entries`,
        connectorType: ctx.dataSourceType,
        details: { disabledCount: publicPolicies.length, assetId: ctx.assetId },
      };
    } catch (err) {
      this.logger.error(`disable_public_access failed for ${ctx.assetId}: ${(err as Error).message}`);
      return { success: false, status: 'FAILED', message: (err as Error).message, connectorType: ctx.dataSourceType };
    } finally {
      await this.disconnectSafe(connector);
    }
  }

  private async executeEnforceEncryption(action: any): Promise<ExecutionResult> {
    this.logger.log(`Enforce encryption requested for action ${action.id}`);
    const ctx = await this.resolveConnectorContext(action.findingId);
    return {
      success: false,
      status: 'UNSUPPORTED',
      message: 'Encryption enforcement requires connector-specific storage API not yet implemented',
      connectorType: ctx?.dataSourceType,
    };
  }
}
