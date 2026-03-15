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
 * HubSpot connector using the HubSpot CRM API v3.
 * Discovers CRM objects (contacts, companies, deals, tickets), custom objects,
 * and properties. Samples records via search/list endpoints.
 */
export class HubSpotConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { accessToken, apiKey, clientId, clientSecret, refreshToken } = config.credentials;

    if (accessToken) {
      this.setupBearerAuth(accessToken);
    } else if (apiKey) {
      // Legacy API key — passed as query param, but we use header
      this.setupBearerAuth(apiKey);
    } else if (clientId && clientSecret && refreshToken) {
      const resp = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });
      const data = await resp.json();
      this.setupBearerAuth(data.access_token);
    }
  }

  protected async setupClient(): Promise<void> {
    this.baseUrl = 'https://api.hubapi.com';
    this.paginationStyle = 'cursor';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/crm/v3/objects/contacts', {
        query: { limit: 1 },
      });
      return {
        success: true,
        message: 'Connected to HubSpot',
        metadata: { total: result.total },
      };
    } catch (error: any) {
      return { success: false, message: `HubSpot connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Standard CRM objects
    const standardObjects = ['contacts', 'companies', 'deals', 'tickets', 'products', 'line_items'];

    for (const objectType of standardObjects) {
      try {
        const result = await this.request<any>('GET', `/crm/v3/objects/${objectType}`, {
          query: { limit: 1 },
        });

        yield {
          externalId: `object:${objectType}`,
          name: objectType.charAt(0).toUpperCase() + objectType.slice(1).replace('_', ' '),
          type: 'table',
          path: `hubspot/${objectType}`,
          metadata: { total: result.total },
          rowCountEstimate: result.total,
        };
      } catch {
        // Object type may not be accessible
      }
    }

    // Custom objects
    try {
      const schemas = await this.request<any>('GET', '/crm/v3/schemas');
      for (const schema of schemas.results || []) {
        yield {
          externalId: `object:${schema.objectTypeId}`,
          name: schema.labels?.singular || schema.name,
          type: 'table',
          path: `hubspot/custom/${schema.name}`,
          metadata: { objectTypeId: schema.objectTypeId, fullyQualifiedName: schema.fullyQualifiedName },
        };
      }
    } catch {
      // Custom objects may not be available
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const objectType = assetExternalId.replace('object:', '');

    try {
      const properties = await this.request<any>('GET', `/crm/v3/properties/${objectType}`);

      return {
        fields: (properties.results || []).map((prop: any, idx: number) => ({
          name: prop.name,
          dataType: prop.type || 'string',
          ordinalPosition: idx,
          nullable: !prop.required,
          description: prop.label,
        })),
      };
    } catch {
      return { fields: [] };
    }
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const objectType = assetExternalId.replace('object:', '');

    try {
      const schema = await this.getAssetSchema(assetExternalId);
      const columns = schema.fields
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

      if (columns.length === 0) return;

      const properties = columns.map(c => c.name).join(',');
      const result = await this.request<any>('GET', `/crm/v3/objects/${objectType}`, {
        query: { limit: Math.min(options.maxRows, 100), properties },
      });

      for (const column of columns) {
        const values = (result.results || [])
          .map((r: any) => r.properties?.[column.name])
          .filter((v: any) => v != null && v !== '');

        yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`HubSpot sampling failed for ${objectType}: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'hubspot',
      displayName: 'HubSpot',
      description: 'Connect to HubSpot CRM for contact, company, and deal discovery',
      authMethods: ['api_key', 'oauth2'],
      requiredPermissions: [
        'crm.objects.contacts.read',
        'crm.objects.companies.read',
        'crm.objects.deals.read',
        'crm.schemas.read',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
