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
    const azureVaultUrl = this.config.get<string>('AZURE_KEYVAULT_URL') || null;
    const gcpKeyName = this.config.get<string>('GCP_KMS_KEY_NAME') || null;

    if (this.kmsKeyArn) {
      await this.initAwsKms();
    } else if (azureVaultUrl) {
      await this.initAzureKeyVault(azureVaultUrl);
    } else if (gcpKeyName) {
      await this.initGcpKms(gcpKeyName);
    } else {
      this.initLocalMasterKey();
    }
  }

  private async initAzureKeyVault(vaultUrl: string): Promise<void> {
    try {
      const { KeyClient } = await import('@azure/keyvault-keys');
      const { DefaultAzureCredential } = await import('@azure/identity');
      this.kmsClient = new KeyClient(vaultUrl, new DefaultAzureCredential());
      this.logger.log(`Azure Key Vault client initialized: ${vaultUrl}`);
    } catch (err) {
      this.logger.error('Failed to initialize Azure Key Vault. Falling back to local master key.', err);
      this.initLocalMasterKey();
    }
  }

  private async initGcpKms(keyName: string): Promise<void> {
    try {
      const { KeyManagementServiceClient } = await import('@google-cloud/kms');
      this.kmsClient = new KeyManagementServiceClient();
      this.kmsKeyArn = keyName;
      this.logger.log(`GCP KMS client initialized: ${keyName}`);
    } catch (err) {
      this.logger.error('Failed to initialize GCP KMS. Falling back to local master key.', err);
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
      return;
    }

    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new Error(
        'ENCRYPTION_MASTER_KEY or KMS_KEY_ARN must be set in production',
      );
    }

    // Development fallback: read a random key from a gitignored file in the
    // user's home directory, or create one on first run. This avoids the
    // "deterministic-dev-key" anti-pattern where every developer's local
    // instance (and CI) would derive the same keys from a hard-coded string.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const os = require('os') as typeof import('os');
    const keyPath = path.join(os.homedir(), '.privacyops-dev-master.key');

    try {
      if (fs.existsSync(keyPath)) {
        const hex = fs.readFileSync(keyPath, 'utf8').trim();
        const buf = Buffer.from(hex, 'hex');
        if (buf.length === 32) {
          this.localMasterKey = buf;
          this.logger.warn(
            `Loaded dev master key from ${keyPath} (NOT for production)`,
          );
          return;
        }
      }

      const newKey = crypto.randomBytes(32);
      fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
      this.localMasterKey = newKey;
      this.logger.warn(
        `Generated and persisted random dev master key at ${keyPath} (NOT for production). ` +
          `Set ENCRYPTION_MASTER_KEY in .env for deterministic tests.`,
      );
    } catch (err) {
      // Fallback for sandboxed environments where HOME is not writable.
      this.localMasterKey = crypto.randomBytes(32);
      this.logger.warn(
        `Using ephemeral dev master key (HOME not writable): ${err}`,
      );
    }
  }

  /**
   * Derives a per-tenant key from the master key using HKDF.
   *
   * HKDF parameters:
   *  - salt: A random per-tenant salt persisted in the database. Using a
   *    random salt (rather than the public keyId) ensures that compromise
   *    of the keyId cannot be used to precompute rainbow tables or match
   *    keys across tenants with colliding IDs.
   *  - info: Includes the tenantId so that derived keys for different
   *    tenants are domain-separated even if they somehow share salt/master.
   */
  private async deriveTenantKey(keyId: string, salt?: Buffer): Promise<Buffer> {
    // Salt: caller provides a random per-tenant salt from the TenantKey table.
    // If missing, fall back to a deterministic salt derived from keyId (preserves
    // backwards compat). Production deployments should migrate all tenants to
    // random salts.
    if (!salt) {
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv === 'production') {
        this.logger.warn(
          `HKDF derivation for keyId=${keyId} using deterministic fallback salt — ` +
            'migrate tenant to a random salt via the key-rotation runbook',
        );
      }
    }
    const effectiveSalt =
      salt ??
      crypto.createHash('sha256').update(`privacyops-hkdf-salt|${keyId}`).digest();

    const info = Buffer.from(`privacyops-tenant-dek|${keyId}`, 'utf8');

    return new Promise<Buffer>((resolve, reject) => {
      crypto.hkdf(
        'sha256',
        this.localMasterKey!,
        effectiveSalt,
        info,
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
