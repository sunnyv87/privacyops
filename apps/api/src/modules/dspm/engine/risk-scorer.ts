/**
 * DSPM Risk Scoring Engine
 *
 * Risk Score (0-100) = Data Sensitivity × Exposure × Access × Volume Modifier
 */

export interface RiskScoringInput {
  sensitivityLevel: number; // 1-5 (max classification sensitivity in asset)
  isPubliclyAccessible: boolean;
  isCrossAccountAccessible: boolean;
  principalCount: number; // Number of IAM principals with access
  hasEncryption: boolean;
  hasMfa: boolean;
  rowCount: number;
  isStale: boolean; // Not accessed in >90 days
  hasRetentionPolicy: boolean;
}

export interface RiskScoringResult {
  score: number; // 0-100
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  breakdown: {
    sensitivityScore: number;
    exposureScore: number;
    accessScore: number;
    volumeModifier: number;
  };
  factors: string[];
}

export class RiskScorer {
  score(input: RiskScoringInput): RiskScoringResult {
    const factors: string[] = [];

    // Data Sensitivity Score (0-1)
    const sensitivityMap: Record<number, number> = {
      5: 1.0,
      4: 0.8,
      3: 0.6,
      2: 0.3,
      1: 0.1,
    };
    const sensitivityScore = sensitivityMap[input.sensitivityLevel] || 0.1;

    if (input.sensitivityLevel >= 4) {
      factors.push(`High sensitivity data (level ${input.sensitivityLevel})`);
    }

    // Exposure Score (0-1)
    let exposureScore = 0.1;
    if (input.isPubliclyAccessible) {
      exposureScore = 1.0;
      factors.push('Publicly accessible');
    } else if (input.isCrossAccountAccessible) {
      exposureScore = 0.7;
      factors.push('Cross-account accessible');
    } else if (input.principalCount > 10) {
      exposureScore = 0.5;
      factors.push(`Overly permissive (${input.principalCount} principals)`);
    } else if (input.principalCount > 5) {
      exposureScore = 0.3;
    }

    // Access Score (0-1)
    let accessScore = 0.3; // Default: standard controls
    if (!input.hasEncryption && !input.hasMfa) {
      accessScore = 1.0;
      factors.push('No encryption, no MFA');
    } else if (!input.hasEncryption) {
      accessScore = 0.7;
      factors.push('No encryption at rest');
    } else if (input.hasEncryption && input.hasMfa) {
      accessScore = 0.1;
    }

    // Volume Modifier (1.0-1.5)
    let volumeModifier = 1.0;
    if (input.rowCount > 1_000_000) {
      volumeModifier = 1.5;
      factors.push('Large dataset (>1M records)');
    } else if (input.rowCount > 100_000) {
      volumeModifier = 1.3;
      factors.push('Medium dataset (>100K records)');
    } else if (input.rowCount > 10_000) {
      volumeModifier = 1.1;
    }

    // Additional risk factors
    if (input.isStale) {
      factors.push('Stale data (not accessed in >90 days)');
    }
    if (!input.hasRetentionPolicy) {
      factors.push('No retention policy applied');
    }

    // Calculate final score
    const baseScore =
      sensitivityScore * exposureScore * accessScore * volumeModifier;
    const score = Math.min(100, Math.round(baseScore * 100));

    // Stale data and missing retention add to score
    const adjustedScore = Math.min(
      100,
      score + (input.isStale ? 5 : 0) + (!input.hasRetentionPolicy ? 3 : 0),
    );

    return {
      score: adjustedScore,
      severity: this.scoreToSeverity(adjustedScore),
      breakdown: {
        sensitivityScore,
        exposureScore,
        accessScore,
        volumeModifier,
      },
      factors,
    };
  }

  vendorExposureScore(input: {
    vendorCount: number;
    highRiskVendors: number;
    dataSharedTypes: number;
  }): number {
    let score = 0;

    // Base score from vendor count (0-10)
    if (input.vendorCount > 20) score += 10;
    else if (input.vendorCount > 10) score += 7;
    else if (input.vendorCount > 5) score += 4;
    else if (input.vendorCount > 0) score += 2;

    // High-risk vendor penalty (0-10)
    if (input.highRiskVendors > 5) score += 10;
    else if (input.highRiskVendors > 2) score += 7;
    else if (input.highRiskVendors > 0) score += 4;

    // Data shared diversity (0-5)
    if (input.dataSharedTypes > 10) score += 5;
    else if (input.dataSharedTypes > 5) score += 3;
    else if (input.dataSharedTypes > 0) score += 1;

    return Math.min(25, score);
  }

