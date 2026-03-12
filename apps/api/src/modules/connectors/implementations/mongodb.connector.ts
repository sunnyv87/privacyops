import { MongoClient, Db } from 'mongodb';
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

export class MongodbConnector extends BaseConnector {
  private client: MongoClient;
  private db: Db;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const {
      host,
      port,
      database,
      username,
      password,
      authSource,
      connectionString,
    } = config.credentials;

    const uri =
      connectionString ||
      `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port || 27017}/${database}?authSource=${authSource || 'admin'}`;

    this.client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    await this.withRetry(() => this.client.connect(), 'connect');
    this.db = this.client.db(database);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.withRetry(() => this.db.command({ ping: 1 }), 'testConnection');

      const buildInfo = await this.withRetry(
        () => this.db.admin().command({ buildInfo: 1 }),
        'buildInfo',
      );

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { serverVersion: buildInfo.version },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const collections = await this.withRetry(
      () => this.db.listCollections().toArray(),
      'listCollections',
    );

    for (const collection of collections) {
      const collName = collection.name;

      let docCount: number | undefined;
      try {
        docCount = await this.withRetry(
          () => this.db.collection(collName).estimatedDocumentCount(),
          'estimatedDocumentCount',
        );
      } catch {
        // Count may not be available for all collections
      }

      let sizeBytes: number | undefined;
      try {
        const statsResult = await this.withRetry(
          () =>
            this.db
              .command({ collStats: collName })
              .then((r: any) => r as { size?: number }),
          'collectionStats',
        );
        sizeBytes = statsResult.size;
      } catch {
        // Stats may not be available for all collections
      }

      yield {
        externalId: `collection:${collName}`,
        name: collName,
        type: 'collection',
        path: collName,
        metadata: {
          collectionType: collection.type,
        },
        sizeBytes,
        rowCountEstimate: docCount,
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const collectionName = assetExternalId.replace('collection:', '');

    const sampleDoc = await this.withRetry(
      () => this.db.collection(collectionName).findOne(),
      'getAssetSchema',
    );

    if (!sampleDoc) {
      return { fields: [] };
    }

    const fields = Object.entries(sampleDoc).map(([key, value], idx) => ({
      name: key,
      dataType: this.inferMongoType(value),
      ordinalPosition: idx,
      nullable: true, // MongoDB fields are always optional
      description: undefined,
    }));

    return { fields };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const collectionName = assetExternalId.replace('collection:', '');

    const docs = await this.withRetry(async () => {
      if (options.sampleStrategy === 'random') {
        return await this.db
          .collection(collectionName)
          .aggregate([{ $sample: { size: options.maxRows } }])
          .toArray();
      }
      return await this.db
        .collection(collectionName)
        .find()
        .limit(options.maxRows)
        .toArray();
    }, 'sampleContent');

    if (docs.length === 0) return;

    // Gather all field names from sampled documents
    const fieldNames = new Set<string>();
    for (const doc of docs) {
      Object.keys(doc).forEach((k) => fieldNames.add(k));
    }

    const filteredFields = Array.from(fieldNames)
      .filter(
        (f) =>
          !options.excludePatterns.some((p) =>
            f.toLowerCase().includes(p.toLowerCase()),
          ),
      )
      .slice(0, options.maxColumns);

    for (const fieldName of filteredFields) {
      const values = docs
        .map((doc: any) => doc[fieldName])
        .filter((v: any) => v !== null && v !== undefined);

      yield {
        assetExternalId,
        fieldName,
        values: values.slice(0, 100),
        totalSampled: values.length,
      };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    try {
      const usersInfo = await this.withRetry(
        () => this.db.command({ usersInfo: 1 }),
        'getAccessPolicies',
      );

      const policies: AccessPolicy[] = [];

      for (const user of usersInfo.users || []) {
        const roles = (user.roles || []).map(
          (r: any) => `${r.role}@${r.db}`,
        );

        policies.push({
          principal: user.user,
          principalType: 'user',
          permissions: roles,
          source: 'mongodb_users',
        });
      }

      return policies;
    } catch {
      return [];
    }
  }

  private inferMongoType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object' && value._bsontype === 'ObjectId')
      return 'objectId';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'mongodb',
      displayName: 'MongoDB',
      description:
        'Connect to MongoDB databases for data discovery and classification',
      authMethods: ['connection_string', 'credentials'],
      requiredPermissions: [
        'find on target collections',
        'listCollections on target database',
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
