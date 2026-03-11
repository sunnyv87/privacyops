import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  ConnectorMetadata,
} from '../interfaces/connector.interface';
import { BaseConnector } from '../sdk/base-connector';

// TODO: import mongodb when package is installed
// import { MongoClient, Db } from 'mongodb';

export class MongodbConnector extends BaseConnector {
  private client: any; // TODO: type as MongoClient once mongodb is installed
  private db: any; // TODO: type as Db

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { connectionString, host, port, database, username, password } = config.credentials;

    const uri = connectionString ||
      `mongodb://${username}:${password}@${host}:${port || 27017}/${database}`;

    // TODO: Replace with actual MongoClient creation
    // this.client = new MongoClient(uri, {
    //   maxPoolSize: 5,
    //   serverSelectionTimeoutMS: 5000,
    // });
    // await this.client.connect();
    // this.db = this.client.db(database);

    this.client = { uri, database };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        // TODO: const adminDb = this.client.db().admin();
        // const info = await adminDb.command({ ping: 1 });
        // return info;
        return { ok: 1 };
      }, 'testConnection');

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { ping: result },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client?.close) {
      await this.client.close();
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List collections in the database
    const collections = await this.withRetry(async () => {
      // TODO: const colls = await this.db.listCollections().toArray();
      // return colls;
      return [] as any[];
    }, 'listCollections');

    for (const collection of collections) {
      const collName = collection.name;

      // Get collection stats for metadata
      let stats: any = {};
      try {
        stats = await this.withRetry(async () => {
          // TODO: return await this.db.collection(collName).stats();
          return {};
        }, 'collectionStats');
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
        sizeBytes: stats.size || undefined,
        rowCountEstimate: stats.count || undefined,
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const collectionName = assetExternalId.replace('collection:', '');

    // MongoDB is schema-less, so we infer schema from a sample document
    const sampleDoc = await this.withRetry(async () => {
      // TODO: return await this.db.collection(collectionName).findOne();
      return null as any;
    }, 'getAssetSchema');

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
      // TODO: if (options.sampleStrategy === 'random') {
      //   return await this.db.collection(collectionName)
      //     .aggregate([{ $sample: { size: options.maxRows } }])
      //     .toArray();
      // }
      // return await this.db.collection(collectionName)
      //   .find()
      //   .limit(options.maxRows)
      //   .toArray();
      return [] as any[];
    }, 'sampleContent');

    if (docs.length === 0) return;

    // Gather all field names from sampled documents
    const fieldNames = new Set<string>();
    for (const doc of docs) {
      Object.keys(doc).forEach((k) => fieldNames.add(k));
    }

    const filteredFields = Array.from(fieldNames)
      .filter((f) => !options.excludePatterns.some((p) =>
        f.toLowerCase().includes(p.toLowerCase()),
      ))
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

  private inferMongoType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object' && value._bsontype === 'ObjectId') return 'objectId';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'mongodb',
      displayName: 'MongoDB',
      description: 'Connect to MongoDB databases for data discovery and classification',
      authMethods: ['connection_string'],
      requiredPermissions: [
        'find on target collections',
        'listCollections on target database',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
