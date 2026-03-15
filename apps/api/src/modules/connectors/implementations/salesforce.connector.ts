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
 * Salesforce connector using the Salesforce REST API.
 * Discovers sObjects, describes fields, samples records via SOQL.
 */
export class SalesforceConnector extends BaseRestApiConnector {
  private instanceUrl: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { clientId, clientSecret, username, password, securityToken, loginUrl } = config.credentials;

    // OAuth2 password flow for server-to-server
    const tokenUrl = `${loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: `${password}${securityToken || ''}`,
    });

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      throw new Error(`Salesforce auth failed: ${resp.status}`);
    }

    const data = await resp.json();
    this.instanceUrl = data.instance_url;
    this.authHeaders = { Authorization: `Bearer ${data.access_token}` };
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    this.baseUrl = `${this.instanceUrl}/services/data/v59.0`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/limits');
      return {
        success: true,
        message: 'Connected to Salesforce',
        metadata: { apiUsage: result.DailyApiRequests?.Remaining },
      };
    } catch (error: any) {
      return { success: false, message: `Salesforce connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    // HTTP-based — no persistent connection
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const response = await this.request<any>('GET', '/sobjects');

    for (const obj of response.sobjects || []) {
      if (!obj.queryable) continue;

      yield {
        externalId: `sobject:${obj.name}`,
        name: obj.name,
        type: 'table',
        path: `salesforce/${obj.name}`,
        metadata: {
          label: obj.label,
          custom: obj.custom,
          keyPrefix: obj.keyPrefix,
          createable: obj.createable,
          updateable: obj.updateable,
          recordCount: obj.count,
        },
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const objectName = assetExternalId.replace('sobject:', '');

    try {
      const describe = await this.request<any>('GET', `/sobjects/${objectName}/describe`);

      return {
        fields: (describe.fields || []).map((field: any, idx: number) => ({
          name: field.name,
          dataType: field.type,
          ordinalPosition: idx,
          nullable: field.nillable,
          description: field.label,
        })),
        metadata: { label: describe.label, recordTypeInfos: describe.recordTypeInfos?.length },
      };
    } catch {
      return { fields: [] };
    }
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const objectName = assetExternalId.replace('sobject:', '');
    const schema = await this.getAssetSchema(assetExternalId);

    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const fieldNames = columns.map(c => this.sanitizeIdentifier(c.name)).join(', ');
    const safeObjectName = this.sanitizeIdentifier(objectName);
    const safeMaxRows = this.sanitizeMaxRows(options.maxRows, 200);
    const soql = `SELECT ${fieldNames} FROM ${safeObjectName} LIMIT ${safeMaxRows}`;

    try {
      const result = await this.request<any>('GET', '/query', { query: { q: soql } });

      for (const column of columns) {
        const values = (result.records || [])
          .map((r: any) => r[column.name])
          .filter((v: any) => v != null);

        yield {
          assetExternalId,
          fieldName: column.name,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`SOQL query failed for ${objectName}: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const objectName = assetExternalId.replace('sobject:', '');
    const policies: AccessPolicy[] = [];

    try {
      const describe = await this.request<any>('GET', `/sobjects/${objectName}/describe`);

      // Object-level permissions from describe
      const perms: string[] = [];
      if (describe.createable) perms.push('CREATE');
      if (describe.updateable) perms.push('UPDATE');
      if (describe.deletable) perms.push('DELETE');
      if (describe.queryable) perms.push('READ');

      policies.push({
        principal: 'current_user',
        principalType: 'user',
        permissions: perms,
        source: 'object_describe',
      });
    } catch (error: any) {
      this.logger.warn(`Error fetching Salesforce permissions: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'salesforce',
      displayName: 'Salesforce',
      description: 'Connect to Salesforce CRM for sObject discovery and data classification',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'API Enabled',
        'View All Data (or object-level read)',
        'Describe sObjects',
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
