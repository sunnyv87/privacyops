import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { KmsService } from './kms.service';

/**
 * Field-level encryption service using AES-256-GCM with envelope encryption.
 *
 * Envelope encryption flow:
 * 1. Generate a random 32-byte data encryption key (DEK)
 * 2. Encrypt the plaintext with the DEK using AES-256-GCM
 * 3. Encrypt (wrap) the DEK with the tenant's master key via KMS
 * 4. Store the wrapped DEK alongside the ciphertext
 *
 * Output format (base64-encoded parts separated by colons):
 *   {iv}:{authTag}:{encryptedDataKey}:{ciphertext}
 */
@Injectable()
export class CryptoService {
  constructor(private readonly kms: KmsService) {}

  /**
   * Encrypt a plaintext string using envelope encryption.
   * Returns base64-encoded: {iv}:{authTag}:{encryptedDataKey}:{ciphertext}
   */
  async encrypt(plaintext: string, tenantKeyId: string): Promise<string> {
    // Generate a fresh data encryption key for this operation
    const { plaintext: dataKey, encrypted: wrappedDataKey } =
      await this.kms.generateDataKey(tenantKeyId);

    // Encrypt the data with AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Zero out the plaintext data key from memory
    dataKey.fill(0);

    // Encode as colon-separated base64 parts
    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      wrappedDataKey.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a ciphertext string produced by encrypt().
   * Parses the colon-separated format, unwraps the data key via KMS, then decrypts.
   */
  async decrypt(ciphertext: string, tenantKeyId: string): Promise<string> {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error(
        'Invalid ciphertext format: expected iv:authTag:wrappedKey:ciphertext',
      );
    }

    const [ivB64, authTagB64, wrappedKeyB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const wrappedDataKey = Buffer.from(wrappedKeyB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    // Unwrap the data key via KMS
    const dataKey = await this.kms.unwrapDataKey(wrappedDataKey, tenantKeyId);

    // Decrypt the data
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Zero out the data key from memory
    dataKey.fill(0);

    return decrypted.toString('utf8');
  }

  /**
   * Encrypt a JSON-serializable value. Convenience wrapper around encrypt().
   */
  async encryptJson(data: any, tenantKeyId: string): Promise<string> {
    const json = JSON.stringify(data);
    return this.encrypt(json, tenantKeyId);
  }

  /**
   * Decrypt a ciphertext and parse the result as JSON.
   */
  async decryptJson(ciphertext: string, tenantKeyId: string): Promise<any> {
    const json = await this.decrypt(ciphertext, tenantKeyId);
    return JSON.parse(json);
  }

  /**
   * Deterministic encryption for searchable fields (e.g., email lookup).
   * Uses AES-256-SIV (implemented via AES-256-GCM with a deterministic IV
   * derived from HMAC of the plaintext).
   *
   * WARNING: Deterministic encryption leaks equality — two identical plaintexts
   * produce identical ciphertexts. Only use for searchable index values.
   */
  encryptDeterministic(plaintext: string, key: Buffer): string {
    // Derive a deterministic IV from HMAC(key, plaintext)
    // This provides SIV-like semantics: same input always produces same output
    const ivFull = crypto
      .createHmac('sha256', key)
      .update(plaintext, 'utf8')
      .digest();
    const iv = ivFull.subarray(0, 12); // Use first 12 bytes as GCM nonce

    // Derive separate encryption key to avoid reusing the same key for HMAC and cipher
    const encKey = crypto
      .createHmac('sha256', key)
      .update('deterministic-enc-key')
      .digest();

    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Non-reversible SHA-256 hash. Use for fields that need lookup but never decryption.
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
