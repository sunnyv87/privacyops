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
 * Apache Cassandra / DataStax connector using cassandra-driver.
 * Discovers keyspaces, tables, and materialized views. Samples rows via CQL.
 */
export class CassandraConnector extends BaseConnector {
  private readonly logger = new Logger(CassandraConnector.name);
  private client: any = null;
  private driver: any = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.driver = await import('cassandra-driver');

    const { contactPoints, localDataCenter, username, password, keyspace, port } = config.credentials;

    const clientOptions: any = {
      contactPoints: Array.isArray(contactPoints) ? contactPoints : [contactPoints],
      localDataCenter: localDataCenter || 'datacenter1',
      protocolOptions: { port: port || 9042 },
    };

    if (username && password) {
      clientOptions.authProvider = new this.driver.auth.PlainTextAuthProvider(username, password);
    }

    if (keyspace) {
      clientOptions.keyspace = keyspace;
    }

    this.client = new this.driver.Client(clientOptions);
    await this.client.connect();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(
        () => this.client.execute('SELECT release_version FROM system.local'),
        'testConnection',
      );
      const version = result.rows?.[0]?.release_version;
      return {
        success: true,
        message: `Connected to Cassandra ${version}`,
        metadata: { version },
      };
    } catch (error: any) {
      return { success: false, message: `Cassandra connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List keyspaces (excluding system keyspaces)
    const keyspaces = await this.withRetry(
      () => this.client.execute(
        `SELECT keyspace_name, replication FROM system_schema.keyspaces`,
      ),
      'listKeyspaces',
    );

    const systemKeyspaces = new Set([
      'system', 'system_auth', 'system_distributed', 'system_schema',
      'system_traces', 'system_virtual_schema', 'system_views',
    ]);

    for (const ks of keyspaces.rows || []) {
      if (systemKeyspaces.has(ks.keyspace_name)) continue;

      yield {
        externalId: `keyspace:${ks.keyspace_name}`,
        name: ks.keyspace_name,
        type: 'keyspace',
        path: ks.keyspace_name,
        metadata: {
          replication: ks.replication ? JSON.stringify(ks.replication) : undefined,
        },
      };

      // List tables in keyspace
      try {
        const tables = await this.withRetry(
          () => this.client.execute(
            `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
            [ks.keyspace_name],
          ),
          'listTables',
        );

        for (const table of tables.rows || []) {
          yield {
            externalId: `${ks.keyspace_name}.${table.table_name}`,
            name: table.table_name,
            type: 'table',
            path: `${ks.keyspace_name}.${table.table_name}`,
            parentExternalId: `keyspace:${ks.keyspace_name}`,
            metadata: {},
          };
        }
      } catch (error: any) {
        this.logger.warn(`Error listing tables in ${ks.keyspace_name}: ${error.message}`);
      }

      // List materialized views
      try {
        const views = await this.withRetry(
          () => this.client.execute(
            `SELECT view_name, base_table_name FROM system_schema.views WHERE keyspace_name = ?`,
            [ks.keyspace_name],
          ),
          'listViews',
        );

        for (const view of views.rows || []) {
          yield {
            externalId: `${ks.keyspace_name}.${view.view_name}`,
            name: view.view_name,
            type: 'view',
            path: `${ks.keyspace_name}.${view.view_name}`,
            parentExternalId: `keyspace:${ks.keyspace_name}`,
            metadata: { baseTable: view.base_table_name },
          };
        }
      } catch {
        // Views may not exist
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [keyspace, tableName] = assetExternalId.split('.');

    const result = await this.withRetry(
      () => this.client.execute(
        `SELECT column_name, type, kind, position
         FROM system_schema.columns
         WHERE keyspace_name = ? AND table_name = ?`,
        [keyspace, tableName],
      ),
      'getAssetSchema',
    );

    return {
      fields: (result.rows || []).map((col: any, idx: number) => ({
        name: col.column_name,
        dataType: col.type,
        ordinalPosition: col.position ?? idx,
        nullable: col.kind !== 'partition_key' && col.kind !== 'clustering',
        description: col.kind ? `${col.kind} column` : undefined,
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [keyspace, tableName] = assetExternalId.split('.');
    const schema = await this.getAssetSchema(assetExternalId);

    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const columnNames = columns.map(c => `"${c.name}"`).join(', ');
    // CQL uses LIMIT, no ORDER BY RANDOM — always sequential
    const query = `SELECT ${columnNames} FROM "${keyspace}"."${tableName}" LIMIT ?`;

    const result = await this.withRetry(
      () => this.client.execute(query, [options.maxRows], { prepare: true }),
      'sampleContent',
    );

    for (const column of columns) {
      const values = (result.rows || [])
        .map((row: any) => row[column.name])
        .filter((v: any) => v != null);

      yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
    }
  }

  // Cassandra doesn't have fine-grained table-level grants by default
  async getAccessPolicies(_assetExternalId: string): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];

    try {
      const result = await this.withRetry(
        () => this.client.execute('LIST ALL PERMISSIONS'),
        'getAccessPolicies',
      );

      for (const row of result.rows || []) {
        policies.push({
          principal: row.role || row.username || 'unknown',
          principalType: 'role',
          permissions: [row.permission || 'unknown'],
          source: 'cassandra_permissions',
        });
      }
    } catch {
      // Permission listing may require elevated access
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'cassandra',
      displayName: 'Apache Cassandra',
      description: 'Connect to Apache Cassandra / DataStax for keyspace and table discovery',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'SELECT on system_schema',
        'SELECT on target keyspace tables',
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
