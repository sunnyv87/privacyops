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
 * Microsoft Sentinel connector using the Azure Log Analytics / Sentinel REST APIs.
 * Discovers workspaces, data tables, alert rules, and incidents.
 * Samples log data via the Log Analytics query API.
 */
export class MicrosoftSentinelConnector extends BaseRestApiConnector {
  private subscriptionId: string = '';
  private resourceGroup: string = '';
  private workspaceName: string = '';
  private workspaceId: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { tenantId, clientId, clientSecret, accessToken } = config.credentials;

    if (accessToken) {
      this.setupBearerAuth(accessToken);
    } else if (tenantId && clientId && clientSecret) {
      await this.setupOAuth2ClientCredentials(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        clientId,
        clientSecret,
        ['https://management.azure.com/.default'],
      );
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { subscriptionId, resourceGroup, workspaceName, workspaceId } = config.credentials;
    this.subscriptionId = subscriptionId;
    this.resourceGroup = resourceGroup;
    this.workspaceName = workspaceName;
    this.workspaceId = workspaceId || '';
    this.baseUrl = 'https://management.azure.com';
  }

  private get workspacePath(): string {
    return `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.workspaceName}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', `${this.workspacePath}`, {
        query: { 'api-version': '2023-09-01' },
      });
      this.workspaceId = result.properties?.customerId || this.workspaceId;
      return {
        success: true,
        message: `Connected to Sentinel workspace: ${result.name}`,
        metadata: { workspaceId: this.workspaceId, location: result.location },
      };
    } catch (error: any) {
      return { success: false, message: `Sentinel connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover data tables in the workspace
    try {
      const result = await this.request<any>('GET', `${this.workspacePath}/tables`, {
        query: { 'api-version': '2022-10-01' },
      });

      for (const table of result.value || []) {
        if (table.properties?.plan === 'Analytics' || !table.properties?.plan) {
          yield {
            externalId: `table:${table.name}`,
            name: table.name,
            type: 'table',
            path: `sentinel/${this.workspaceName}/tables/${table.name}`,
            metadata: {
              plan: table.properties?.plan,
              retentionInDays: table.properties?.retentionInDays,
              totalRetentionInDays: table.properties?.totalRetentionInDays,
            },
          };
        }
      }
    } catch {}

    // Discover alert rules
    try {
      const result = await this.request<any>(
        'GET',
        `${this.workspacePath}/providers/Microsoft.SecurityInsights/alertRules`,
        { query: { 'api-version': '2023-11-01' } },
      );

      for (const rule of result.value || []) {
        yield {
          externalId: `alertRule:${rule.name}`,
          name: rule.properties?.displayName || rule.name,
          type: 'alert',
          path: `sentinel/${this.workspaceName}/alertRules/${rule.name}`,
          metadata: {
            kind: rule.kind,
            severity: rule.properties?.severity,
            enabled: rule.properties?.enabled,
          },
        };
      }
    } catch {}

    // Discover saved searches / hunting queries
    try {
      const result = await this.request<any>('GET', `${this.workspacePath}/savedSearches`, {
        query: { 'api-version': '2020-08-01' },
      });

      for (const search of result.value || []) {
        if (search.properties?.category === 'Hunting Queries') {
          yield {
            externalId: `query:${search.name}`,
            name: search.properties?.displayName || search.name,
            type: 'api_endpoint',
            path: `sentinel/${this.workspaceName}/queries/${search.name}`,
            metadata: { category: search.properties?.category },
          };
        }
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type, name] = assetExternalId.split(':');
    if (type !== 'table') return { fields: [] };

    try {
      const result = await this.request<any>('GET', `${this.workspacePath}/tables/${name}`, {
        query: { 'api-version': '2022-10-01' },
      });

      return {
        fields: (result.properties?.schema?.columns || []).map((col: any, idx: number) => ({
          name: col.name,
          dataType: col.type || 'string',
          ordinalPosition: idx,
          nullable: true,
          description: col.description,
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
    const [type, tableName] = assetExternalId.split(':');
    if (type !== 'table') return;

    try {
      // Query via Log Analytics API
      const queryUrl = `https://api.loganalytics.io/v1/workspaces/${this.workspaceId}/query`;
      const query = `${tableName} | take ${Math.min(options.maxRows, 100)}`;

      const resp = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          ...this.authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!resp.ok) return;
      const data = await resp.json();

      const table = data.tables?.[0];
      if (!table) return;

      const columns = (table.columns || [])
        .slice(0, options.maxColumns)
        .filter((c: any) => !options.excludePatterns.some(p => c.name.toLowerCase().includes(p.toLowerCase())));

      for (const col of columns) {
        const colIdx = table.columns.findIndex((c: any) => c.name === col.name);
        if (colIdx < 0) continue;

        const values = (table.rows || [])
          .map((row: any[]) => row[colIdx])
          .filter((v: any) => v != null && v !== '');

        yield {
          assetExternalId,
          fieldName: col.name,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Sentinel sampling failed for ${tableName}: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'microsoft_sentinel',
      displayName: 'Microsoft Sentinel',
      description: 'Connect to Microsoft Sentinel for security log and alert discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'Microsoft.OperationalInsights/workspaces/read',
        'Microsoft.SecurityInsights/alertRules/read',
        'Microsoft.OperationalInsights/workspaces/query/read',
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
