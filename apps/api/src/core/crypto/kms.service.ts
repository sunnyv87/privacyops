import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private localMasterKey: Buffer | null = null;
  private kmsClient: any = null;
  private kmsKeyArn: string | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.kmsKeyArn = this.config.get<string>('KMS_KEY_ARN') || null;

    if (this.kmsKeyArn) {
      await this.initAwsKms();
    } else {
      this.initLocalMasterKey();
    }
  }

  private async initAwsKms(): Promise<void> {
    try {
      // Dynamic import to avoid requiring @aws-sdk/client-kms in dev
      const { KMSClient } = await import('@aws-sdk/client-kms');
      this.kmsClient = new KMSClient({
        region: this.config.get<string>('S3_REGION', 'ap-south-1'),
      });
      this.logger.log('AWS KMS client initialized');
    } catch (err) {
      this.logger.error(
        'Failed to initialize AWS KMS client. Falling back to local master key.',
        err,
      );
      this.initLocalMasterKey();
    }
  }

  private initLocalMasterKey(): void {
    const masterKeyHex = this.config.get<string>('ENCRYPTION_MASTER_KEY');

    if (masterKeyHex) {
      this.localMasterKey = Buffer.from(masterKeyHex, 'hex');
      if (this.localMasterKey.length !== 32) {
        throw new Error(
          'ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes)',
        );
      }
      this.logger.log('Local master key loaded from ENCRYPTION_MASTER_KEY');
    } else {
      const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        throw new Error(
          'ENCRYPTION_MASTER_KEY or KMS_KEY_ARN must be set in production',
        );
      }
      // Generate a deterministic dev key (not safe for production)
      this.localMasterKey = crypto
        .createHash('sha256')
        .update('privacyops-dev-master-key-not-for-production')
        .digest();
      this.logger.warn(
        'Using generated dev master key. Set ENCRYPTION_MASTER_KEY for persistent encryption.',
      );
    }
  }

  /**
   * Derives a per-tenant key from the master key using HKDF.
   */
  private async deriveTenantKey(keyId: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      crypto.hkdf(
        'sha256',
        this.localMasterKey!,
        Buffer.from(keyId, 'utf8'), // salt = tenantKeyId
        Buffer.from('privacyops-tenant-dek', 'utf8'), // info
        32, // 256-bit key
        (err, derivedKey) => {
          if (err) return reject(err);
          resolve(Buffer.from(derivedKey));
        },
      );
    });
  }

  /**
   * Generates a new data encryption key.
   * Returns both the plaintext key and the encrypted (wrapped) version.
   */
  async generateDataKey(
    keyId: string,
  ): Promise<{ plaintext: Buffer; encrypted: Buffer }> {
    const plaintext = crypto.randomBytes(32);
    const encrypted = await this.wrapDataKey(plaintext, keyId);
    return { plaintext, encrypted };
  }

  /**
   * Encrypts (wraps) a data key using the master key.
   */
  async wrapDataKey(dataKey: Buffer, keyId: string): Promise<Buffer> {
    if (this.kmsClient && this.kmsKeyArn) {
      return this.wrapWithAwsKms(dataKey, keyId);
    }
    return this.wrapWithLocalKey(dataKey, keyId);
  }

  /**
   * Decrypts (unwraps) a data key using the master key.
   */
  async unwrapDataKey(wrappedKey: Buffer, keyId: string): Promise<Buffer> {
    if (this.kmsClient && this.kmsKeyArn) {
      return this.unwrapWithAwsKms(wrappedKey, keyId);
    }
    return this.unwrapWithLocalKey(wrappedKey, keyId);
  }

  // ── AWS KMS implementation ──────────────────────────────────────

  private async wrapWithAwsKms(
    dataKey: Buffer,
    _keyId: string,
  ): Promise<Buffer> {
    const { EncryptCommand } = await import('@aws-sdk/client-kms');
    const command = new EncryptCommand({
      KeyId: this.kmsKeyArn!,
      Plaintext: new Uint8Array(dataKey),
      EncryptionContext: { tenantKeyId: _keyId },
    });
    const response = await this.kmsClient.send(command);
    return Buffer.from(response.CiphertextBlob!);
  }

  private async unwrapWithAwsKms(
    wrappedKey: Buffer,
    _keyId: string,
  ): Promise<Buffer> {
    const { DecryptCommand } = await import('@aws-sdk/client-kms');
    const command = new DecryptCommand({
      CiphertextBlob: new Uint8Array(wrappedKey),
      EncryptionContext: { tenantKeyId: _keyId },
    });
    const response = await this.kmsClient.send(command);
    return Buffer.from(response.Plaintext!);
  }

  // ── Local key implementation ────────────────────────────────────

  private async wrapWithLocalKey(
    dataKey: Buffer,
    keyId: string,
  ): Promise<Buffer> {
    const tenantKey = await this.deriveTenantKey(keyId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tenantKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(dataKey),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Format: iv (12) + authTag (16) + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async unwrapWithLocalKey(
    wrappedKey: Buffer,
    keyId: string,
  ): Promise<Buffer> {
    const tenantKey = await this.deriveTenantKey(keyId);
    const iv = wrappedKey.subarray(0, 12);
    const authTag = wrappedKey.subarray(12, 28);
    const encrypted = wrappedKey.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', tenantKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
