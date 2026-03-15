import { Logger } from '@nestjs/common';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';
import { BaseRestApiConnector } from '../sdk/base-rest-api-connector';

/**
 * PingIdentity connector using the PingOne Management API.
 * Discovers users, groups, populations, and applications.
 */
export class PingIdentityConnector extends BaseRestApiConnector {
  private environmentId: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { clientId, clientSecret, environmentId, accessToken, authUrl } = config.credentials;
    this.environmentId = environmentId;

    if (accessToken) {
      this.setupBearerAuth(accessToken);
    } else if (clientId && clientSecret) {
      const tokenUrl = authUrl || `https://auth.pingone.com/${environmentId}/as/token`;
      await this.setupOAuth2ClientCredentials(tokenUrl, clientId, clientSecret);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { region } = config.credentials;
    const apiDomain = region === 'eu' ? 'api.pingone.eu' : region === 'asia' ? 'api.pingone.asia' : 'api.pingone.com';
    this.baseUrl = `https://${apiDomain}/v1/environments/${this.environmentId}`;
    this.paginationStyle = 'cursor';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '');
      return {
        success: true,
        message: `Connected to PingOne environment: ${result.name || this.environmentId}`,
        metadata: { environmentId: this.environmentId, name: result.name },
      };
    } catch (error: any) {
      return { success: false, message: `PingIdentity connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Users
    try {
      const result = await this.request<any>('GET', '/users', { query: { limit: 1 } });
      yield {
        externalId: 'object:users',
        name: 'Users',
        type: 'user',
        path: 'pingidentity/users',
        metadata: { count: result.count },
        rowCountEstimate: result.count,
      };
    } catch {}

    // Groups
    try {
      const result = await this.request<any>('GET', '/groups', { query: { limit: 1 } });
      yield {
        externalId: 'object:groups',
        name: 'Groups',
        type: 'group',
        path: 'pingidentity/groups',
        metadata: { count: result.count },
        rowCountEstimate: result.count,
      };
    } catch {}

    // Populations
    try {
      const result = await this.request<any>('GET', '/populations');
      for (const pop of result._embedded?.populations || []) {
        yield {
          externalId: `population:${pop.id}`,
          name: pop.name,
          type: 'group',
          path: `pingidentity/populations/${pop.id}`,
          metadata: { description: pop.description, userCount: pop.userCount },
        };
      }
    } catch {}

    // Applications
    try {
      const result = await this.request<any>('GET', '/applications');
      for (const app of result._embedded?.applications || []) {
        yield {
          externalId: `application:${app.id}`,
          name: app.name,
          type: 'api_endpoint',
          path: `pingidentity/applications/${app.id}`,
          metadata: { type: app.type, enabled: app.enabled, protocol: app.protocol },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId === 'object:users') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'username', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'email', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'name.given', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'name.family', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'population.id', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'enabled', dataType: 'boolean', ordinalPosition: 6, nullable: false },
          { name: 'createdAt', dataType: 'datetime', ordinalPosition: 7, nullable: false },
          { name: 'mfaEnabled', dataType: 'boolean', ordinalPosition: 8, nullable: true },
        ],
      };
    }

    if (assetExternalId === 'object:groups') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'description', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'directMemberCounts.users', dataType: 'integer', ordinalPosition: 3, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  // Identity connectors: users/groups are not tabular PII data
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {}

  getMetadata(): ConnectorMetadata {
    return {
      type: 'ping_identity',
      displayName: 'Ping Identity',
      description: 'Connect to PingOne for user, group, and application discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'Identity Data Admin',
        'Environment Admin (read-only)',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: false,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
