import { Logger } from '@nestjs/common';
import { Client as PgClient } from 'pg';
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
 * Amazon Redshift connector. Uses the PostgreSQL wire protocol (pg driver).
 * Redshift-specific: SVV views for metadata, LIMIT for sampling, owner tracking.
 */
export class RedshiftConnector extends BaseConnector {
  private readonly logger = new Logger(RedshiftConnector.name);
  private client!: PgClient;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { host, port, database, username, password, ssl } = config.credentials;

    this.client = new PgClient({
      host,
      port: port || 5439,
      database,
      user: username,
      password,
      ssl: ssl !== false ? { rejectUnauthorized: true } : false,
    });
    await this.client.connect();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(
        () => this.client.query('SELECT version()'),
        'testConnection',
      );
      return {
        success: true,
        message: 'Connected to Redshift',
        metadata: { version: result.rows[0]?.version },
      };
    } catch (error: any) {
      return { success: false, message: `Redshift connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List schemas (excluding system schemas)
    const schemas = await this.withRetry(
      () => this.client.query(
        `SELECT nspname AS schema_name, nspowner
         FROM pg_namespace
         WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_internal')
         AND nspname NOT LIKE 'pg_temp_%'
         ORDER BY nspname`,
      ),
      'listSchemas',
    );

    for (const schema of schemas.rows) {
      yield {
        externalId: `schema:${schema.schema_name}`,
        name: schema.schema_name,
        type: 'schema',
        path: schema.schema_name,
        metadata: {},
      };

      // List tables and views in schema
      const tables = await this.withRetry(
        () => this.client.query(
          `SELECT t.table_name, t.table_type,
                  pg_table_def.owner as table_owner
           FROM information_schema.tables t
           LEFT JOIN (SELECT DISTINCT schemaname, tablename, "column" IS NOT NULL as has_cols,
                      first_value(tablename) OVER (PARTITION BY schemaname, tablename) as owner
                      FROM pg_table_def WHERE schemaname = $1) pg_table_def
             ON pg_table_def.tablename = t.table_name
           WHERE t.table_schema = $1 AND t.table_type IN ('BASE TABLE', 'VIEW')
           ORDER BY t.table_name`,
          [schema.schema_name],
        ),
        'listTables',
      );

      for (const table of tables.rows) {
        // Get row count estimate from SVV_TABLE_INFO
        let sizeBytes: number | undefined;
        let rowCount: number | undefined;

        try {
          const info = await this.client.query(
            `SELECT tbl_rows, size FROM svv_table_info
             WHERE "schema" = $1 AND "table" = $2`,
            [schema.schema_name, table.table_name],
          );
          if (info.rows[0]) {
            rowCount = parseInt(info.rows[0].tbl_rows) || undefined;
            sizeBytes = (parseInt(info.rows[0].size) || 0) * 1024 * 1024; // size is in MB
          }
        } catch {
          // svv_table_info may not be accessible
        }

        yield {
          externalId: `${schema.schema_name}.${table.table_name}`,
          name: table.table_name,
          type: table.table_type === 'VIEW' ? 'view' : 'table',
          path: `${schema.schema_name}.${table.table_name}`,
          parentExternalId: `schema:${schema.schema_name}`,
          metadata: { tableType: table.table_type, owner: table.table_owner },
          sizeBytes,
          rowCountEstimate: rowCount,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    const result = await this.withRetry(
      () => this.client.query(
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
    const columnNames = columns.map(c => `"${c.name}"`).join(', ');

    // Redshift supports RANDOM() but it's expensive; use LIMIT for first_n
    const query = options.sampleStrategy === 'random'
      ? `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" ORDER BY RANDOM() LIMIT $1`
      : `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" LIMIT $1`;

    const result = await this.withRetry(
      () => this.client.query(query, [options.maxRows]),
      'sampleContent',
    );

    for (const column of columns) {
      const values = result.rows.map(r => r[column.name]).filter(v => v != null);
      yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    try {
      const result = await this.withRetry(
        () => this.client.query(
          `SELECT grantee, privilege_type
           FROM information_schema.table_privileges
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
    } catch (error: any) {
      this.logger.warn(`Error fetching Redshift grants: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'redshift',
      displayName: 'Amazon Redshift',
      description: 'Connect to Amazon Redshift data warehouses for data discovery',
      authMethods: ['connection_string', 'iam_role'],
      requiredPermissions: [
        'SELECT on information_schema',
        'SELECT on svv_table_info',
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
