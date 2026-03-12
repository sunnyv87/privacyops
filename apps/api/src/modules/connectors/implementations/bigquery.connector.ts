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
import { BigQuery, Dataset } from '@google-cloud/bigquery';

export class BigQueryConnector extends BaseConnector {
  private client: BigQuery | null = null;
  private projectId: string;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { projectId, keyFilename, credentialsJson } = config.credentials;
    this.projectId = projectId;

    const options: any = { projectId };
    if (keyFilename) {
      options.keyFilename = keyFilename;
    } else if (credentialsJson) {
      options.credentials =
        typeof credentialsJson === 'string'
          ? JSON.parse(credentialsJson)
          : credentialsJson;
    }

    this.client = new BigQuery(options);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        const [datasets] = await this.client!.getDatasets({ maxResults: 1 });
        return datasets.length;
      }, 'testConnection');

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { projectId: this.projectId, datasetsAccessible: result },
      };
    } catch (error: any) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const [datasets] = await this.withRetry(
      () => this.client!.getDatasets(),
      'listDatasets',
    );

    for (const dataset of datasets) {
      const dsId = dataset.id!;
      yield {
        externalId: `dataset:${dsId}`,
        name: dsId,
        type: 'database',
        path: `${this.projectId}.${dsId}`,
        metadata: { location: dataset.metadata?.location },
      };

      const [tables] = await this.withRetry(
        () => dataset.getTables(),
        'listTables',
      );

      for (const table of tables) {
        const tableId = table.id!;
        const [metadata] = await this.withRetry(
          () => table.getMetadata(),
          'getTableMetadata',
        );

        yield {
          externalId: `${dsId}.${tableId}`,
          name: tableId,
          type: metadata.type === 'VIEW' ? 'view' : 'table',
          path: `${this.projectId}.${dsId}.${tableId}`,
          parentExternalId: `dataset:${dsId}`,
          metadata: {
            tableType: metadata.type,
            creationTime: metadata.creationTime,
          },
          rowCountEstimate: metadata.numRows
            ? Number(metadata.numRows)
            : undefined,
          sizeBytes: metadata.numBytes
            ? Number(metadata.numBytes)
            : undefined,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [datasetId, tableId] = assetExternalId.split('.');

    const [metadata] = await this.withRetry(async () => {
      const dataset = this.client!.dataset(datasetId);
      const table = dataset.table(tableId);
      return table.getMetadata();
    }, 'getAssetSchema');

    const bqFields = metadata.schema?.fields ?? [];

    return {
      fields: bqFields.map((f: any, idx: number) => ({
        name: f.name,
        dataType: f.type,
        ordinalPosition: idx,
        nullable: f.mode !== 'REQUIRED',
        description: f.description,
      })),
      metadata: {
        numRows: metadata.numRows,
        numBytes: metadata.numBytes,
      },
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [datasetId, tableId] = assetExternalId.split('.');
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(
        (f) =>
          !options.excludePatterns.some((p) =>
            f.name.toLowerCase().includes(p.toLowerCase()),
          ),
      );

    if (columns.length === 0) return;

    const columnNames = columns.map((c) => `\`${c.name}\``).join(', ');
    const fqTable = `\`${this.projectId}\`.\`${datasetId}\`.\`${tableId}\``;

    const query =
      options.sampleStrategy === 'random'
        ? `SELECT ${columnNames} FROM ${fqTable} ORDER BY RAND() LIMIT ${Number(options.maxRows)}`
        : `SELECT ${columnNames} FROM ${fqTable} LIMIT ${Number(options.maxRows)}`;

    const [rows] = await this.withRetry(
      () => this.client!.query({ query }),
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

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [datasetId] = assetExternalId.split('.');
    const policies: AccessPolicy[] = [];

    try {
      const dataset = this.client!.dataset(datasetId);
      const [metadata] = await this.withRetry(
        () => dataset.getMetadata(),
        'getAccessPolicies',
      );

      const accessEntries = metadata.access ?? [];
      for (const entry of accessEntries) {
        const principal =
          entry.userByEmail ?? entry.groupByEmail ?? entry.specialGroup ?? 'unknown';
        const principalType: AccessPolicy['principalType'] = entry.userByEmail
          ? 'user'
          : entry.groupByEmail
            ? 'group'
            : entry.specialGroup
              ? 'role'
              : 'service';

        policies.push({
          principal,
          principalType,
          permissions: [entry.role ?? 'READER'],
          source: 'bigquery_dataset_access',
        });
      }
    } catch {
      // Access metadata may not be available
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'bigquery',
      displayName: 'Google BigQuery',
      description:
        'Connect to Google BigQuery for data discovery and classification',
      authMethods: ['service_account', 'application_default'],
      requiredPermissions: [
        'bigquery.datasets.get',
        'bigquery.tables.list',
        'bigquery.tables.getData',
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
