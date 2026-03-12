import { RiskScorer, RiskScoringInput } from '../../../src/modules/dspm/engine/risk-scorer';

describe('RiskScorer', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer();
  });

  // ─── Core score() ──────────────────────────────────────────────────────────

  describe('score', () => {
    it('should return critical severity for publicly accessible sensitive data', () => {
      const result = scorer.score({
        sensitivityLevel: 5,
        isPubliclyAccessible: true,
        isCrossAccountAccessible: false,
        principalCount: 0,
        hasEncryption: false,
        hasMfa: false,
        rowCount: 1_500_000,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(result.severity).toBe('critical');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.factors).toContain('Publicly accessible');
      expect(result.factors).toContain('No encryption, no MFA');
      expect(result.factors).toContain('Large dataset (>1M records)');
    });

    it('should return info severity for properly secured low-sensitivity data', () => {
      const result = scorer.score({
        sensitivityLevel: 1,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 3,
        hasEncryption: true,
        hasMfa: true,
        rowCount: 100,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(result.severity).toBe('info');
      expect(result.score).toBeLessThan(20);
      expect(result.factors).toHaveLength(0);
    });

    it('should include stale data as a risk factor', () => {
      const result = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 5,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 50_000,
        isStale: true,
        hasRetentionPolicy: false,
      });

      expect(result.factors).toContain('Stale data (not accessed in >90 days)');
      expect(result.factors).toContain('No retention policy applied');
    });

    it('should score higher for cross-account access', () => {
      const baseInput: RiskScoringInput = {
        sensitivityLevel: 4,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 3,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 10_000,
        isStale: false,
        hasRetentionPolicy: true,
      };

      const baseResult = scorer.score(baseInput);
      const crossAccountResult = scorer.score({ ...baseInput, isCrossAccountAccessible: true });

      expect(crossAccountResult.score).toBeGreaterThan(baseResult.score);
    });

    it('should cap score at 100', () => {
      const result = scorer.score({
        sensitivityLevel: 5,
        isPubliclyAccessible: true,
        isCrossAccountAccessible: true,
        principalCount: 100,
        hasEncryption: false,
        hasMfa: false,
        rowCount: 10_000_000,
        isStale: true,
        hasRetentionPolicy: false,
      });

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.severity).toBe('critical');
    });

    it('should add +5 for stale data and +3 for no retention to adjusted score', () => {
      const withRetention = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 5,
        hasEncryption: false,
        hasMfa: false,
        rowCount: 1000,
        isStale: false,
        hasRetentionPolicy: true,
      });

      const withoutRetentionAndStale = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 5,
        hasEncryption: false,
        hasMfa: false,
        rowCount: 1000,
        isStale: true,
        hasRetentionPolicy: false,
      });

      expect(withoutRetentionAndStale.score - withRetention.score).toBe(8);
    });

    it('should report overly permissive access for >10 principals', () => {
      const result = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 15,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 1000,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(result.factors.some(f => f.includes('Overly permissive'))).toBe(true);
      expect(result.breakdown.exposureScore).toBe(0.5);
    });

    it('should map each sensitivity level to correct sensitivity score', () => {
      const expected: Record<number, number> = { 1: 0.1, 2: 0.3, 3: 0.6, 4: 0.8, 5: 1.0 };

      for (const [level, expectedScore] of Object.entries(expected)) {
        const result = scorer.score({
          sensitivityLevel: Number(level),
          isPubliclyAccessible: false,
          isCrossAccountAccessible: false,
          principalCount: 0,
          hasEncryption: true,
          hasMfa: true,
          rowCount: 100,
          isStale: false,
          hasRetentionPolicy: true,
        });

        expect(result.breakdown.sensitivityScore).toBe(expectedScore);
      }
    });

    it('should return medium volume modifier for 100K-1M records', () => {
      const result = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 5,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 500_000,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(result.breakdown.volumeModifier).toBe(1.3);
      expect(result.factors).toContain('Medium dataset (>100K records)');
    });
  });

  // ─── Severity thresholds ──────────────────────────────────────────────────

  describe('severity thresholds', () => {
    it.each([
      [80, 'critical'],
      [79, 'high'],
      [60, 'high'],
      [59, 'medium'],
      [40, 'medium'],
      [39, 'low'],
      [20, 'low'],
      [19, 'info'],
      [0, 'info'],
    ])('score %i should be %s severity', (score, expected) => {
      // We test indirectly via the private method through score() outcomes
      // For precise testing, we construct inputs targeting specific scores
      const scorer2 = new RiskScorer();
      const result = (scorer2 as any).scoreToSeverity(score);
      expect(result).toBe(expected);
    });
  });

  // ─── vendorExposureScore ──────────────────────────────────────────────────

  describe('vendorExposureScore', () => {
    it('should return 0 for no vendors', () => {
      expect(scorer.vendorExposureScore({ vendorCount: 0, highRiskVendors: 0, dataSharedTypes: 0 })).toBe(0);
    });

    it('should max out at 25', () => {
      expect(scorer.vendorExposureScore({ vendorCount: 50, highRiskVendors: 10, dataSharedTypes: 20 })).toBe(25);
    });

    it('should score higher for more high-risk vendors', () => {
      const low = scorer.vendorExposureScore({ vendorCount: 5, highRiskVendors: 0, dataSharedTypes: 2 });
      const high = scorer.vendorExposureScore({ vendorCount: 5, highRiskVendors: 5, dataSharedTypes: 2 });
      expect(high).toBeGreaterThan(low);
    });
  });

  // ─── aiUsageScore ─────────────────────────────────────────────────────────

  describe('aiUsageScore', () => {
    it('should return 0 for non-AI datasets', () => {
      expect(scorer.aiUsageScore({ isAiDataset: false, hasConsent: false, modelCount: 0 })).toBe(0);
    });

    it('should add penalty for AI dataset without consent', () => {
      const withConsent = scorer.aiUsageScore({ isAiDataset: true, hasConsent: true, modelCount: 1 });
      const withoutConsent = scorer.aiUsageScore({ isAiDataset: true, hasConsent: false, modelCount: 1 });
      expect(withoutConsent).toBeGreaterThan(withConsent);
    });

    it('should cap at 20', () => {
      expect(scorer.aiUsageScore({ isAiDataset: true, hasConsent: false, modelCount: 100 })).toBe(20);
    });
  });

  // ─── identityAccessScore ──────────────────────────────────────────────────

  describe('identityAccessScore', () => {
    it('should give maximum score for public access with excessive permissions', () => {
      const result = scorer.identityAccessScore({
        principalCount: 100,
        publicAccess: true,
        excessivePermissions: 20,
        inactiveAccess: 20,
      });
      expect(result).toBe(25);
    });

    it('should return 0 for no access issues', () => {
      const result = scorer.identityAccessScore({
        principalCount: 2,
        publicAccess: false,
        excessivePermissions: 0,
        inactiveAccess: 0,
      });
      expect(result).toBe(0);
    });
  });

  // ─── retentionViolationScore ──────────────────────────────────────────────

  describe('retentionViolationScore', () => {
    it('should return 0 for compliant data', () => {
      expect(scorer.retentionViolationScore({ hasPolicy: true, isOverdue: false, daysPastExpiry: 0 })).toBe(0);
    });

    it('should cap at 15', () => {
      expect(scorer.retentionViolationScore({ hasPolicy: false, isOverdue: true, daysPastExpiry: 999 })).toBe(15);
    });

    it('should increase score with days past expiry', () => {
      const recent = scorer.retentionViolationScore({ hasPolicy: true, isOverdue: true, daysPastExpiry: 10 });
      const old = scorer.retentionViolationScore({ hasPolicy: true, isOverdue: true, daysPastExpiry: 400 });
      expect(old).toBeGreaterThan(recent);
    });
  });

  // ─── securityMisconfigScore ───────────────────────────────────────────────

  describe('securityMisconfigScore', () => {
    it('should return 0 for secure config', () => {
      expect(scorer.securityMisconfigScore({
        unencrypted: false,
        publiclyAccessible: false,
        noMfa: false,
        noAuditTrail: false,
      })).toBe(0);
    });

    it('should cap at 15', () => {
      expect(scorer.securityMisconfigScore({
        unencrypted: true,
        publiclyAccessible: true,
        noMfa: true,
        noAuditTrail: true,
      })).toBe(15);
    });

    it('should sum individual misconfig scores', () => {
      expect(scorer.securityMisconfigScore({
        unencrypted: true,
        publiclyAccessible: false,
        noMfa: false,
        noAuditTrail: false,
      })).toBe(4);

      expect(scorer.securityMisconfigScore({
        unencrypted: false,
        publiclyAccessible: true,
        noMfa: false,
        noAuditTrail: false,
      })).toBe(5);
    });
  });
});
