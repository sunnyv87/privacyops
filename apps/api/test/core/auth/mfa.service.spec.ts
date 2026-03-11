import { MfaService } from '@/core/auth/services/mfa.service';

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(() => {
    service = new MfaService();
  });

  describe('generateSecret', () => {
    it('should generate a TOTP secret and QR code', async () => {
      const result = await service.generateSecret('user@example.com');

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(10);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('user@example.com');
      expect(result.qrCodeDataUrl).toContain('data:image/png;base64');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', () => {
      // Generate a secret and immediately verify
      // Note: In a real test environment we'd use a time-locked TOTP generator
      const { authenticator } = require('otplib');
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);

      const result = service.verifyToken(secret, token);
      expect(result).toBe(true);
    });

    it('should reject an invalid TOTP token', () => {
      const { authenticator } = require('otplib');
      const secret = authenticator.generateSecret();

      const result = service.verifyToken(secret, '000000');
      expect(result).toBe(false);
    });
  });

  describe('generateRecoveryCodes', () => {
    it('should generate 8 unique recovery codes', () => {
      const codes = service.generateRecoveryCodes();

      expect(codes).toHaveLength(8);
      const unique = new Set(codes);
      expect(unique.size).toBe(8);
      codes.forEach((code) => {
        expect(code).toMatch(/^[a-f0-9]+-[a-f0-9]+$/);
      });
    });
  });

  describe('verifyRecoveryCode', () => {
    it('should verify a valid recovery code and remove it', () => {
      const codes = service.generateRecoveryCodes();
      const codeToUse = codes[0];

      const result = service.verifyRecoveryCode(codes, codeToUse);
      expect(result.valid).toBe(true);
      expect(result.remaining).toHaveLength(7);
      expect(result.remaining).not.toContain(codeToUse);
    });

    it('should reject an invalid recovery code', () => {
      const codes = service.generateRecoveryCodes();

      const result = service.verifyRecoveryCode(codes, 'invalid-code');
      expect(result.valid).toBe(false);
      expect(result.remaining).toHaveLength(8);
    });
  });
});
