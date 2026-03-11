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
