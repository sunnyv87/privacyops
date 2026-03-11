import {
  Classifier,
  ClassificationPattern,
} from '../../../src/modules/classification/engine/classifier';

describe('Classifier', () => {
  let classifier: Classifier;

  beforeEach(() => {
    classifier = new Classifier();
    classifier.loadPatterns(testPatterns);
  });

  it('should detect Aadhaar numbers with high confidence', () => {
    const results = classifier.classify({
      fieldName: 'aadhaar_number',
      dataType: 'varchar',
      sampleValues: ['9876 5432 1098', '2345 6789 0123', 'not-aadhaar'],
      tableName: 'customers',
    });

    expect(results.length).toBeGreaterThan(0);
    const aadhaarResult = results.find((r) => r.labelName === 'Aadhaar Number');
    expect(aadhaarResult).toBeDefined();
    expect(aadhaarResult!.confidence).toBeGreaterThan(0.5);
  });

  it('should detect email addresses via regex', () => {
    const results = classifier.classify({
      fieldName: 'contact_info',
      dataType: 'text',
      sampleValues: [
        'user@example.com',
        'admin@techd.com',
        'test@gmail.com',
        'not-an-email',
      ],
    });

    const emailResult = results.find((r) => r.labelName === 'Email Address');
    expect(emailResult).toBeDefined();
    expect(emailResult!.method).toBe('regex');
  });

  it('should detect PII via column name keywords', () => {
    const results = classifier.classify({
      fieldName: 'customer_email_address',
      dataType: 'varchar',
      sampleValues: [], // No sample values
    });

    const emailResult = results.find((r) => r.labelName === 'Email Address');
    expect(emailResult).toBeDefined();
    expect(emailResult!.method).toBe('dictionary');
  });

  it('should boost confidence when both regex and keyword match', () => {
    const results = classifier.classify({
      fieldName: 'email',
      dataType: 'varchar',
      sampleValues: ['user@example.com', 'admin@techd.com'],
    });

    const emailResult = results.find((r) => r.labelName === 'Email Address');
    expect(emailResult).toBeDefined();
    expect(emailResult!.confidence).toBeGreaterThan(0.8);
  });

  it('should detect toxic combinations', () => {
    const warnings = classifier.detectToxicCombinations([
      { labelName: 'Aadhaar Number', category: 'pii' },
      { labelName: 'Credit Card Number', category: 'pfi' },
    ]);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('TOXIC_COMBINATION'))).toBe(true);
  });

  it('should return empty warnings for safe combinations', () => {
    const warnings = classifier.detectToxicCombinations([
      { labelName: 'Full Name', category: 'pii' },
      { labelName: 'Email Address', category: 'pii' },
    ]);

    expect(warnings).toHaveLength(0);
  });
});

// Test patterns
const testPatterns: ClassificationPattern[] = [
  {
    labelId: 'label-aadhaar',
    labelName: 'Aadhaar Number',
    category: 'pii',
    sensitivityLevel: 5,
    regexPatterns: [/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/],
    keywords: ['aadhaar', 'aadhar', 'uid'],
  },
  {
    labelId: 'label-pan',
    labelName: 'PAN Number',
    category: 'pii',
    sensitivityLevel: 4,
    regexPatterns: [/\b[A-Z]{5}\d{4}[A-Z]\b/],
    keywords: ['pan', 'pan_number'],
  },
  {
    labelId: 'label-email',
    labelName: 'Email Address',
    category: 'pii',
    sensitivityLevel: 3,
    regexPatterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
    keywords: ['email', 'email_address', 'mail'],
  },
  {
    labelId: 'label-cc',
    labelName: 'Credit Card Number',
    category: 'pfi',
    sensitivityLevel: 5,
    regexPatterns: [/\b(?:\d{4}[\s-]?){3}\d{4}\b/],
    keywords: ['credit_card', 'card_number', 'cc_number'],
  },
  {
    labelId: 'label-name',
    labelName: 'Full Name',
    category: 'pii',
    sensitivityLevel: 2,
    regexPatterns: [],
    keywords: ['name', 'full_name', 'first_name', 'last_name', 'customer_name'],
  },
];
