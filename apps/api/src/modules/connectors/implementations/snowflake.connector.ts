import { Logger } from '@nestjs/common';
import * as snowflake from 'snowflake-sdk';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
  SchemaField,
} from '../interfaces/connector.interface';
import { BaseConnector } from '../sdk/base-connector';

export class SnowflakeConnector extends BaseConnector {
  private readonly logger = new Logger(SnowflakeConnector.name);
  private connection: snowflake.Connection;
  private database: string;

  private executeQuery(sql: string, binds?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.connection.execute({
        sqlText: sql,
        binds,
        complete: (err: Error | undefined, stmt: snowflake.Statement, rows: any[] | undefined) => {
          if (err) reject(err);
          else resolve(rows || []);
        },
      });
    });
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { account, username, password, warehouse, database, schema, role } =
      config.credentials;

    this.database = database;

    this.connection = snowflake.createConnection({
      account,
      username,
      password,
      warehouse,
      database,
      schema,
      role,
    });

    await this.withRetry(
      () =>
        new Promise<void>((resolve, reject) => {
          this.connection.connect((err: snowflake.SnowflakeError | undefined) => {
            if (err) reject(err);
            else resolve();
          });
        }),
      'connect',
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(
        () => this.executeQuery('SELECT CURRENT_VERSION() AS version'),
        'testConnection',
      );

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { version: result[0]?.version },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await new Promise<void>((resolve, reject) => {
        this.connection.destroy((err: snowflake.SnowflakeError | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const schemas = await this.withRetry(
      () => this.executeQuery(`SHOW SCHEMAS IN DATABASE ${this.database}`),
      'listSchemas',
    );

    for (const schema of schemas) {
      const schemaName: string = schema.name;

      if (schemaName === 'INFORMATION_SCHEMA') continue;

      yield {
        externalId: `${this.database}.${schemaName}`,
        name: schemaName,
        type: 'schema',
        path: `${this.database}.${schemaName}`,
        metadata: {
          owner: schema.owner,
          createdOn: schema.created_on,
        },
      };

      try {
        const tables = await this.withRetry(
          () =>
            this.executeQuery(
              `SHOW TABLES IN SCHEMA ${this.database}.${schemaName}`,
            ),
          'listTables',
        );

        for (const table of tables) {
          yield {
            externalId: `${this.database}.${schemaName}.${table.name}`,
            name: table.name,
            type: 'table',
            path: `${this.database}.${schemaName}.${table.name}`,
            parentExternalId: `${this.database}.${schemaName}`,
            metadata: {
              kind: table.kind,
              owner: table.owner,
              clusterBy: table.cluster_by,
            },
            sizeBytes: parseInt(table.bytes) || undefined,
            rowCountEstimate: parseInt(table.rows) || undefined,
          };
        }

        const views = await this.withRetry(
          () =>
            this.executeQuery(
              `SHOW VIEWS IN SCHEMA ${this.database}.${schemaName}`,
            ),
          'listViews',
        );

        for (const view of views) {
          yield {
            externalId: `${this.database}.${schemaName}.${view.name}`,
            name: view.name,
            type: 'view',
            path: `${this.database}.${schemaName}.${view.name}`,
            parentExternalId: `${this.database}.${schemaName}`,
            metadata: {
              owner: view.owner,
              isSecure: view.is_secure === 'true',
            },
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `Error listing tables/views in ${schemaName}: ${error.message}`,
        );
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [database, schema, table] = assetExternalId.split('.');

    const columns = await this.withRetry(
      () => this.executeQuery(`DESCRIBE TABLE ${database}.${schema}.${table}`),
      'getAssetSchema',
    );

    const fields: SchemaField[] = columns.map((col: any, idx: number) => ({
      name: col.name,
      dataType: col.type,
      ordinalPosition: idx,
      nullable: col['null?'] === 'Y',
      description: col.comment || undefined,
    }));

    return { fields };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [database, schema, table] = assetExternalId.split('.');

    const assetSchema = await this.getAssetSchema(assetExternalId);
    const columns = assetSchema.fields
      .slice(0, options.maxColumns)
      .filter(
        (f) =>
          !options.excludePatterns.some((p) =>
            f.name.toLowerCase().includes(p.toLowerCase()),
          ),
      );

    if (columns.length === 0) return;

    const columnNames = this.sanitizeColumnList(columns.map((c) => c.name));
    const safeDb = this.quoteIdentifier(database);
    const safeSchema = this.quoteIdentifier(schema);
    const safeTable = this.quoteIdentifier(table);
    const qualifiedTable = `${safeDb}.${safeSchema}.${safeTable}`;
    const safeMaxRows = this.sanitizeMaxRows(options.maxRows);

    const query =
      options.sampleStrategy === 'random'
        ? `SELECT ${columnNames} FROM ${qualifiedTable} SAMPLE (${safeMaxRows} ROWS)`
        : `SELECT ${columnNames} FROM ${qualifiedTable} LIMIT ${safeMaxRows}`;

    const rows = await this.withRetry(
      () => this.executeQuery(query),
      'sampleContent',
    );

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
    const [database, schema, table] = assetExternalId.split('.');
    const qualifiedTable = `${database}.${schema}.${table}`;
    const policies: AccessPolicy[] = [];

    try {
      const grants = await this.withRetry(
        () => this.executeQuery(`SHOW GRANTS ON TABLE ${qualifiedTable}`),
        'getAccessPolicies',
      );

      for (const grant of grants) {
        policies.push({
          principal: grant.grantee_name || grant.grantee,
          principalType: 'role',
          permissions: [grant.privilege],
          source: 'snowflake_grants',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching grants: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'snowflake',
      displayName: 'Snowflake',
      description:
        'Connect to Snowflake data warehouse for data discovery and classification',
      authMethods: ['username_password', 'key_pair', 'oauth'],
      requiredPermissions: [
        'USAGE on warehouse',
        'USAGE on database',
        'SELECT on target tables',
        'SHOW SCHEMAS / SHOW TABLES',
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
