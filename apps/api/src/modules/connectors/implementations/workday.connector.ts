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
 * Workday connector using the Workday REST API (RaaS and WQL).
 * Discovers worker, organization, and custom report data objects.
 */
export class WorkdayConnector extends BaseRestApiConnector {
  private tenant: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { clientId, clientSecret, tokenUrl, refreshToken, username, password } = config.credentials;

    if (clientId && clientSecret && tokenUrl) {
      await this.setupOAuth2ClientCredentials(tokenUrl, clientId, clientSecret);
    } else if (refreshToken && clientId) {
      // Refresh token flow
      const resp = await fetch(tokenUrl || `${this.baseUrl}/oauth2/${this.tenant}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      });
      const data = await resp.json();
      this.setupBearerAuth(data.access_token);
    } else {
      this.setupBasicAuth(username, password);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, tenant, apiVersion } = config.credentials;
    this.tenant = tenant;
    this.baseUrl = `https://${host}/api/${apiVersion || 'v1'}/${tenant}`;
    this.paginationStyle = 'offset';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/workers', { query: { limit: 1 } });
      return {
        success: true,
        message: `Connected to Workday tenant: ${this.tenant}`,
        metadata: { total: result.total },
      };
    } catch (error: any) {
      return { success: false, message: `Workday connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover worker data
    yield {
      externalId: 'object:workers',
      name: 'Workers',
      type: 'table',
      path: 'workday/workers',
      metadata: { description: 'Employee/worker records' },
    };

    // Discover organizations
    yield {
      externalId: 'object:organizations',
      name: 'Organizations',
      type: 'table',
      path: 'workday/organizations',
      metadata: { description: 'Organization hierarchy' },
    };

    // List custom reports via RaaS
    try {
      const reports = await this.request<any>('GET', '/customReports');
      for (const report of reports.data || []) {
        yield {
          externalId: `report:${report.id || report.name}`,
          name: report.name || report.reportName,
          type: 'table',
          path: `workday/reports/${report.name}`,
          metadata: { owner: report.owner, description: report.description },
        };
      }
    } catch {
      // Custom reports endpoint may not be available
    }

    // Static discoverable object types
    const objectTypes = [
      { name: 'Job Profiles', path: 'jobProfiles' },
      { name: 'Locations', path: 'locations' },
      { name: 'Compensation Plans', path: 'compensationPlans' },
    ];

    for (const obj of objectTypes) {
      yield {
        externalId: `object:${obj.path}`,
        name: obj.name,
        type: 'table',
        path: `workday/${obj.path}`,
        metadata: {},
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const objectName = assetExternalId.replace('object:', '').replace('report:', '');

    // Well-known schemas
    if (objectName === 'workers') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'descriptor', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'primaryWorkEmail', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'primaryWorkPhone', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'businessTitle', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'supervisoryOrganization', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'location', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'hireDate', dataType: 'date', ordinalPosition: 7, nullable: true },
        ],
      };
    }

    // Try fetching a single record to infer schema
    try {
      const result = await this.request<any>('GET', `/${objectName}`, { query: { limit: 1 } });
      const sample = result.data?.[0];
      if (sample && typeof sample === 'object') {
        return {
          fields: Object.keys(sample).map((name, idx) => ({
            name,
            dataType: typeof sample[name] === 'number' ? 'number' : 'string',
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
    const objectName = assetExternalId.replace('object:', '').replace('report:', '');

    try {
      const result = await this.request<any>('GET', `/${objectName}`, {
        query: { limit: Math.min(options.maxRows, 100) },
      });

      const records = result.data || [];
      if (records.length === 0) return;

      const fieldSet = new Set<string>();
      for (const record of records.slice(0, 5)) {
        if (record && typeof record === 'object') {
          Object.keys(record).forEach(k => fieldSet.add(k));
        }
      }

      const fields = Array.from(fieldSet)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const values = records.map((r: any) => r[fieldName]).filter((v: any) => v != null);
        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Workday sampling failed for ${objectName}: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'workday',
      displayName: 'Workday',
      description: 'Connect to Workday HCM for worker and organization data discovery',
      authMethods: ['oauth2', 'basic_auth'],
      requiredPermissions: [
        'Worker Data: Public Worker Reports',
        'Integration System access',
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
