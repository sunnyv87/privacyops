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
 * Oracle Database connector using oracledb in Thin mode (pure JS, no native deps).
 * Discovers schemas, tables, views. Samples rows and retrieves grant-based access policies.
 */
export class OracleConnector extends BaseConnector {
  private readonly logger = new Logger(OracleConnector.name);
  private connection: any = null;
  private oracledb: any = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.oracledb = await import('oracledb');
    // Thin mode — pure JS, no Oracle Instant Client required
    this.oracledb.initOracleClient?.();

    const { host, port, serviceName, sid, username, password, connectString } = config.credentials;

    const connStr = connectString || `${host}:${port || 1521}/${serviceName || sid}`;
    this.connection = await this.oracledb.getConnection({
      user: username,
      password,
      connectString: connStr,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(
        () => this.connection.execute('SELECT banner FROM v$version WHERE ROWNUM = 1'),
        'testConnection',
      );
      return {
        success: true,
        message: 'Connected to Oracle',
        metadata: { version: result.rows?.[0]?.[0] },
      };
    } catch (error: any) {
      return { success: false, message: `Oracle connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List schemas (users with objects)
    const schemas = await this.withRetry(
      () => this.connection.execute(
        `SELECT DISTINCT owner FROM all_tables
         WHERE owner NOT IN ('SYS','SYSTEM','DBSNMP','OUTLN','MDSYS','ORDSYS','ORDDATA',
                             'CTXSYS','ANONYMOUS','EXFSYS','WMSYS','XDB','APEX_040200',
                             'APEX_PUBLIC_USER','FLOWS_FILES','HR','OE','PM','IX','SH','BI')
         ORDER BY owner`,
      ),
      'listSchemas',
    );

    for (const row of schemas.rows || []) {
      const schemaName = row[0];
      yield {
        externalId: `schema:${schemaName}`,
        name: schemaName,
        type: 'schema',
        path: schemaName,
        metadata: {},
      };

      // List tables
      try {
        const tables = await this.withRetry(
          () => this.connection.execute(
            `SELECT table_name, num_rows, blocks * 8192 as size_bytes
             FROM all_tables WHERE owner = :owner ORDER BY table_name`,
            [schemaName],
          ),
          'listTables',
        );

        for (const tRow of tables.rows || []) {
          yield {
            externalId: `${schemaName}.${tRow[0]}`,
            name: tRow[0],
            type: 'table',
            path: `${schemaName}.${tRow[0]}`,
            parentExternalId: `schema:${schemaName}`,
            metadata: {},
            rowCountEstimate: tRow[1] || undefined,
            sizeBytes: tRow[2] || undefined,
          };
        }
      } catch (error: any) {
        this.logger.warn(`Error listing tables in ${schemaName}: ${error.message}`);
      }

      // List views
      try {
        const views = await this.withRetry(
          () => this.connection.execute(
            `SELECT view_name FROM all_views WHERE owner = :owner ORDER BY view_name`,
            [schemaName],
          ),
          'listViews',
        );

        for (const vRow of views.rows || []) {
          yield {
            externalId: `${schemaName}.${vRow[0]}`,
            name: vRow[0],
            type: 'view',
            path: `${schemaName}.${vRow[0]}`,
            parentExternalId: `schema:${schemaName}`,
            metadata: {},
          };
        }
      } catch (error: any) {
        this.logger.warn(`Error listing views in ${schemaName}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [owner, tableName] = assetExternalId.split('.');

    const result = await this.withRetry(
      () => this.connection.execute(
        `SELECT column_name, data_type, column_id, nullable
         FROM all_tab_columns
         WHERE owner = :owner AND table_name = :tableName
         ORDER BY column_id`,
        [owner, tableName],
      ),
      'getAssetSchema',
    );

    return {
      fields: (result.rows || []).map((row: any[]) => ({
        name: row[0],
        dataType: row[1],
        ordinalPosition: row[2],
        nullable: row[3] === 'Y',
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [owner, tableName] = assetExternalId.split('.');
    const schema = await this.getAssetSchema(assetExternalId);

    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    const columnNames = this.sanitizeColumnList(columns.map(c => c.name));
    const safeOwner = this.quoteIdentifier(owner);
    const safeTable = this.quoteIdentifier(tableName);
    // Oracle uses FETCH FIRST N ROWS ONLY (12c+) or ROWNUM
    const query = options.sampleStrategy === 'random'
      ? `SELECT ${columnNames} FROM ${safeOwner}.${safeTable} ORDER BY DBMS_RANDOM.VALUE FETCH FIRST :maxRows ROWS ONLY`
      : `SELECT ${columnNames} FROM ${safeOwner}.${safeTable} FETCH FIRST :maxRows ROWS ONLY`;

    const result = await this.withRetry(
      () => this.connection.execute(query, [options.maxRows]),
      'sampleContent',
    );

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const values = (result.rows || []).map((row: any[]) => row[colIdx]).filter((v: any) => v != null);
      yield { assetExternalId, fieldName: columns[colIdx].name, values: values.slice(0, 100), totalSampled: values.length };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [owner, tableName] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    try {
      const result = await this.withRetry(
        () => this.connection.execute(
          `SELECT grantee, privilege FROM all_tab_privs
           WHERE table_schema = :owner AND table_name = :tableName`,
          [owner, tableName],
        ),
        'getAccessPolicies',
      );

      for (const row of result.rows || []) {
        policies.push({
          principal: row[0],
          principalType: 'role',
          permissions: [row[1]],
          source: 'all_tab_privs',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching Oracle grants: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'oracle',
      displayName: 'Oracle Database',
      description: 'Connect to Oracle Database for schema discovery and data classification',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'SELECT on ALL_TABLES',
        'SELECT on ALL_TAB_COLUMNS',
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
