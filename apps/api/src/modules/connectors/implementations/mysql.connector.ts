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
import { createPool, Pool } from 'mysql2/promise';

export class MysqlConnector extends BaseConnector {
  private pool: Pool;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { host, port, database, username, password, ssl } = config.credentials;

    this.pool = createPool({
      host,
      port: port || 3306,
      database,
      user: username,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        const [rows] = await this.pool.query('SELECT VERSION() as version');
        return (rows as any[])[0].version;
      }, 'testConnection');

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { version: result },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List databases
    const databases = await this.withRetry(async () => {
      const [rows] = await this.pool.query('SHOW DATABASES');
      return (rows as any[]).map((r: any) => r.Database);
    }, 'listDatabases');

    for (const dbName of databases) {
      yield {
        externalId: `database:${dbName}`,
        name: dbName,
        type: 'database',
        path: dbName,
        metadata: {},
      };

      // List tables in each database
      try {
        const tables = await this.withRetry(async () => {
          const [rows] = await this.pool.query(
            `SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, DATA_LENGTH
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME`,
            [dbName],
          );
          return rows as any[];
        }, 'listTables');

        for (const table of tables) {
          yield {
            externalId: `${dbName}.${table.TABLE_NAME}`,
            name: table.TABLE_NAME,
            type: table.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
            path: `${dbName}.${table.TABLE_NAME}`,
            parentExternalId: `database:${dbName}`,
            metadata: {
              tableType: table.TABLE_TYPE,
            },
            sizeBytes: parseInt(table.DATA_LENGTH) || undefined,
            rowCountEstimate: parseInt(table.TABLE_ROWS) || undefined,
          };
        }
      } catch (error: any) {
        console.warn(`Error listing tables in ${dbName}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    const columns = await this.withRetry(async () => {
      const [rows] = await this.pool.query(
        `SELECT COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION, IS_NULLABLE, COLUMN_DEFAULT,
                CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [schemaName, tableName],
      );
      return rows as any[];
    }, 'getAssetSchema');

    return {
      fields: columns.map((col: any) => ({
        name: col.COLUMN_NAME,
        dataType: col.DATA_TYPE,
        ordinalPosition: col.ORDINAL_POSITION,
        nullable: col.IS_NULLABLE === 'YES',
        description: undefined,
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

    const columnNames = columns.map((c) => `\`${c.name}\``).join(', ');
    const rows = await this.withRetry(async () => {
      const query =
        options.sampleStrategy === 'random'
          ? `SELECT ${columnNames} FROM \`${schemaName}\`.\`${tableName}\` ORDER BY RAND() LIMIT ?`
          : `SELECT ${columnNames} FROM \`${schemaName}\`.\`${tableName}\` LIMIT ?`;
      const [rows] = await this.pool.query(query, [options.maxRows]);
      return rows as any[];
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

  async getAccessPolicies(
    assetExternalId: string,
  ): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];

    try {
      const grants = await this.withRetry(async () => {
        const [rows] = await this.pool.query('SHOW GRANTS');
        return rows as any[];
      }, 'getAccessPolicies');

      for (const grant of grants) {
        const grantStr = Object.values(grant)[0] as string;
        policies.push({
          principal: 'current_user',
          principalType: 'user',
          permissions: [grantStr],
          source: 'show_grants',
        });
      }
    } catch (error: any) {
      console.warn(`Error fetching grants: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'mysql',
      displayName: 'MySQL',
      description: 'Connect to MySQL databases for data discovery and classification',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'SELECT on information_schema',
        'SELECT on target tables (read-only user)',
        'SHOW DATABASES',
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
