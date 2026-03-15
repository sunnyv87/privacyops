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
import { BaseConnector } from '../sdk/base-connector';

/**
 * SAP HANA connector using @sap/hana-client.
 * Discovers schemas, tables, views, and column store metadata.
 * Samples rows via SQL and retrieves privilege grants.
 */
export class SapHanaConnector extends BaseConnector {
  private readonly logger = new Logger(SapHanaConnector.name);
  private connection: any = null;
  private driver: any = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.driver = await import('@sap/hana-client');

    const { host, port, user, password, schema, encrypt, sslValidateCertificate } = config.credentials;

    const connParams: Record<string, any> = {
      serverNode: `${host}:${port || 443}`,
      uid: user,
      pwd: password,
      encrypt: encrypt !== false ? 'true' : 'false',
      sslValidateCertificate: sslValidateCertificate !== false ? 'true' : 'false',
    };

    if (schema) {
      connParams.currentSchema = schema;
    }

    this.connection = this.driver.createConnection();
    await new Promise<void>((resolve, reject) => {
      this.connection.connect(connParams, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    return this.withRetry(
      () =>
        new Promise<any[]>((resolve, reject) => {
          this.connection.exec(sql, params, (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }),
      'query',
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const rows = await this.query('SELECT VERSION FROM SYS.M_DATABASE');
      const version = rows[0]?.VERSION;
      return {
        success: true,
        message: `Connected to SAP HANA ${version}`,
        metadata: { version },
      };
    } catch (error: any) {
      return { success: false, message: `SAP HANA connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await new Promise<void>((resolve) => {
        this.connection.disconnect(() => resolve());
      });
      this.connection = null;
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List non-system schemas
    const schemas = await this.query(
      `SELECT SCHEMA_NAME, SCHEMA_OWNER
       FROM SYS.SCHEMAS
       WHERE HAS_PRIVILEGES = 'TRUE'
         AND SCHEMA_NAME NOT LIKE 'SYS%'
         AND SCHEMA_NAME NOT LIKE '_SYS%'
         AND SCHEMA_NAME NOT IN ('SYSTEM', 'SAP_XS_LM', 'SAP_REST_API')
       ORDER BY SCHEMA_NAME`,
    );

    for (const schema of schemas) {
      yield {
        externalId: `schema:${schema.SCHEMA_NAME}`,
        name: schema.SCHEMA_NAME,
        type: 'schema',
        path: schema.SCHEMA_NAME,
        metadata: { owner: schema.SCHEMA_OWNER },
      };

      // Tables in schema
      try {
        const tables = await this.query(
          `SELECT TABLE_NAME, TABLE_TYPE, RECORD_COUNT, DISK_SIZE, IS_COLUMN_TABLE
           FROM SYS.M_TABLES
           WHERE SCHEMA_NAME = ?
           ORDER BY TABLE_NAME`,
          [schema.SCHEMA_NAME],
        );

        for (const table of tables) {
          yield {
            externalId: `${schema.SCHEMA_NAME}.${table.TABLE_NAME}`,
            name: table.TABLE_NAME,
            type: 'table',
            path: `${schema.SCHEMA_NAME}.${table.TABLE_NAME}`,
            parentExternalId: `schema:${schema.SCHEMA_NAME}`,
            metadata: {
              tableType: table.TABLE_TYPE,
              isColumnStore: table.IS_COLUMN_TABLE === 'TRUE',
            },
            sizeBytes: table.DISK_SIZE ? Number(table.DISK_SIZE) : undefined,
            rowCountEstimate: table.RECORD_COUNT ? Number(table.RECORD_COUNT) : undefined,
          };
        }
      } catch (error: any) {
        this.logger.warn(`Error listing tables in ${schema.SCHEMA_NAME}: ${error.message}`);
      }

      // Views in schema
      try {
        const views = await this.query(
          `SELECT VIEW_NAME, VIEW_TYPE
           FROM SYS.VIEWS
           WHERE SCHEMA_NAME = ?
             AND VIEW_NAME NOT LIKE 'SYS%'
           ORDER BY VIEW_NAME`,
          [schema.SCHEMA_NAME],
        );

        for (const view of views) {
          yield {
            externalId: `${schema.SCHEMA_NAME}.${view.VIEW_NAME}`,
            name: view.VIEW_NAME,
            type: 'view',
            path: `${schema.SCHEMA_NAME}.${view.VIEW_NAME}`,
            parentExternalId: `schema:${schema.SCHEMA_NAME}`,
            metadata: { viewType: view.VIEW_TYPE },
          };
        }
      } catch {}
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');
    if (!schemaName || !tableName) return { fields: [] };

    try {
      const columns = await this.query(
        `SELECT COLUMN_NAME, DATA_TYPE_NAME, POSITION, IS_NULLABLE, LENGTH, SCALE, COMMENTS
         FROM SYS.TABLE_COLUMNS
         WHERE SCHEMA_NAME = ? AND TABLE_NAME = ?
         ORDER BY POSITION`,
        [schemaName, tableName],
      );

      return {
        fields: columns.map((col: any) => ({
          name: col.COLUMN_NAME,
          dataType: col.DATA_TYPE_NAME,
          ordinalPosition: col.POSITION - 1,
          nullable: col.IS_NULLABLE === 'TRUE',
          description: col.COMMENTS || undefined,
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
    const [schemaName, tableName] = assetExternalId.split('.');
    if (!schemaName || !tableName) return;

    try {
      const schema = await this.getAssetSchema(assetExternalId);
      const columns = schema.fields
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

      if (columns.length === 0) return;

      const columnNames = this.sanitizeColumnList(columns.map(c => c.name));
      const safeSchema = this.quoteIdentifier(schemaName);
      const safeTable = this.quoteIdentifier(tableName);
      const safeMaxRows = this.sanitizeMaxRows(options.maxRows, 100);
      const rows = await this.query(
        `SELECT TOP ${safeMaxRows} ${columnNames}
         FROM ${safeSchema}.${safeTable}`,
      );

      for (const column of columns) {
        const values = rows
          .map((row: any) => row[column.name])
          .filter((v: any) => v != null && v !== '');

        yield {
          assetExternalId,
          fieldName: column.name,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`SAP HANA sampling failed for ${assetExternalId}: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    if (!schemaName || !tableName) return policies;

    try {
      const grants = await this.query(
        `SELECT GRANTEE, GRANTEE_TYPE, PRIVILEGE, IS_GRANTABLE
         FROM SYS.GRANTED_PRIVILEGES
         WHERE SCHEMA_NAME = ? AND OBJECT_NAME = ?`,
        [schemaName, tableName],
      );

      for (const grant of grants) {
        policies.push({
          principal: grant.GRANTEE,
          principalType: grant.GRANTEE_TYPE === 'ROLE' ? 'role' : 'user',
          permissions: [grant.PRIVILEGE],
          source: 'hana_privileges',
        });
      }
    } catch {}

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'sap_hana',
      displayName: 'SAP HANA',
      description: 'Connect to SAP HANA for schema, table, and view discovery with column store support',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'SELECT on SYS.SCHEMAS',
        'SELECT on SYS.M_TABLES',
        'SELECT on SYS.TABLE_COLUMNS',
        'SELECT on target schema tables',
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
