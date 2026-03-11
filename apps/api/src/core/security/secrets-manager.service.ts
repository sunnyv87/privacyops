import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SecretsBackend = 'env' | 'aws_secrets_manager' | 'vault';

@Injectable()
export class SecretsManagerService implements OnModuleInit {
  private readonly logger = new Logger(SecretsManagerService.name);
  private backend: SecretsBackend;
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly config: ConfigService) {
    this.backend = (config.get('SECRETS_BACKEND', 'env') as SecretsBackend);
  }

  async onModuleInit() {
    this.logger.log(`Secrets manager initialized with backend: ${this.backend}`);
  }

  async getSecret(name: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    let value: string | null = null;

    switch (this.backend) {
      case 'env':
        value = this.config.get(name) || null;
        break;
      case 'aws_secrets_manager':
        value = await this.getFromAwsSecretsManager(name);
        break;
      case 'vault':
        value = await this.getFromVault(name);
        break;
    }

    if (value) {
      this.cache.set(name, { value, expiresAt: Date.now() + this.cacheTtlMs });
    }

    return value;
  }

  private async getFromAwsSecretsManager(name: string): Promise<string | null> {
    try {
      // AWS SDK integration placeholder
      // const client = new SecretsManagerClient({ region: this.config.get('AWS_REGION') });
      // const response = await client.send(new GetSecretValueCommand({ SecretId: name }));
      // return response.SecretString || null;
      this.logger.debug(`Would fetch ${name} from AWS Secrets Manager`);
      return this.config.get(name) || null;
    } catch (err) {
      this.logger.error(`Failed to fetch secret ${name} from AWS: ${(err as Error).message}`);
      return null;
    }
  }

  private async getFromVault(name: string): Promise<string | null> {
    try {
      // HashiCorp Vault integration placeholder
      // const vaultAddr = this.config.get('VAULT_ADDR');
      // const vaultToken = this.config.get('VAULT_TOKEN');
      this.logger.debug(`Would fetch ${name} from Vault`);
      return this.config.get(name) || null;
    } catch (err) {
      this.logger.error(`Failed to fetch secret ${name} from Vault: ${(err as Error).message}`);
      return null;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
