import { Client as PgClient } from 'pg';
import {
  IConnector,
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';

export class PostgresConnector implements IConnector {
  private client!: PgClient;
  private config!: ConnectorConfig;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    const { host, port, database, username, password, ssl } = config.credentials;

    this.client = new PgClient({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
    });

    await this.client.connect();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.client.query('SELECT version()');
      return {
        success: true,
        message: 'Connected successfully',
        metadata: {
          version: result.rows[0].version,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List schemas
    const schemas = await this.client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    for (const schema of schemas.rows) {
      yield {
        externalId: `schema:${schema.schema_name}`,
        name: schema.schema_name,
        type: 'schema',
        path: schema.schema_name,
        metadata: {},
      };

      // List tables in schema
      const tables = await this.client.query(
        `
        SELECT
          t.table_name,
          t.table_type,
          pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) as size_bytes,
          s.n_live_tup as row_count_estimate
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s
          ON s.schemaname = t.table_schema AND s.relname = t.table_name
        WHERE t.table_schema = $1
          AND t.table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY t.table_name
        `,
        [schema.schema_name],
      );

      for (const table of tables.rows) {
        yield {
          externalId: `${schema.schema_name}.${table.table_name}`,
          name: table.table_name,
          type: table.table_type === 'VIEW' ? 'view' : 'table',
          path: `${schema.schema_name}.${table.table_name}`,
          parentExternalId: `schema:${schema.schema_name}`,
          metadata: {
            tableType: table.table_type,
          },
          sizeBytes: parseInt(table.size_bytes) || undefined,
          rowCountEstimate: parseInt(table.row_count_estimate) || undefined,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    const columns = await this.client.query(
      `
      SELECT
        column_name,
        data_type,
        ordinal_position,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
      `,
      [schemaName, tableName],
    );

    return {
      fields: columns.rows.map((col) => ({
        name: col.column_name,
        dataType: col.data_type,
        ordinalPosition: col.ordinal_position,
        nullable: col.is_nullable === 'YES',
        description: undefined,
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [schemaName, tableName] = assetExternalId.split('.');

    // Get column names first
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter((f) => !options.excludePatterns.some((p) =>
        f.name.toLowerCase().includes(p.toLowerCase()),
      ));

    if (columns.length === 0) return;

    // Sample rows
    const columnNames = columns.map((c) => `"${c.name}"`).join(', ');
    const query =
      options.sampleStrategy === 'random'
        ? `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" ORDER BY RANDOM() LIMIT $1`
        : `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" LIMIT $1`;

    const result = await this.client.query(query, [options.maxRows]);

    // Yield samples per column
    for (const column of columns) {
      const values = result.rows
        .map((row) => row[column.name])
        .filter((v) => v !== null && v !== undefined);

      yield {
        assetExternalId,
        fieldName: column.name,
        values: values.slice(0, 100), // Limit to 100 sample values per column
        totalSampled: values.length,
      };
    }
  }

  async getAccessPolicies(
    assetExternalId: string,
  ): Promise<AccessPolicy[]> {
    const [schemaName, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    // Check table privileges
    const privileges = await this.client.query(
      `
      SELECT grantee, privilege_type
      FROM information_schema.table_privileges
      WHERE table_schema = $1 AND table_name = $2
      `,
      [schemaName, tableName],
    );

    for (const priv of privileges.rows) {
      policies.push({
        principal: priv.grantee,
        principalType: 'role',
        permissions: [priv.privilege_type],
        source: 'table_privileges',
      });
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'postgresql',
      displayName: 'PostgreSQL',
      description: 'Connect to PostgreSQL databases for data discovery and classification',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'SELECT on information_schema',
        'SELECT on target tables (read-only user)',
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
