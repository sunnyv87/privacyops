import { Test } from '@nestjs/testing';
import { CryptoService } from '@/core/crypto/crypto.service';
import { KmsService } from '@/core/crypto/kms.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: KmsService,
          useValue: {
            generateDataKey: jest.fn().mockResolvedValue({
              plaintext: Buffer.alloc(32, 'a'),
              encrypted: Buffer.alloc(48, 'b'),
            }),
            unwrapDataKey: jest.fn().mockResolvedValue(Buffer.alloc(32, 'a')),
          },
        },
      ],
    }).compile();

    service = module.get(CryptoService);
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string', async () => {
      const plaintext = 'Hello, sensitive data!';
      const encrypted = await service.encrypt(plaintext, 'tenant-key-1');

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // format: iv:authTag:wrappedKey:ciphertext

      const decrypted = await service.decrypt(encrypted, 'tenant-key-1');
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', async () => {
      const plaintext = 'Same data';
      const encrypted1 = await service.encrypt(plaintext, 'key-1');
      const encrypted2 = await service.encrypt(plaintext, 'key-1');
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', async () => {
      const encrypted = await service.encrypt('', 'key-1');
      const decrypted = await service.decrypt(encrypted, 'key-1');
      expect(decrypted).toBe('');
    });

    it('should handle unicode text', async () => {
      const plaintext = '日本語テスト 🔐';
      const encrypted = await service.encrypt(plaintext, 'key-1');
      const decrypted = await service.decrypt(encrypted, 'key-1');
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptJson/decryptJson', () => {
    it('should encrypt and decrypt a JSON object', async () => {
      const data = { name: 'Test User', email: 'test@example.com', nested: { key: 'value' } };
      const encrypted = await service.encryptJson(data, 'key-1');

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('Test User');

      const decrypted = await service.decryptJson(encrypted, 'key-1');
      expect(decrypted).toEqual(data);
    });
  });

  describe('hash', () => {
    it('should produce consistent SHA-256 hash', () => {
      const hash1 = service.hash('test@example.com');
      const hash2 = service.hash('test@example.com');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hash('test1@example.com');
      const hash2 = service.hash('test2@example.com');
      expect(hash1).not.toBe(hash2);
    });
  });
});
