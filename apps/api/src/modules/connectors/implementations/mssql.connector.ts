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
import * as sql from 'mssql';

export class MssqlConnector extends BaseConnector {
  private pool: sql.ConnectionPool | null = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { host, port, database, username, password, encrypt, trustServerCertificate } =
      config.credentials;

    this.pool = new sql.ConnectionPool({
      server: host,
      port: port || 1433,
      database,
      user: username,
      password,
      options: {
        encrypt: encrypt ?? true,
        trustServerCertificate: trustServerCertificate ?? false,
      },
      requestTimeout: 30000,
      connectionTimeout: 15000,
    });

    await this.pool.connect();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        const res = await this.pool!.request().query('SELECT @@VERSION as version');
        return res.recordset[0].version;
      }, 'testConnection');

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { version: String(result).split('\n')[0] },
      };
    } catch (error: any) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const schemas = await this.withRetry(async () => {
      const res = await this.pool!.request().query(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
         WHERE SCHEMA_NAME NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
         ORDER BY SCHEMA_NAME`,
      );
      return res.recordset.map((r: any) => r.SCHEMA_NAME);
    }, 'listSchemas');

    for (const schemaName of schemas) {
      yield {
        externalId: `schema:${schemaName}`,
        name: schemaName,
        type: 'schema',
        path: schemaName,
        metadata: {},
      };

      const tables = await this.withRetry(async () => {
        const res = await this.pool!.request()
          .input('schema', sql.NVarChar, schemaName)
          .query(
            `SELECT t.TABLE_NAME, t.TABLE_TYPE,
                    p.rows AS ROW_ESTIMATE,
                    SUM(a.total_pages) * 8 * 1024 AS SIZE_BYTES
             FROM INFORMATION_SCHEMA.TABLES t
             LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME
             LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0, 1)
             LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
             WHERE t.TABLE_SCHEMA = @schema
             GROUP BY t.TABLE_NAME, t.TABLE_TYPE, p.rows
             ORDER BY t.TABLE_NAME`,
          );
        return res.recordset;
      }, 'listTables');

      for (const table of tables) {
        yield {
          externalId: `${schemaName}.${table.TABLE_NAME}`,
          name: table.TABLE_NAME,
          type: table.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
          path: `${schemaName}.${table.TABLE_NAME}`,
          parentExternalId: `schema:${schemaName}`,
          metadata: { tableType: table.TABLE_TYPE },
          sizeBytes: table.SIZE_BYTES ? Number(table.SIZE_BYTES) : undefined,
          rowCountEstimate: table.ROW_ESTIMATE ? Number(table.ROW_ESTIMATE) : undefined,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    const columns = await this.withRetry(async () => {
      const res = await this.pool!.request()
        .input('schema', sql.NVarChar, schemaName)
        .input('table', sql.NVarChar, tableName)
        .query(
          `SELECT COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION, IS_NULLABLE,
                  CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
           ORDER BY ORDINAL_POSITION`,
        );
      return res.recordset;
    }, 'getAssetSchema');

    return {
      fields: columns.map((col: any) => ({
        name: col.COLUMN_NAME,
        dataType: col.DATA_TYPE,
        ordinalPosition: col.ORDINAL_POSITION,
        nullable: col.IS_NULLABLE === 'YES',
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter((f) => !options.excludePatterns.some((p) =>
        f.name.toLowerCase().includes(p.toLowerCase()),
      ));

    if (columns.length === 0) return;

    const columnNames = columns.map((c) => `[${c.name}]`).join(', ');

    const rows = await this.withRetry(async () => {
      const query =
        options.sampleStrategy === 'random'
          ? `SELECT TOP (${Number(options.maxRows)}) ${columnNames} FROM [${schemaName}].[${tableName}] ORDER BY NEWID()`
          : `SELECT TOP (${Number(options.maxRows)}) ${columnNames} FROM [${schemaName}].[${tableName}]`;
      const res = await this.pool!.request().query(query);
      return res.recordset;
    }, 'sampleContent');

    for (const column of columns) {
      const values = rows
        .map((row: any) => row[column.name])
        .filter((v: any) => v !== null && v !== undefined);

      yield {
        assetExternalId,
        fieldName: column.name,
        values: values.slice(0, 100),
        totalSampled: values.length,
      };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    try {
      const grants = await this.withRetry(async () => {
        const res = await this.pool!.request()
          .input('schema', sql.NVarChar, schemaName)
          .input('table', sql.NVarChar, tableName)
          .query(
            `SELECT dp.name AS principal_name, dp.type_desc AS principal_type,
                    p.permission_name, p.state_desc
             FROM sys.database_permissions p
             JOIN sys.database_principals dp ON p.grantee_principal_id = dp.principal_id
             JOIN sys.objects o ON p.major_id = o.object_id
             JOIN sys.schemas s ON o.schema_id = s.schema_id
             WHERE s.name = @schema AND o.name = @table`,
          );
        return res.recordset;
      }, 'getAccessPolicies');

      for (const grant of grants) {
        policies.push({
          principal: grant.principal_name,
          principalType: grant.principal_type === 'SQL_USER' ? 'user' : 'role',
          permissions: [`${grant.state_desc} ${grant.permission_name}`],
          source: 'sys.database_permissions',
        });
      }
    } catch {
      // Permission query may fail if user lacks access to sys views
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'sqlserver',
      displayName: 'SQL Server',
      description: 'Connect to Microsoft SQL Server for data discovery and classification',
      authMethods: ['sql_auth', 'windows_auth'],
      requiredPermissions: [
        'SELECT on INFORMATION_SCHEMA',
        'SELECT on target tables',
        'VIEW DATABASE STATE',
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
