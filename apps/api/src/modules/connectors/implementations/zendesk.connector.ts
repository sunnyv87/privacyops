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
 * Zendesk connector using the Zendesk Support API v2.
 * Discovers tickets, users, organizations, and custom ticket fields.
 */
export class ZendeskConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { email, apiToken, oauthToken } = config.credentials;

    if (oauthToken) {
      this.setupBearerAuth(oauthToken);
    } else if (email && apiToken) {
      // Zendesk API token auth: email/token:api_token
      this.setupBasicAuth(`${email}/token`, apiToken);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { subdomain } = config.credentials;
    this.baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
    this.paginationStyle = 'cursor';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/account.json');
      return {
        success: true,
        message: `Connected to Zendesk: ${result.account?.subdomain}`,
        metadata: { subdomain: result.account?.subdomain, planName: result.account?.plan?.name },
      };
    } catch (error: any) {
      return { success: false, message: `Zendesk connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Standard object types
    const objectTypes = [
      { name: 'Tickets', endpoint: '/tickets.json', key: 'tickets' },
      { name: 'Users', endpoint: '/users.json', key: 'users' },
      { name: 'Organizations', endpoint: '/organizations.json', key: 'organizations' },
      { name: 'Groups', endpoint: '/groups.json', key: 'groups' },
    ];

    for (const obj of objectTypes) {
      try {
        const result = await this.request<any>('GET', obj.endpoint, { query: { per_page: 1 } });
        const count = result.count || (result[obj.key]?.length ?? 0);

        yield {
          externalId: `object:${obj.key}`,
          name: obj.name,
          type: 'table',
          path: `zendesk/${obj.key}`,
          metadata: { count },
          rowCountEstimate: count,
        };
      } catch {
        // Object type may not be accessible
      }
    }

    // Custom ticket fields
    try {
      const fields = await this.request<any>('GET', '/ticket_fields.json');
      for (const field of fields.ticket_fields || []) {
        if (field.active && field.type === 'tagger') {
          yield {
            externalId: `field:${field.id}`,
            name: field.title,
            type: 'api_endpoint',
            path: `zendesk/fields/${field.id}`,
            metadata: { type: field.type, required: field.required },
          };
        }
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const objectType = assetExternalId.replace('object:', '');

    if (objectType === 'tickets') {
      return {
        fields: [
          { name: 'id', dataType: 'integer', ordinalPosition: 0, nullable: false },
          { name: 'subject', dataType: 'string', ordinalPosition: 1, nullable: true },
          { name: 'description', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'status', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: 'priority', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'requester_id', dataType: 'integer', ordinalPosition: 5, nullable: false },
          { name: 'assignee_id', dataType: 'integer', ordinalPosition: 6, nullable: true },
          { name: 'group_id', dataType: 'integer', ordinalPosition: 7, nullable: true },
          { name: 'created_at', dataType: 'datetime', ordinalPosition: 8, nullable: false },
          { name: 'updated_at', dataType: 'datetime', ordinalPosition: 9, nullable: false },
          { name: 'tags', dataType: 'array', ordinalPosition: 10, nullable: true },
        ],
      };
    }

    if (objectType === 'users') {
      return {
        fields: [
          { name: 'id', dataType: 'integer', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'email', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'role', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: 'phone', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'organization_id', dataType: 'integer', ordinalPosition: 5, nullable: true },
          { name: 'created_at', dataType: 'datetime', ordinalPosition: 6, nullable: false },
        ],
      };
    }

    if (objectType === 'organizations') {
      return {
        fields: [
          { name: 'id', dataType: 'integer', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'domain_names', dataType: 'array', ordinalPosition: 2, nullable: true },
          { name: 'created_at', dataType: 'datetime', ordinalPosition: 3, nullable: false },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const objectType = assetExternalId.replace('object:', '');

    try {
      const result = await this.request<any>('GET', `/${objectType}.json`, {
        query: { per_page: Math.min(options.maxRows, 100) },
      });

      const records = result[objectType] || [];
      if (records.length === 0) return;

      const schema = await this.getAssetSchema(assetExternalId);
      const columns = schema.fields
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

      for (const column of columns) {
        const values = records
          .map((r: any) => r[column.name])
          .filter((v: any) => v != null && v !== '');

        yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Zendesk sampling failed for ${objectType}: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'zendesk',
      displayName: 'Zendesk',
      description: 'Connect to Zendesk Support for ticket, user, and organization discovery',
      authMethods: ['api_key', 'oauth2'],
      requiredPermissions: [
        'read (tickets)',
        'read (users)',
        'read (organizations)',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: false,
      },
    };
  }
}
