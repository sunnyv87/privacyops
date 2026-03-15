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
import { BaseRestApiConnector, PaginationStyle } from '../sdk/base-rest-api-connector';

/**
 * Generic REST API connector. Fully configurable adapter for arbitrary REST APIs.
 * All behavior is driven by the connection config — base URL, auth, endpoints,
 * response mapping, and pagination style.
 */
export class GenericRestConnector extends BaseRestApiConnector {
  private discoveryEndpoint: string = '';
  private schemaEndpoint: string = '';
  private sampleEndpoint: string = '';
  private healthEndpoint: string = '';
  private dataExtractorPath: string = '';
  private cursorPath: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { authType, token, apiKey, apiKeyHeader, apiKeyPrefix,
            username, password, clientId, clientSecret, tokenUrl } = config.credentials;

    switch (authType) {
      case 'bearer':
        this.setupBearerAuth(token);
        break;
      case 'api_key':
        this.setupApiKeyAuth(apiKey, apiKeyHeader, apiKeyPrefix);
        break;
      case 'basic':
        this.setupBasicAuth(username, password);
        break;
      case 'oauth2':
        await this.setupOAuth2ClientCredentials(tokenUrl, clientId, clientSecret);
        break;
      default:
        if (token) this.setupBearerAuth(token);
        break;
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const opts = config.options || {};
    this.baseUrl = config.credentials.baseUrl;
    this.paginationStyle = (opts.paginationStyle as PaginationStyle) || 'offset';
    this.defaultPageSize = opts.pageSize || 100;

    // Configurable endpoint paths
    this.discoveryEndpoint = opts.discoveryEndpoint || '/';
    this.schemaEndpoint = opts.schemaEndpoint || '';
    this.sampleEndpoint = opts.sampleEndpoint || '';
    this.healthEndpoint = opts.healthEndpoint || '/';
    this.dataExtractorPath = opts.dataExtractorPath || 'data';
    this.cursorPath = opts.cursorPath || 'next_cursor';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.request('GET', this.healthEndpoint);
      return { success: true, message: `Connected to ${this.baseUrl}` };
    } catch (error: any) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const dataPath = this.dataExtractorPath;

    for await (const page of this.paginate<any>(this.discoveryEndpoint, {
      dataExtractor: (r) => this.extractByPath(r, dataPath),
      cursorExtractor: (r) => this.extractByPath(r, this.cursorPath)?.[0],
      maxPages: 50,
    })) {
      for (const item of page) {
        const idField = this.config.options?.idField || 'id';
        const nameField = this.config.options?.nameField || 'name';
        const typeField = this.config.options?.typeField || '';

        yield {
          externalId: `rest:${item[idField] || item.id || JSON.stringify(item).slice(0, 50)}`,
          name: item[nameField] || item.name || item.title || 'unnamed',
          type: item[typeField] || 'api_endpoint',
          path: `${this.baseUrl}${this.discoveryEndpoint}/${item[idField] || item.id || ''}`,
          metadata: item,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (!this.schemaEndpoint) return { fields: [] };

    const id = assetExternalId.replace('rest:', '');

    try {
      const endpoint = this.schemaEndpoint.replace('{id}', id);
      const result = await this.request<any>('GET', endpoint);

      // Try to infer schema from first record
      const sample = Array.isArray(result) ? result[0] : result;
      if (sample && typeof sample === 'object') {
        return {
          fields: Object.entries(sample).map(([name, value], idx) => ({
            name,
            dataType: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
            ordinalPosition: idx,
            nullable: true,
          })),
        };
      }
    } catch {}

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    if (!this.sampleEndpoint) return;

    const id = assetExternalId.replace('rest:', '');

    try {
      const endpoint = this.sampleEndpoint.replace('{id}', id);
      const result = await this.request<any>('GET', endpoint, {
        query: { limit: options.maxRows },
      });

      const records = Array.isArray(result)
        ? result
        : this.extractByPath(result, this.dataExtractorPath);

      if (!records?.length) return;

      // Collect field names
      const fieldSet = new Set<string>();
      for (const record of records.slice(0, 10)) {
        if (record && typeof record === 'object') {
          Object.keys(record).forEach(k => fieldSet.add(k));
        }
      }

      const fields = Array.from(fieldSet)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const values = records
          .slice(0, options.maxRows)
          .map((r: any) => r[fieldName])
          .filter((v: any) => v != null);

        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Generic REST sampling failed: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'generic_rest',
      displayName: 'Generic REST API',
      description: 'Configurable connector for any REST API endpoint',
      authMethods: ['api_key', 'oauth2', 'basic_auth', 'pat'],
      requiredPermissions: ['Varies by target API'],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: !!this.sampleEndpoint,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }

  /**
   * Extract a value from a nested object using a dot-separated path.
   * e.g., extractByPath({ data: { items: [1,2] } }, 'data.items') => [1, 2]
   */
  private extractByPath(obj: any, path: string): any[] {
    if (!path || !obj) return Array.isArray(obj) ? obj : [];

    let current = obj;
    for (const segment of path.split('.')) {
      if (current == null) return [];
      current = current[segment];
    }

    return Array.isArray(current) ? current : current ? [current] : [];
  }
}
