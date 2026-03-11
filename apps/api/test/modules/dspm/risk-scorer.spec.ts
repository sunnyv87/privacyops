import { RiskScorer, RiskScoringInput } from '../../../src/modules/dspm/engine/risk-scorer';

describe('RiskScorer', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer();
  });

  it('should return critical severity for publicly accessible sensitive data', () => {
    const input: RiskScoringInput = {
      sensitivityLevel: 5,
      isPubliclyAccessible: true,
      isCrossAccountAccessible: false,
      principalCount: 0,
      hasEncryption: false,
      hasMfa: false,
      rowCount: 1_500_000,
      isStale: false,
      hasRetentionPolicy: true,
    };

    const result = scorer.score(input);

    expect(result.severity).toBe('critical');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.factors).toContain('Publicly accessible');
    expect(result.factors).toContain('No encryption, no MFA');
    expect(result.factors).toContain('Large dataset (>1M records)');
  });

  it('should return low severity for properly secured low-sensitivity data', () => {
    const input: RiskScoringInput = {
      sensitivityLevel: 1,
      isPubliclyAccessible: false,
      isCrossAccountAccessible: false,
      principalCount: 3,
      hasEncryption: true,
      hasMfa: true,
      rowCount: 100,
      isStale: false,
      hasRetentionPolicy: true,
    };

    const result = scorer.score(input);

    expect(result.severity).toBe('info');
    expect(result.score).toBeLessThan(20);
    expect(result.factors).toHaveLength(0);
  });

  it('should include stale data as a risk factor', () => {
    const input: RiskScoringInput = {
      sensitivityLevel: 3,
      isPubliclyAccessible: false,
      isCrossAccountAccessible: false,
      principalCount: 5,
      hasEncryption: true,
      hasMfa: false,
      rowCount: 50_000,
      isStale: true,
      hasRetentionPolicy: false,
    };

    const result = scorer.score(input);

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
    const crossAccountResult = scorer.score({
      ...baseInput,
      isCrossAccountAccessible: true,
    });

    expect(crossAccountResult.score).toBeGreaterThan(baseResult.score);
  });

  it('should cap score at 100', () => {
    const input: RiskScoringInput = {
      sensitivityLevel: 5,
      isPubliclyAccessible: true,
      isCrossAccountAccessible: true,
      principalCount: 100,
      hasEncryption: false,
      hasMfa: false,
      rowCount: 10_000_000,
      isStale: true,
      hasRetentionPolicy: false,
    };

    const result = scorer.score(input);

    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.severity).toBe('critical');
  });
});
