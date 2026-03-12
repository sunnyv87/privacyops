import { SchemaHeuristicsEngine } from '../../../src/modules/classification/engine/schema-heuristics';

describe('SchemaHeuristicsEngine', () => {
  let engine: SchemaHeuristicsEngine;

  beforeEach(() => {
    engine = new SchemaHeuristicsEngine();
  });

  describe('classifyByColumnName', () => {
    // ─── Email patterns ──────────────────────────────────────────────────
    it.each([
      ['email', 'Email Address', 0.95],
      ['e-mail', 'Email Address', 0.95],
      ['email_addr', 'Email Address', 0.90],
      ['EMAIL_ADDRESS', 'Email Address', 0.80],
    ])('should classify "%s" as %s with confidence >= %f', (name, label, minConfidence) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
      expect(result!.confidence).toBeGreaterThanOrEqual(minConfidence);
    });

    // ─── Phone patterns ─────────────────────────────────────────────────
    it.each([
      ['phone', 'Phone Number', 0.95],
      ['phone_number', 'Phone Number', 0.90],
      ['mobile', 'Phone Number', 0.80],
      ['cell_phone', 'Phone Number', 0.85],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── SSN patterns ───────────────────────────────────────────────────
    it.each([
      ['ssn', 'SSN', 0.95],
      ['social_security_number', 'SSN', 0.95],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Date of Birth ──────────────────────────────────────────────────
    it.each([
      ['dob', 'Date of Birth'],
      ['date_of_birth', 'Date of Birth'],
      ['birth_date', 'Date of Birth'],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Financial patterns ─────────────────────────────────────────────
    it.each([
      ['credit_card_number', 'Credit Card Number'],
      ['cc_num', 'Credit Card Number'],
      ['salary', 'Salary'],
      ['compensation', 'Salary'],
      ['bank_account_number', 'Bank Account'],
      ['routing_number', 'Bank Routing Number'],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Credential patterns ────────────────────────────────────────────
    it.each([
      ['password', 'Password / Secret', 0.95],
      ['passwd', 'Password / Secret', 0.90],
      ['pwd', 'Password / Secret', 0.80],
      ['secret', 'Password / Secret', 0.80],
      ['api_key', 'API Key', 0.95],
      ['access_key', 'API Key', 0.90],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── India-specific PII ─────────────────────────────────────────────
    it.each([
      ['aadhaar', 'Aadhaar Number'],
      ['pan_number', 'PAN Number'],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Identity fields ────────────────────────────────────────────────
    it.each([
      ['full_name', 'Full Name'],
      ['first_name', 'Full Name'],
      ['last_name', 'Full Name'],
      ['ip_address', 'IP Address'],
      ['gender', 'Gender'],
      ['ethnicity', 'Ethnicity'],
      ['passport', 'Passport Number'],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Health data ────────────────────────────────────────────────────
    it.each([
      ['diagnosis_code', 'Medical Diagnosis'],
      ['medical_record', 'Medical Record'],
    ])('should classify "%s" as %s', (name, label) => {
      const result = engine.classifyByColumnName(name);
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe(label);
    });

    // ─── Non-sensitive fields ───────────────────────────────────────────
    it.each([
      'id',
      'created_at',
      'updated_at',
      'is_active',
      'count',
      'total',
      'status',
      'description',
      'version',
    ])('should return null for non-sensitive column "%s"', (name) => {
      const result = engine.classifyByColumnName(name);
      expect(result).toBeNull();
    });

    // ─── Edge cases ─────────────────────────────────────────────────────
    it('should handle whitespace in column names', () => {
      const result = engine.classifyByColumnName('  email  ');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Email Address');
    });

    it('should pick highest confidence when multiple patterns match', () => {
      const result = engine.classifyByColumnName('email');
      expect(result!.confidence).toBe(0.95);
    });

    it('should be case-insensitive', () => {
      const result = engine.classifyByColumnName('EMAIL');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Email Address');
    });
  });
});
