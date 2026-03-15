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
 * Elastic Security connector using the Elasticsearch / Kibana APIs.
 * Discovers indices, detection rules, and alerts. Samples index data.
 */
export class ElasticSecurityConnector extends BaseRestApiConnector {
  private kibanaUrl: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { apiKey, username, password, cloudId } = config.credentials;

    if (apiKey) {
      // Elastic API key: base64 encoded id:api_key
      this.authHeaders = { Authorization: `ApiKey ${apiKey}` };
    } else if (username && password) {
      this.setupBasicAuth(username, password);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, port, protocol, cloudId, kibanaHost } = config.credentials;

    if (cloudId) {
      // Cloud ID: base64 encoded cluster_host:kibana_host
      const decoded = Buffer.from(cloudId.split(':')[1] || '', 'base64').toString();
      const [clusterHost] = decoded.split('$');
      this.baseUrl = `https://${clusterHost}`;
      this.kibanaUrl = kibanaHost || this.baseUrl.replace(':9243', ':5601');
    } else {
      const proto = protocol || 'https';
      const portSuffix = port ? `:${port}` : ':9200';
      this.baseUrl = `${proto}://${host}${portSuffix}`;
      this.kibanaUrl = kibanaHost || `${proto}://${host}:5601`;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/');
      return {
        success: true,
        message: `Connected to Elasticsearch ${result.version?.number}`,
        metadata: {
          clusterName: result.cluster_name,
          version: result.version?.number,
        },
      };
    } catch (error: any) {
      return { success: false, message: `Elastic connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover indices (excluding system indices)
    try {
      const indices = await this.request<any>('GET', '/_cat/indices', {
        query: { format: 'json', h: 'index,docs.count,store.size,health,status' },
      });

      for (const idx of indices || []) {
        if (idx.index?.startsWith('.')) continue; // Skip system indices

        yield {
          externalId: `index:${idx.index}`,
          name: idx.index,
          type: 'index',
          path: `elastic/${idx.index}`,
          metadata: {
            docsCount: idx['docs.count'],
            storeSize: idx['store.size'],
            health: idx.health,
            status: idx.status,
          },
          rowCountEstimate: parseInt(idx['docs.count']) || undefined,
        };
      }
    } catch {}

    // Discover detection rules via Kibana Security API
    try {
      const result = await fetch(`${this.kibanaUrl}/api/detection_engine/rules/_find`, {
        method: 'GET',
        headers: {
          ...this.authHeaders,
          'kbn-xsrf': 'true',
          'Content-Type': 'application/json',
        },
      });

      if (result.ok) {
        const data = await result.json();
        for (const rule of data.data || []) {
          yield {
            externalId: `rule:${rule.id}`,
            name: rule.name,
            type: 'alert',
            path: `elastic/rules/${rule.id}`,
            metadata: {
              severity: rule.severity,
              riskScore: rule.risk_score,
              enabled: rule.enabled,
              type: rule.type,
            },
          };
        }
      }
    } catch {}

    // Discover data streams
    try {
      const result = await this.request<any>('GET', '/_data_stream');
      for (const ds of result.data_streams || []) {
        yield {
          externalId: `datastream:${ds.name}`,
          name: ds.name,
          type: 'index',
          path: `elastic/data_streams/${ds.name}`,
          metadata: {
            status: ds.status,
            template: ds.template,
            generation: ds.generation,
          },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type, name] = assetExternalId.split(':');
    if (type !== 'index' && type !== 'datastream') return { fields: [] };

    try {
      const mapping = await this.request<any>('GET', `/${name}/_mapping`);
      const indexMapping = Object.values(mapping)[0] as any;
      const properties = indexMapping?.mappings?.properties || {};

      return {
        fields: Object.entries(properties).map(([fieldName, fieldDef]: [string, any], idx) => ({
          name: fieldName,
          dataType: fieldDef.type || 'object',
          ordinalPosition: idx,
          nullable: true,
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
    const [type, indexName] = assetExternalId.split(':');
    if (type !== 'index' && type !== 'datastream') return;

    try {
      const schema = await this.getAssetSchema(assetExternalId);
      const columns = schema.fields
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

      if (columns.length === 0) return;

      const result = await this.request<any>('POST', `/${indexName}/_search`, {
        body: {
          size: Math.min(options.maxRows, 100),
          _source: columns.map(c => c.name),
        },
      });

      const hits = result.hits?.hits || [];
      for (const column of columns) {
        const values = hits
          .map((hit: any) => hit._source?.[column.name])
          .filter((v: any) => v != null && v !== '');

        yield {
          assetExternalId,
          fieldName: column.name,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Elastic sampling failed for ${indexName}: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'elastic_security',
      displayName: 'Elastic Security',
      description: 'Connect to Elasticsearch / Elastic Security for index and detection rule discovery',
      authMethods: ['api_key', 'basic_auth'],
      requiredPermissions: [
        'monitor',
        'read (indices)',
        'read (detection rules)',
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
