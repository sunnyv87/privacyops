import { Logger } from '@nestjs/common';
import { Client as PgClient } from 'pg';
import { createPool, Pool as MysqlPool } from 'mysql2/promise';
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

type RdsEngine = 'postgres' | 'mysql';

/**
 * AWS RDS connector supporting both PostgreSQL and MySQL engines.
 * Thin wrapper that delegates to the appropriate driver based on the engine config.
 */
export class AwsRdsConnector extends BaseConnector {
  private readonly logger = new Logger(AwsRdsConnector.name);
  private engine: RdsEngine = 'postgres';
  private pgClient: PgClient | null = null;
  private mysqlPool: MysqlPool | null = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { host, port, database, username, password, ssl, engine } = config.credentials;
    this.engine = engine === 'mysql' ? 'mysql' : 'postgres';

    if (this.engine === 'mysql') {
      this.mysqlPool = createPool({
        host,
        port: port || 3306,
        database,
        user: username,
        password,
        ssl: ssl !== false ? { rejectUnauthorized: true } : undefined,
        waitForConnections: true,
        connectionLimit: 5,
      });
    } else {
      this.pgClient = new PgClient({
        host,
        port: port || 5432,
        database,
        user: username,
        password,
        ssl: ssl !== false ? { rejectUnauthorized: true } : false,
      });
      await this.pgClient.connect();
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (this.engine === 'mysql') {
        const [rows] = await this.withRetry(
          () => this.mysqlPool!.query('SELECT VERSION() as version'),
          'testConnection',
        );
        return {
          success: true,
          message: 'Connected to RDS MySQL',
          metadata: { engine: 'mysql', version: (rows as any[])[0]?.version },
        };
      }

      const result = await this.withRetry(
        () => this.pgClient!.query('SELECT version()'),
        'testConnection',
      );
      return {
        success: true,
        message: 'Connected to RDS PostgreSQL',
        metadata: { engine: 'postgres', version: result.rows[0]?.version },
      };
    } catch (error: any) {
      return { success: false, message: `RDS connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.pgClient) await this.pgClient.end();
    if (this.mysqlPool) await this.mysqlPool.end();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    if (this.engine === 'mysql') {
      yield* this.listMysqlAssets();
    } else {
      yield* this.listPostgresAssets();
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    if (this.engine === 'mysql') {
      const [rows] = await this.withRetry(
        () => this.mysqlPool!.query(
          `SELECT COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION, IS_NULLABLE
           FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [schemaName, tableName],
        ),
        'getAssetSchema',
      );
      return {
        fields: (rows as any[]).map(col => ({
          name: col.COLUMN_NAME,
          dataType: col.DATA_TYPE,
          ordinalPosition: col.ORDINAL_POSITION,
          nullable: col.IS_NULLABLE === 'YES',
        })),
      };
    }

    const result = await this.withRetry(
      () => this.pgClient!.query(
        `SELECT column_name, data_type, ordinal_position, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schemaName, tableName],
      ),
      'getAssetSchema',
    );
    return {
      fields: result.rows.map(col => ({
        name: col.column_name,
        dataType: col.data_type,
        ordinalPosition: col.ordinal_position,
        nullable: col.is_nullable === 'YES',
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const [schemaName, tableName] = assetExternalId.split('.');

    if (this.engine === 'mysql') {
      const columnNames = columns.map(c => this.quoteIdentifier(c.name, '`')).join(', ');
      const safeSchema = this.quoteIdentifier(schemaName, '`');
      const safeTable = this.quoteIdentifier(tableName, '`');
      const query = options.sampleStrategy === 'random'
        ? `SELECT ${columnNames} FROM ${safeSchema}.${safeTable} ORDER BY RAND() LIMIT ?`
        : `SELECT ${columnNames} FROM ${safeSchema}.${safeTable} LIMIT ?`;
      const [rows] = await this.withRetry(
        () => this.mysqlPool!.query(query, [options.maxRows]),
        'sampleContent',
      );

      for (const column of columns) {
        const values = (rows as any[]).map(r => r[column.name]).filter(v => v != null);
        yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
      }
    } else {
      const columnNames = this.sanitizeColumnList(columns.map(c => c.name));
      const safeSchema = this.quoteIdentifier(schemaName);
      const safeTable = this.quoteIdentifier(tableName);
      const query = options.sampleStrategy === 'random'
        ? `SELECT ${columnNames} FROM ${safeSchema}.${safeTable} ORDER BY RANDOM() LIMIT $1`
        : `SELECT ${columnNames} FROM ${safeSchema}.${safeTable} LIMIT $1`;
      const result = await this.withRetry(
        () => this.pgClient!.query(query, [options.maxRows]),
        'sampleContent',
      );

      for (const column of columns) {
        const values = result.rows.map(r => r[column.name]).filter(v => v != null);
        yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
      }
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    try {
      if (this.engine === 'postgres') {
        const result = await this.withRetry(
          () => this.pgClient!.query(
            `SELECT grantee, privilege_type FROM information_schema.table_privileges
             WHERE table_schema = $1 AND table_name = $2`,
            [schemaName, tableName],
          ),
          'getAccessPolicies',
        );
        for (const row of result.rows) {
          policies.push({
            principal: row.grantee,
            principalType: 'role',
            permissions: [row.privilege_type],
            source: 'table_privileges',
          });
        }
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching access policies: ${error.message}`);
    }

    return policies;
  }

  private async *listPostgresAssets(): AsyncGenerator<DiscoveredAsset> {
    const schemas = await this.withRetry(
      () => this.pgClient!.query(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         ORDER BY schema_name`,
      ),
      'listSchemas',
    );

    for (const schema of schemas.rows) {
      yield {
        externalId: `schema:${schema.schema_name}`,
        name: schema.schema_name,
        type: 'schema',
        path: schema.schema_name,
        metadata: { source: 'rds_postgres' },
      };

      const tables = await this.withRetry(
        () => this.pgClient!.query(
          `SELECT t.table_name, t.table_type,
                  pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) as size_bytes,
                  s.n_live_tup as row_count_estimate
           FROM information_schema.tables t
           LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
           WHERE t.table_schema = $1 AND t.table_type IN ('BASE TABLE', 'VIEW')
           ORDER BY t.table_name`,
          [schema.schema_name],
        ),
        'listTables',
      );

      for (const table of tables.rows) {
        yield {
          externalId: `${schema.schema_name}.${table.table_name}`,
          name: table.table_name,
          type: table.table_type === 'VIEW' ? 'view' : 'table',
          path: `${schema.schema_name}.${table.table_name}`,
          parentExternalId: `schema:${schema.schema_name}`,
          metadata: { tableType: table.table_type },
          sizeBytes: parseInt(table.size_bytes) || undefined,
          rowCountEstimate: parseInt(table.row_count_estimate) || undefined,
        };
      }
    }
  }

  private async *listMysqlAssets(): AsyncGenerator<DiscoveredAsset> {
    const [databases] = await this.withRetry(
      () => this.mysqlPool!.query('SHOW DATABASES'),
      'listDatabases',
    );

    for (const db of databases as any[]) {
      const dbName = db.Database;
      yield {
        externalId: `database:${dbName}`,
        name: dbName,
        type: 'database',
        path: dbName,
        metadata: { source: 'rds_mysql' },
      };

      try {
        const [tables] = await this.withRetry(
          () => this.mysqlPool!.query(
            `SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, DATA_LENGTH
             FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
            [dbName],
          ),
          'listTables',
        );

        for (const table of tables as any[]) {
          yield {
            externalId: `${dbName}.${table.TABLE_NAME}`,
            name: table.TABLE_NAME,
            type: table.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
            path: `${dbName}.${table.TABLE_NAME}`,
            parentExternalId: `database:${dbName}`,
            metadata: { tableType: table.TABLE_TYPE },
            sizeBytes: parseInt(table.DATA_LENGTH) || undefined,
            rowCountEstimate: parseInt(table.TABLE_ROWS) || undefined,
          };
        }
      } catch (error: any) {
        this.logger.warn(`Error listing tables in ${dbName}: ${error.message}`);
      }
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'aws_rds',
      displayName: 'Amazon RDS',
      description: 'Connect to AWS RDS databases (PostgreSQL/MySQL) for data discovery',
      authMethods: ['iam_role', 'connection_string'],
      requiredPermissions: [
        'rds-db:connect',
        'SELECT on information_schema',
        'SELECT on target tables',
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
