import { Logger } from '@nestjs/common';

export interface IamRoleConfig {
  roleArn: string;
  externalId?: string;
  region?: string;
  sessionName?: string;
}

export class IamRoleAuth {
  private readonly logger = new Logger(IamRoleAuth.name);
  private credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string } | null = null;
  private expiry = 0;

  constructor(private config: IamRoleConfig) {}

  async getCredentials() {
    if (this.credentials && Date.now() < this.expiry - 60000) return this.credentials;
    this.logger.debug(`Assuming IAM role ${this.config.roleArn}`);
    // In production, use AWS SDK STS assumeRole
    // For now, return env-based credentials as fallback
    this.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN || '',
    };
    this.expiry = Date.now() + 3600 * 1000;
    return this.credentials;
  }
}
