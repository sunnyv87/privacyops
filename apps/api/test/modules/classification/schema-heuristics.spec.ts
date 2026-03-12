import { SchemaHeuristicsEngine } from '../../../src/modules/classification/engine/schema-heuristics';

describe('SchemaHeuristicsEngine', () => {
  let engine: SchemaHeuristicsEngine;

  beforeEach(() => {
    engine = new SchemaHeuristicsEngine();
  });

  describe('classifyByColumnName', () => {
    it('should detect email columns', () => {
      const result = engine.classifyByColumnName('email');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Email Address');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('should detect email_address columns', () => {
      const result = engine.classifyByColumnName('email_address');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Email Address');
    });

    it('should detect phone columns', () => {
      const result = engine.classifyByColumnName('phone');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Phone Number');
      expect(result!.confidence).toBe(0.95);
    });

    it('should detect mobile columns', () => {
      const result = engine.classifyByColumnName('mobile');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Phone Number');
    });

    it('should detect SSN columns', () => {
      const result = engine.classifyByColumnName('ssn');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('SSN');
      expect(result!.confidence).toBe(0.95);
    });

    it('should detect social_security_number columns', () => {
      const result = engine.classifyByColumnName('social_security_number');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('SSN');
    });

    it('should detect date_of_birth columns', () => {
      const result = engine.classifyByColumnName('date_of_birth');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Date of Birth');
    });

    it('should detect dob columns', () => {
      const result = engine.classifyByColumnName('dob');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Date of Birth');
    });

    it('should detect credit_card columns', () => {
      const result = engine.classifyByColumnName('credit_card_number');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Credit Card Number');
    });

    it('should detect password columns', () => {
      const result = engine.classifyByColumnName('password');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Password / Secret');
      expect(result!.confidence).toBe(0.95);
    });

    it('should detect api_key columns', () => {
      const result = engine.classifyByColumnName('api_key');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('API Key');
    });

    it('should detect aadhaar columns', () => {
      const result = engine.classifyByColumnName('aadhaar');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Aadhaar Number');
    });

    it('should detect salary columns', () => {
      const result = engine.classifyByColumnName('salary');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Salary');
    });

    it('should detect bank_account columns', () => {
      const result = engine.classifyByColumnName('bank_account_number');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Bank Account');
    });

    it('should detect full_name columns', () => {
      const result = engine.classifyByColumnName('full_name');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Full Name');
    });

    it('should detect ip_address columns', () => {
      const result = engine.classifyByColumnName('ip_address');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('IP Address');
    });

    it('should return null for non-sensitive columns', () => {
      expect(engine.classifyByColumnName('created_at')).toBeNull();
      expect(engine.classifyByColumnName('id')).toBeNull();
      expect(engine.classifyByColumnName('status')).toBeNull();
      expect(engine.classifyByColumnName('count')).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = engine.classifyByColumnName('EMAIL_ADDRESS');
      expect(result).not.toBeNull();
      expect(result!.labelName).toBe('Email Address');
    });

    it('should return the highest confidence match', () => {
      // 'email' matches both /^e[-_]?mail$/i (0.95) and /\bemail\b/i (0.80)
      const result = engine.classifyByColumnName('email');
      expect(result!.confidence).toBe(0.95);
    });
  });
});
