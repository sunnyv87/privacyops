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
 * ServiceNow connector using the ServiceNow Table API.
 * Discovers tables, retrieves schemas via metadata, samples records.
 */
export class ServiceNowConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { username, password, clientId, clientSecret, instanceUrl } = config.credentials;

    if (clientId && clientSecret) {
      await this.setupOAuth2ClientCredentials(
        `${instanceUrl}/oauth_token.do`,
        clientId,
        clientSecret,
      );
    } else {
      this.setupBasicAuth(username, password);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { instanceUrl } = config.credentials;
    this.baseUrl = instanceUrl; // e.g., https://instance.service-now.com
    this.paginationStyle = 'offset';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>(
        'GET',
        '/api/now/table/sys_properties',
        { query: { sysparm_limit: 1 } },
      );
      return {
        success: true,
        message: 'Connected to ServiceNow',
        metadata: { recordCount: result.result?.length },
      };
    } catch (error: any) {
      return { success: false, message: `ServiceNow connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List tables from sys_db_object
    for await (const page of this.paginate<any>('/api/now/table/sys_db_object', {
      query: {
        sysparm_fields: 'name,label,super_class,sys_id,number_ref',
        sysparm_query: 'nameISNOTEMPTY^super_class!=',
      },
      dataExtractor: (r) => r.result || [],
      pageSize: 100,
      maxPages: 20,
    })) {
      for (const table of page) {
        yield {
          externalId: `table:${table.name}`,
          name: table.name,
          type: 'table',
          path: `servicenow/${table.name}`,
          metadata: {
            label: table.label,
            sysId: table.sys_id,
          },
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const tableName = assetExternalId.replace('table:', '');

    try {
      // Get columns from sys_dictionary
      const result = await this.request<any>(
        'GET',
        '/api/now/table/sys_dictionary',
        {
          query: {
            sysparm_query: `name=${tableName}^elementISNOTEMPTY`,
            sysparm_fields: 'element,column_label,internal_type,mandatory',
            sysparm_limit: 500,
          },
        },
      );

      return {
        fields: (result.result || []).map((col: any, idx: number) => ({
          name: col.element,
          dataType: col.internal_type?.value || col.internal_type || 'string',
          ordinalPosition: idx,
          nullable: col.mandatory !== 'true',
          description: col.column_label,
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
    const tableName = assetExternalId.replace('table:', '');
    const schema = await this.getAssetSchema(assetExternalId);

    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const fieldNames = columns.map(c => c.name).join(',');

    try {
      const result = await this.request<any>(
        'GET',
        `/api/now/table/${tableName}`,
        {
          query: {
            sysparm_fields: fieldNames,
            sysparm_limit: Math.min(options.maxRows, 100),
          },
        },
      );

      for (const column of columns) {
        const values = (result.result || [])
          .map((r: any) => {
            const val = r[column.name];
            return typeof val === 'object' ? val?.display_value || val?.value : val;
          })
          .filter((v: any) => v != null && v !== '');

        yield {
          assetExternalId,
          fieldName: column.name,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`ServiceNow sampling failed for ${tableName}: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const tableName = assetExternalId.replace('table:', '');
    const policies: AccessPolicy[] = [];

    try {
      const result = await this.request<any>(
        'GET',
        '/api/now/table/sys_security_acl',
        {
          query: {
            sysparm_query: `name=${tableName}`,
            sysparm_fields: 'name,operation,type,sys_id',
            sysparm_limit: 50,
          },
        },
      );

      for (const acl of result.result || []) {
        policies.push({
          principal: acl.type || 'role',
          principalType: 'role',
          permissions: [acl.operation || 'read'],
          source: 'sys_security_acl',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching ServiceNow ACLs: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'servicenow',
      displayName: 'ServiceNow',
      description: 'Connect to ServiceNow for table discovery and data classification',
      authMethods: ['oauth2', 'basic_auth'],
      requiredPermissions: [
        'Table API read access',
        'sys_db_object read',
        'sys_dictionary read',
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