  aiUsageScore(input: {
    isAiDataset: boolean;
    hasConsent: boolean;
    modelCount: number;
  }): number {
    let score = 0;

    if (input.isAiDataset) {
      score += 10;

      if (!input.hasConsent) {
        score += 6;
      }

      // Model exposure (0-4)
      if (input.modelCount > 5) score += 4;
      else if (input.modelCount > 2) score += 3;
      else if (input.modelCount > 0) score += 1;
    }

    return Math.min(20, score);
  }

  identityAccessScore(input: {
    principalCount: number;
    publicAccess: boolean;
    excessivePermissions: number;
    inactiveAccess: number;
  }): number {
    let score = 0;

    // Public access is maximum risk
    if (input.publicAccess) {
      score += 10;
    }

    // Principal count breadth (0-5)
    if (input.principalCount > 50) score += 5;
    else if (input.principalCount > 20) score += 4;
    else if (input.principalCount > 10) score += 3;
    else if (input.principalCount > 5) score += 2;

    // Excessive permissions (0-5)
    if (input.excessivePermissions > 10) score += 5;
    else if (input.excessivePermissions > 5) score += 4;
    else if (input.excessivePermissions > 0) score += 2;

    // Inactive access (0-5)
    if (input.inactiveAccess > 10) score += 5;
    else if (input.inactiveAccess > 5) score += 3;
    else if (input.inactiveAccess > 0) score += 1;

    return Math.min(25, score);
  }

  retentionViolationScore(input: {
    hasPolicy: boolean;
    isOverdue: boolean;
    daysPastExpiry: number;
  }): number {
    let score = 0;

    if (!input.hasPolicy) {
      score += 5;
    }

    if (input.isOverdue) {
      score += 5;

      if (input.daysPastExpiry > 365) score += 5;
      else if (input.daysPastExpiry > 90) score += 3;
      else if (input.daysPastExpiry > 30) score += 2;
    }

    return Math.min(15, score);
  }

  securityMisconfigScore(input: {
    unencrypted: boolean;
    publiclyAccessible: boolean;
    noMfa: boolean;
    noAuditTrail: boolean;
  }): number {
    let score = 0;

    if (input.unencrypted) score += 4;
    if (input.publiclyAccessible) score += 5;
    if (input.noMfa) score += 3;
    if (input.noAuditTrail) score += 3;

    return Math.min(15, score);
  }

  /**
   * SaaS/collaboration exposure score — external sharing, public links, cross-org access.
   */
  saasExposureScore(input: {
    externalSharingCount: number;
    publicLinkCount: number;
    crossOrgAccessCount: number;
  }): number {
    let score = 0;

    if (input.publicLinkCount > 0) score += Math.min(10, input.publicLinkCount * 3);
    if (input.externalSharingCount > 10) score += 8;
    else if (input.externalSharingCount > 0) score += Math.min(6, input.externalSharingCount * 2);
    if (input.crossOrgAccessCount > 5) score += 7;
    else if (input.crossOrgAccessCount > 0) score += 3;

    return Math.min(25, score);
  }

  /**
   * DevOps exposure score — public repos, branch protection, secret scanning.
   */
  devopsExposureScore(input: {
    publicRepoCount: number;
    reposWithoutBranchProtection: number;
    secretScanningFindings: number;
  }): number {
    let score = 0;

    if (input.publicRepoCount > 0) score += Math.min(10, input.publicRepoCount * 4);
    if (input.reposWithoutBranchProtection > 5) score += 5;
    else if (input.reposWithoutBranchProtection > 0) score += 2;
    if (input.secretScanningFindings > 10) score += 10;
    else if (input.secretScanningFindings > 0) score += Math.min(8, input.secretScanningFindings * 2);

    return Math.min(25, score);
  }

  /**
   * Identity provider risk score — deprovisioned users with active access, cross-system excessive permissions.
   */
  identityProviderRiskScore(input: {
    deprovisionedWithAccess: number;
    crossSystemExcessiveCount: number;
    orphanedServiceAccounts: number;
  }): number {
    let score = 0;

    if (input.deprovisionedWithAccess > 0) score += Math.min(10, input.deprovisionedWithAccess * 5);
    if (input.crossSystemExcessiveCount > 10) score += 8;
    else if (input.crossSystemExcessiveCount > 0) score += Math.min(6, input.crossSystemExcessiveCount);
    if (input.orphanedServiceAccounts > 5) score += 7;
    else if (input.orphanedServiceAccounts > 0) score += 3;

    return Math.min(25, score);
  }

  private scoreToSeverity(
    score: number,
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'info';
  }
}
