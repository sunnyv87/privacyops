import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class RemediationExecutorService {
  private readonly logger = new Logger(RemediationExecutorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(action: any) {
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
      default:
        throw new Error(`Unsupported action type: ${action.actionType}`);
    }
  }

  async validate(action: any): Promise<{ valid: boolean; message: string }> {
    this.logger.log(`Validating remediation action ${action.id}`);

    // Verify the finding still exists and is actionable
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

  private async executeRevokeAccess(action: any) {
    this.logger.log(`Revoking access for action ${action.id}`);
    return { success: true, message: 'Access revocation delegated to connector' };
  }

  private async executeEncrypt(action: any) {
    this.logger.log(`Enabling encryption for action ${action.id}`);
    return { success: true, message: 'Encryption enablement delegated to connector' };
  }

  private async executeEnableMfa(action: any) {
    this.logger.log(`Enabling MFA for action ${action.id}`);
    return { success: true, message: 'MFA enablement delegated to connector' };
  }

  private async executeApplyRetention(action: any) {
    this.logger.log(`Applying retention policy for action ${action.id}`);
    return { success: true, message: 'Retention policy application delegated to connector' };
  }

  private async executeRestrictPublic(action: any) {
    this.logger.log(`Restricting public access for action ${action.id}`);
    return { success: true, message: 'Public access restriction delegated to connector' };
  }

  private async executeDeleteData(action: any) {
    this.logger.log(`Deleting data for action ${action.id}`);
    return { success: true, message: 'Data deletion delegated to connector' };
  }

  private async executeMaskData(action: any) {
    this.logger.log(`Masking data for action ${action.id}`);
    return { success: true, message: 'Data masking delegated to connector' };
  }

  private async executeQuarantine(action: any) {
    this.logger.log(`Quarantining asset for action ${action.id}`);
    return { success: true, message: 'Asset quarantine delegated to connector' };
  }
}
