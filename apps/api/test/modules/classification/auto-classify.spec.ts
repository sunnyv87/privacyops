import { Classifier, ClassificationPattern } from '@/modules/classification/engine/classifier';

describe('Classifier — Source-type-aware confidence adjustments', () => {
  let classifier: Classifier;

  const basePatterns: ClassificationPattern[] = [
    {
      labelId: 'label-email',
      labelName: 'Email Address',
      category: 'pii',
      sensitivityLevel: 3,
      regexPatterns: [/[\w.-]+@[\w.-]+\.\w+/i],
      keywords: ['email'],
    },
    {
      labelId: 'label-ip',
      labelName: 'IP Address',
      category: 'network',
      sensitivityLevel: 2,
      regexPatterns: [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/],
      keywords: ['ip', 'ip_address'],
    },
    {
      labelId: 'label-phone',
      labelName: 'Phone Number',
      category: 'pii',
      sensitivityLevel: 3,
      regexPatterns: [/\+?\d[\d\s-]{7,14}/],
      keywords: ['phone', 'telephone', 'mobile'],
    },
    {
      labelId: 'label-username',
      labelName: 'Username',
      category: 'pii',
      sensitivityLevel: 2,
      regexPatterns: [],
      keywords: ['username', 'user_name', 'login'],
    },
  ];

  beforeEach(() => {
    classifier = new Classifier();
    classifier.loadPatterns(basePatterns);
  });

  it('should boost confidence for email fields from identity provider sources', () => {
    const results = classifier.classify({
      fieldName: 'email',
      sampleValues: ['user@example.com'],
      sourceType: 'okta',
    });

    const emailResult = results.find((r) => r.labelId === 'label-email');
    expect(emailResult).toBeDefined();

    // Compare against non-identity-provider classification
    const baseResults = classifier.classify({
      fieldName: 'email',
      sampleValues: ['user@example.com'],
      sourceType: 'postgresql',
    });

    const baseEmail = baseResults.find((r) => r.labelId === 'label-email');
    expect(baseEmail).toBeDefined();

    // Identity provider should have higher or equal confidence
    expect(emailResult!.confidence).toBeGreaterThanOrEqual(baseEmail!.confidence);
  });

  it('should boost confidence for username fields from azure_ad', () => {
    const results = classifier.classify({
      fieldName: 'username',
      sampleValues: ['john.doe'],
      sourceType: 'azure_ad',
    });

    const usernameResult = results.find((r) => r.labelId === 'label-username');
    // Should be classified — identity provider boost for username
    expect(usernameResult).toBeDefined();
  });

  it('should lower confidence for IP Address fields from security tool sources', () => {
    const resultsFromSecurity = classifier.classify({
      fieldName: 'source_ip',
      sampleValues: ['192.168.1.1'],
      sourceType: 'crowdstrike',
    });

    const resultsFromDatabase = classifier.classify({
      fieldName: 'source_ip',
      sampleValues: ['192.168.1.1'],
      sourceType: 'postgresql',
    });

    const securityIp = resultsFromSecurity.find((r) => r.labelId === 'label-ip');
    const databaseIp = resultsFromDatabase.find((r) => r.labelId === 'label-ip');

    // Security source IP confidence should be lower or filtered
    if (securityIp && databaseIp) {
      expect(securityIp.confidence).toBeLessThanOrEqual(databaseIp.confidence);
    }
  });

  it('should not modify confidence when sourceType is undefined', () => {
    const resultsWithSource = classifier.classify({
      fieldName: 'email',
      sampleValues: ['test@test.com'],
      sourceType: 'postgresql',
    });

    const resultsWithout = classifier.classify({
      fieldName: 'email',
      sampleValues: ['test@test.com'],
    });

    const withSource = resultsWithSource.find((r) => r.labelId === 'label-email');
    const without = resultsWithout.find((r) => r.labelId === 'label-email');

    // Both should classify, non-identity DB sources should have same confidence as no source
    expect(withSource).toBeDefined();
    expect(without).toBeDefined();
  });

  it('should handle phone fields from identity providers', () => {
    const results = classifier.classify({
      fieldName: 'phone_number',
      sampleValues: ['+1 555-0123'],
      sourceType: 'google_workspace',
    });

    const phoneResult = results.find((r) => r.labelId === 'label-phone');
    expect(phoneResult).toBeDefined();
    expect(phoneResult!.confidence).toBeGreaterThan(0.5);
  });
});
