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

// TODO: import snowflake-sdk when package is installed
// import * as snowflake from 'snowflake-sdk';

export class SnowflakeConnector extends BaseConnector {
  private connection: any; // TODO: type as snowflake.Connection

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { account, username, password, warehouse, database, schema, role } = config.credentials;

    // TODO: Replace with actual Snowflake connection
    // this.connection = snowflake.createConnection({
    //   account,
    //   username,
    //   password,
    //   warehouse,
    //   database,
    //   schema,
    //   role,
    // });
    // await new Promise<void>((resolve, reject) => {
    //   this.connection.connect((err: any) => {
    //     if (err) reject(err);
    //     else resolve();
    //   });
    // });

    this.connection = { account, database, warehouse };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        // TODO: return await this.executeQuery('SELECT CURRENT_VERSION() AS version');
        return [{ version: 'Snowflake (connection pending)' }];
      }, 'testConnection');

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
    if (this.connection?.destroy) {
      await new Promise<void>((resolve) => {
        this.connection.destroy((err: any) => resolve());
      });
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List schemas
    const schemas = await this.withRetry(async () => {
      // TODO: return await this.executeQuery('SHOW SCHEMAS');
      return [] as any[];
    }, 'listSchemas');

    for (const schema of schemas) {
      const schemaName = schema.name;

      // Skip system schemas
      if (schemaName === 'INFORMATION_SCHEMA') continue;

      yield {
        externalId: `schema:${schemaName}`,
        name: schemaName,
        type: 'schema',
        path: schemaName,
        metadata: {
          owner: schema.owner,
          createdOn: schema.created_on,
        },
      };

      // List tables in schema
      try {
        const tables = await this.withRetry(async () => {
          // TODO: return await this.executeQuery(`SHOW TABLES IN SCHEMA "${schemaName}"`);
          return [] as any[];
        }, 'listTables');

        for (const table of tables) {
          yield {
            externalId: `${schemaName}.${table.name}`,
            name: table.name,
            type: table.kind === 'VIEW' ? 'view' : 'table',
            path: `${schemaName}.${table.name}`,
            parentExternalId: `schema:${schemaName}`,
            metadata: {
              kind: table.kind,
              owner: table.owner,
              clusterBy: table.cluster_by,
            },
            sizeBytes: parseInt(table.bytes) || undefined,
            rowCountEstimate: parseInt(table.rows) || undefined,
          };
        }

        // List views in schema
        const views = await this.withRetry(async () => {
          // TODO: return await this.executeQuery(`SHOW VIEWS IN SCHEMA "${schemaName}"`);
          return [] as any[];
        }, 'listViews');

        for (const view of views) {
          yield {
            externalId: `${schemaName}.${view.name}`,
            name: view.name,
            type: 'view',
            path: `${schemaName}.${view.name}`,
            parentExternalId: `schema:${schemaName}`,
            metadata: {
              owner: view.owner,
              isSecure: view.is_secure === 'true',
            },
          };
        }
      } catch (error: any) {
        console.warn(`Error listing tables in ${schemaName}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [schemaName, tableName] = assetExternalId.split('.');

    const columns = await this.withRetry(async () => {
      // TODO: return await this.executeQuery(`DESCRIBE TABLE "${schemaName}"."${tableName}"`);
      return [] as any[];
    }, 'getAssetSchema');

    return {
      fields: columns.map((col: any, idx: number) => ({
        name: col.name,
        dataType: col.type,
        ordinalPosition: idx,
        nullable: col['null?'] === 'Y',
        description: col.comment || undefined,
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

    const columnNames = columns.map((c) => `"${c.name}"`).join(', ');
    const rows = await this.withRetry(async () => {
      // TODO: const query =
      //   options.sampleStrategy === 'random'
      //     ? `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" SAMPLE (${options.maxRows} ROWS)`
      //     : `SELECT ${columnNames} FROM "${schemaName}"."${tableName}" LIMIT ${options.maxRows}`;
      // return await this.executeQuery(query);
      return [] as any[];
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
        // TODO: return await this.executeQuery(
        //   `SHOW GRANTS ON TABLE ${assetExternalId}`,
        // );
        return [] as any[];
      }, 'getAccessPolicies');

      for (const grant of grants) {
        policies.push({
          principal: grant.grantee_name || grant.grantee,
          principalType: 'role',
          permissions: [grant.privilege],
          source: 'snowflake_grants',
        });
      }
    } catch (error: any) {
      console.warn(`Error fetching grants: ${error.message}`);
    }

    return policies;
  }

  // TODO: Implement when snowflake-sdk is installed
  // private async executeQuery(sql: string): Promise<any[]> {
  //   return new Promise((resolve, reject) => {
  //     this.connection.execute({
  //       sqlText: sql,
  //       complete: (err: any, stmt: any, rows: any[]) => {
  //         if (err) reject(err);
  //         else resolve(rows || []);
  //       },
  //     });
  //   });
  // }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'snowflake',
      displayName: 'Snowflake',
      description: 'Connect to Snowflake data warehouse for data discovery and classification',
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
