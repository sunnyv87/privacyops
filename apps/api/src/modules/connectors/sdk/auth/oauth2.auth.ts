import { Logger } from '@nestjs/common';

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
  audience?: string;
}

export class OAuth2Auth {
  private readonly logger = new Logger(OAuth2Auth.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: OAuth2Config) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    if (this.config.scopes) params.set('scope', this.config.scopes.join(' '));
    if (this.config.audience) params.set('audience', this.config.audience);

    const resp = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) throw new Error(`OAuth2 token request failed: ${resp.status}`);
    const data = await resp.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    this.logger.debug('OAuth2 token refreshed');
    return this.accessToken!;
  }
}
