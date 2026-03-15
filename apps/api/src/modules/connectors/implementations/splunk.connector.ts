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
 * Splunk connector using the Splunk REST API.
 * Discovers indexes, saved searches, and data models. Samples search results.
 */
export class SplunkConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { token, username, password } = config.credentials;

    if (token) {
      this.setupBearerAuth(token);
    } else {
      this.setupBasicAuth(username, password);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, port } = config.credentials;
    this.baseUrl = `https://${host}:${port || 8089}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/services/server/info', {
        query: { output_mode: 'json' },
      });
      const info = result.entry?.[0]?.content;
      return {
        success: true,
        message: `Connected to Splunk ${info?.version}`,
        metadata: { version: info?.version, serverName: info?.serverName },
      };
    } catch (error: any) {
      return { success: false, message: `Splunk connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List indexes
    try {
      const result = await this.request<any>('GET', '/services/data/indexes', {
        query: { output_mode: 'json', count: 0 },
      });

      for (const entry of result.entry || []) {
        const content = entry.content || {};
        yield {
          externalId: `index:${entry.name}`,
          name: entry.name,
          type: 'index',
          path: `splunk/indexes/${entry.name}`,
          metadata: {
            datatype: content.datatype,
            totalEventCount: content.totalEventCount,
            currentDBSizeMB: content.currentDBSizeMB,
            maxDataSizeMB: content.maxDataSizeMB,
            frozenTimePeriodInSecs: content.frozenTimePeriodInSecs,
          },
          sizeBytes: (content.currentDBSizeMB || 0) * 1024 * 1024,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Error listing Splunk indexes: ${error.message}`);
    }

    // List saved searches
    try {
      const result = await this.request<any>('GET', '/services/saved/searches', {
        query: { output_mode: 'json', count: 100 },
      });

      for (const entry of result.entry || []) {
        yield {
          externalId: `savedsearch:${entry.name}`,
          name: entry.name,
          type: 'api_endpoint',
          path: `splunk/saved-searches/${entry.name}`,
          metadata: {
            search: entry.content?.search,
            isScheduled: entry.content?.is_scheduled,
            cronSchedule: entry.content?.cron_schedule,
            owner: entry.acl?.owner,
          },
        };
      }
    } catch (error: any) {
      this.logger.warn(`Error listing Splunk saved searches: ${error.message}`);
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('index:')) {
      const indexName = assetExternalId.replace('index:', '');

      try {
        // Get field summary for index
        const result = await this.request<any>(
          'GET',
          `/services/search/jobs/export`,
          {
            query: {
              output_mode: 'json',
              search: `| metadata type=sources index=${indexName} | head 1 | fieldsummary`,
              exec_mode: 'oneshot',
            },
          },
        );

        // Parse field summary from Splunk response
        const fields: any[] = [];
        const lines = String(result).split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            if (record.result?.field) {
              fields.push({
                name: record.result.field,
                dataType: record.result.distinct_count > 0 ? 'string' : 'unknown',
                ordinalPosition: fields.length,
                nullable: true,
              });
            }
          } catch {}
        }

        if (fields.length > 0) return { fields };
      } catch {}

      // Fallback: common Splunk fields
      return {
        fields: [
          { name: '_time', dataType: 'datetime', ordinalPosition: 0, nullable: false },
          { name: 'source', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'sourcetype', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'host', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: '_raw', dataType: 'string', ordinalPosition: 4, nullable: false },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    if (!assetExternalId.startsWith('index:')) return;

    const indexName = assetExternalId.replace('index:', '');

    try {
      const result = await this.request<any>(
        'GET',
        '/services/search/jobs/export',
        {
          query: {
            output_mode: 'json',
            search: `search index=${indexName} | head ${Math.min(options.maxRows, 100)}`,
            exec_mode: 'oneshot',
          },
        },
      );

      // Parse JSONL response from Splunk export
      const records: Record<string, any>[] = [];
      const lines = String(result).split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result) records.push(parsed.result);
        } catch {}
      }

      if (records.length === 0) return;

      // Collect all field names
      const fieldSet = new Set<string>();
      for (const record of records) {
        Object.keys(record).forEach(k => fieldSet.add(k));
      }

      const fields = Array.from(fieldSet)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const values = records
          .map(r => r[fieldName])
          .filter(v => v != null && v !== '');

        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Splunk search sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];

    try {
      // Get roles and their capabilities
      const result = await this.request<any>('GET', '/services/authorization/roles', {
        query: { output_mode: 'json', count: 0 },
      });

      for (const entry of result.entry || []) {
        const content = entry.content || {};
        const indexAccess = [
          ...(content.srchIndexesAllowed || []),
          ...(content.srchIndexesDefault || []),
        ];

        if (assetExternalId.startsWith('index:')) {
          const indexName = assetExternalId.replace('index:', '');
          if (indexAccess.includes(indexName) || indexAccess.includes('*')) {
            policies.push({
              principal: entry.name,
              principalType: 'role',
              permissions: content.capabilities?.slice(0, 10) || ['search'],
              source: 'splunk_roles',
            });
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching Splunk roles: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'splunk',
      displayName: 'Splunk',
      description: 'Connect to Splunk for index, saved search, and data discovery',
      authMethods: ['api_key', 'basic_auth'],
      requiredPermissions: [
        'list_indexes',
        'list_saved_searches',
        'search (for content sampling)',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
