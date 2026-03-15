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
 * Databricks connector using the Databricks SQL Statement Execution REST API.
 * Discovers Unity Catalog: catalogs → schemas → tables/views.
 */
export class DatabricksConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { token } = config.credentials;
    this.setupBearerAuth(token);
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host } = config.credentials;
    this.baseUrl = `https://${host}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/api/2.0/clusters/list', { query: { max_results: 1 } });
      return {
        success: true,
        message: 'Connected to Databricks',
        metadata: { clusterCount: result.clusters?.length ?? 0 },
      };
    } catch (error: any) {
      return { success: false, message: `Databricks connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    // HTTP-based — no persistent connection
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List catalogs via Unity Catalog REST API
    const catalogs = await this.request<any>('GET', '/api/2.1/unity-catalog/catalogs');

    for (const catalog of catalogs.catalogs || []) {
      yield {
        externalId: `catalog:${catalog.name}`,
        name: catalog.name,
        type: 'database',
        path: catalog.name,
        metadata: { owner: catalog.owner, comment: catalog.comment },
      };

      // List schemas in catalog
      try {
        const schemas = await this.request<any>(
          'GET',
          `/api/2.1/unity-catalog/schemas`,
          { query: { catalog_name: catalog.name } },
        );

        for (const schema of schemas.schemas || []) {
          yield {
            externalId: `schema:${catalog.name}.${schema.name}`,
            name: schema.name,
            type: 'schema',
            path: `${catalog.name}.${schema.name}`,
            parentExternalId: `catalog:${catalog.name}`,
            metadata: { owner: schema.owner, comment: schema.comment },
          };

          // List tables in schema
          try {
            const tables = await this.request<any>(
              'GET',
              `/api/2.1/unity-catalog/tables`,
              { query: { catalog_name: catalog.name, schema_name: schema.name } },
            );

            for (const table of tables.tables || []) {
              yield {
                externalId: `${catalog.name}.${schema.name}.${table.name}`,
                name: table.name,
                type: table.table_type === 'VIEW' ? 'view' : 'table',
                path: `${catalog.name}.${schema.name}.${table.name}`,
                parentExternalId: `schema:${catalog.name}.${schema.name}`,
                metadata: {
                  tableType: table.table_type,
                  dataSourceFormat: table.data_source_format,
                  owner: table.owner,
                  storageLocation: table.storage_location,
                },
              };
            }
          } catch (error: any) {
            this.logger.warn(`Error listing tables in ${catalog.name}.${schema.name}: ${error.message}`);
          }
        }
      } catch (error: any) {
        this.logger.warn(`Error listing schemas in ${catalog.name}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    // Use Unity Catalog table info which includes column metadata
    const parts = assetExternalId.split('.');
    if (parts.length < 3) return { fields: [] };

    const [catalog, schema, table] = parts;

    try {
      const tableInfo = await this.request<any>(
        'GET',
        `/api/2.1/unity-catalog/tables/${catalog}.${schema}.${table}`,
      );

      return {
        fields: (tableInfo.columns || []).map((col: any, idx: number) => ({
          name: col.name,
          dataType: col.type_text || col.type_name || 'unknown',
          ordinalPosition: col.position ?? idx,
          nullable: col.nullable !== false,
          description: col.comment,
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
    const parts = assetExternalId.split('.');
    if (parts.length < 3) return;

    const fullTableName = parts.map(p => this.quoteIdentifier(p, '`')).join('.');
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const columnNames = columns.map(c => this.quoteIdentifier(c.name, '`')).join(', ');
    const safeMaxRows = this.sanitizeMaxRows(options.maxRows);
    const sql = `SELECT ${columnNames} FROM ${fullTableName} LIMIT ${safeMaxRows}`;

    const { warehouseId } = this.config.credentials;
    const stmtResp = await this.request<any>('POST', '/api/2.0/sql/statements', {
      body: {
        warehouse_id: warehouseId,
        statement: sql,
        wait_timeout: '30s',
      },
    });

    if (stmtResp.status?.state !== 'SUCCEEDED') {
      this.logger.warn(`Databricks SQL query did not succeed: ${stmtResp.status?.state}`);
      return;
    }

    const resultColumns = stmtResp.manifest?.schema?.columns || [];
    const dataArray = stmtResp.result?.data_array || [];

    for (const column of columns) {
      const colIdx = resultColumns.findIndex((c: any) => c.name === column.name);
      if (colIdx === -1) continue;

      const values = dataArray.map((row: any[]) => row[colIdx]).filter((v: any) => v != null);
      yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const parts = assetExternalId.split('.');
    if (parts.length < 3) return [];

    const [catalog, schema, table] = parts;
    const policies: AccessPolicy[] = [];

    try {
      const grants = await this.request<any>(
        'GET',
        `/api/2.1/unity-catalog/permissions/${catalog}.${schema}.${table}`,
      );

      for (const assignment of grants.privilege_assignments || []) {
        policies.push({
          principal: assignment.principal,
          principalType: 'role',
          permissions: assignment.privileges || [],
          source: 'unity_catalog',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching Databricks grants: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'databricks',
      displayName: 'Databricks',
      description: 'Connect to Databricks Unity Catalog for data discovery',
      authMethods: ['pat', 'oauth2'],
      requiredPermissions: [
        'USE CATALOG',
        'USE SCHEMA',
        'SELECT on tables',
        'workspace access',
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
