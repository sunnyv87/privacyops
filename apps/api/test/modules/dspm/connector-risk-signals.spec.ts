import { RiskScorer } from '@/modules/dspm/engine/risk-scorer';

describe('RiskScorer — Connector-category sub-scores', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer();
  });

  describe('saasExposureScore', () => {
    it('should return 0 for no exposure', () => {
      const score = scorer.saasExposureScore({
        externalSharingCount: 0,
        publicLinkCount: 0,
        crossOrgAccessCount: 0,
      });
      expect(score).toBe(0);
    });

    it('should score public links up to cap', () => {
      const score = scorer.saasExposureScore({
        externalSharingCount: 0,
        publicLinkCount: 5,
        crossOrgAccessCount: 0,
      });
      expect(score).toBe(10); // min(10, 5 * 3) = 10 (capped)
    });

    it('should score high external sharing', () => {
      const score = scorer.saasExposureScore({
        externalSharingCount: 15,
        publicLinkCount: 0,
        crossOrgAccessCount: 0,
      });
      expect(score).toBe(8);
    });

    it('should score cross-org access', () => {
      const score = scorer.saasExposureScore({
        externalSharingCount: 0,
        publicLinkCount: 0,
        crossOrgAccessCount: 10,
      });
      expect(score).toBe(7);
    });

    it('should combine all factors and cap at 25', () => {
      const score = scorer.saasExposureScore({
        externalSharingCount: 15,
        publicLinkCount: 5,
        crossOrgAccessCount: 10,
      });
      expect(score).toBe(25);
    });
  });

  describe('devopsExposureScore', () => {
    it('should return 0 for no exposure', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 0,
        reposWithoutBranchProtection: 0,
        secretScanningFindings: 0,
      });
      expect(score).toBe(0);
    });

    it('should score public repos', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 2,
        reposWithoutBranchProtection: 0,
        secretScanningFindings: 0,
      });
      expect(score).toBe(8); // min(10, 2 * 4)
    });

    it('should score repos without branch protection', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 0,
        reposWithoutBranchProtection: 3,
        secretScanningFindings: 0,
      });
      expect(score).toBe(2);
    });

    it('should score high repo count without protection', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 0,
        reposWithoutBranchProtection: 10,
        secretScanningFindings: 0,
      });
      expect(score).toBe(5);
    });

    it('should score secret scanning findings', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 0,
        reposWithoutBranchProtection: 0,
        secretScanningFindings: 15,
      });
      expect(score).toBe(10);
    });

    it('should combine all factors and cap at 25', () => {
      const score = scorer.devopsExposureScore({
        publicRepoCount: 5,
        reposWithoutBranchProtection: 10,
        secretScanningFindings: 20,
      });
      expect(score).toBe(25);
    });
  });

  describe('identityProviderRiskScore', () => {
    it('should return 0 for no risk', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 0,
        crossSystemExcessiveCount: 0,
        orphanedServiceAccounts: 0,
      });
      expect(score).toBe(0);
    });

    it('should score deprovisioned users with access', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 2,
        crossSystemExcessiveCount: 0,
        orphanedServiceAccounts: 0,
      });
      expect(score).toBe(10); // min(10, 2 * 5)
    });

    it('should score cross-system excessive permissions', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 0,
        crossSystemExcessiveCount: 15,
        orphanedServiceAccounts: 0,
      });
      expect(score).toBe(8);
    });

    it('should score orphaned service accounts', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 0,
        crossSystemExcessiveCount: 0,
        orphanedServiceAccounts: 3,
      });
      expect(score).toBe(3);
    });

    it('should score high orphaned service accounts', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 0,
        crossSystemExcessiveCount: 0,
        orphanedServiceAccounts: 10,
      });
      expect(score).toBe(7);
    });

    it('should combine all factors and cap at 25', () => {
      const score = scorer.identityProviderRiskScore({
        deprovisionedWithAccess: 3,
        crossSystemExcessiveCount: 15,
        orphanedServiceAccounts: 10,
      });
      expect(score).toBe(25);
    });
  });

  describe('score integration — existing scorer remains functional', () => {
    it('should still produce correct base risk scores', () => {
      const result = scorer.score({
        sensitivityLevel: 5,
        isPubliclyAccessible: true,
        isCrossAccountAccessible: false,
        principalCount: 0,
        hasEncryption: false,
        hasMfa: false,
        rowCount: 2_000_000,
        isStale: true,
        hasRetentionPolicy: false,
      });

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.severity).toBe('critical');
      expect(result.factors).toContain('Publicly accessible');
      expect(result.factors).toContain('No encryption, no MFA');
      expect(result.factors).toContain('Large dataset (>1M records)');
    });

    it('should produce low risk for well-secured assets', () => {
      const result = scorer.score({
        sensitivityLevel: 1,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 2,
        hasEncryption: true,
        hasMfa: true,
        rowCount: 100,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(result.score).toBeLessThan(20);
      expect(result.severity).toBe('info');
    });

    it('should include stale and retention penalties', () => {
      const withPenalties = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 3,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 5000,
        isStale: true,
        hasRetentionPolicy: false,
      });

      const withoutPenalties = scorer.score({
        sensitivityLevel: 3,
        isPubliclyAccessible: false,
        isCrossAccountAccessible: false,
        principalCount: 3,
        hasEncryption: true,
        hasMfa: false,
        rowCount: 5000,
        isStale: false,
        hasRetentionPolicy: true,
      });

      expect(withPenalties.score).toBeGreaterThan(withoutPenalties.score);
    });
  });
});
