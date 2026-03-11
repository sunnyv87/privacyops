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

// TODO: import @google-cloud/storage when package is installed
// import { Storage, Bucket } from '@google-cloud/storage';

export class GcpStorageConnector extends BaseConnector {
  private client: any; // TODO: type as Storage once @google-cloud/storage is installed
  private projectId: string;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { projectId, keyFilename, credentials: gcpCredentials } = config.credentials;
    this.projectId = projectId;

    // TODO: Replace with actual Storage client creation
    // this.client = new Storage({
    //   projectId,
    //   keyFilename,
    //   credentials: gcpCredentials,
    // });

    this.client = { projectId };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        // TODO: const [buckets] = await this.client.getBuckets();
        // return buckets.length;
        return 0;
      }, 'testConnection');

      return {
        success: true,
        message: `Connected. Found ${result} buckets.`,
        metadata: { bucketCount: result, projectId: this.projectId },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    // GCP Storage client doesn't require explicit disconnect
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List buckets
    const buckets = await this.withRetry(async () => {
      // TODO: const [bucketList] = await this.client.getBuckets();
      // return bucketList;
      return [] as any[];
    }, 'listBuckets');

    for (const bucket of buckets) {
      yield {
        externalId: `gs://${bucket.name}`,
        name: bucket.name,
        type: 'bucket',
        path: `gs://${bucket.name}`,
        metadata: {
          location: bucket.metadata?.location,
          storageClass: bucket.metadata?.storageClass,
          timeCreated: bucket.metadata?.timeCreated,
        },
      };

      // List objects (top-level prefixes)
      try {
        const objects = await this.withRetry(async () => {
          // TODO: const [files] = await this.client.bucket(bucket.name).getFiles({
          //   maxResults: 1000,
          //   delimiter: '/',
          //   autoPaginate: false,
          // });
          // return files;
          return [] as any[];
        }, 'listObjects');

        for (const obj of objects) {
          if (obj.name.endsWith('/')) {
            yield {
              externalId: `gs://${bucket.name}/${obj.name}`,
              name: obj.name.replace(/\/$/, ''),
              type: 'container',
              path: `gs://${bucket.name}/${obj.name}`,
              parentExternalId: `gs://${bucket.name}`,
              metadata: {},
            };
          } else {
            yield {
              externalId: `gs://${bucket.name}/${obj.name}`,
              name: obj.name,
              type: 'file',
              path: `gs://${bucket.name}/${obj.name}`,
              parentExternalId: `gs://${bucket.name}`,
              metadata: {
                contentType: obj.metadata?.contentType,
                timeCreated: obj.metadata?.timeCreated,
                updated: obj.metadata?.updated,
              },
              sizeBytes: parseInt(obj.metadata?.size) || undefined,
            };
          }
        }
      } catch (error: any) {
        console.warn(`Error listing objects in ${bucket.name}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    // For structured files (CSV), parse headers from first line
    try {
      const content = await this.withRetry(async () => {
        // TODO: Parse the GCS path and download first chunk
        // const parts = assetExternalId.replace('gs://', '').split('/');
        // const bucketName = parts[0];
        // const objectName = parts.slice(1).join('/');
        // const [buffer] = await this.client.bucket(bucketName).file(objectName).download({ start: 0, end: 4096 });
        // return buffer.toString('utf-8');
        return '';
      }, 'getAssetSchema');

      if (content) {
        const firstLine = content.split('\n')[0];
        const headers = firstLine.split(',').map((h: string) => h.trim().replace(/"/g, ''));

        return {
          fields: headers.map((name: string, idx: number) => ({
            name,
            dataType: 'string',
            ordinalPosition: idx,
            nullable: true,
            description: undefined,
          })),
        };
      }
    } catch {
      // Schema inference not available for this object type
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // For GCP Storage, we'd download and parse files to extract content samples
    // Similar approach to S3 sampling:
    // 1. Download first chunk of the object
    // 2. Parse based on content type (CSV, JSON, Parquet, etc.)
    // 3. Yield content samples per field
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'gcp_storage',
      displayName: 'Google Cloud Storage',
      description: 'Connect to Google Cloud Storage for data discovery and classification',
      authMethods: ['service_account', 'workload_identity'],
      requiredPermissions: [
        'storage.buckets.list',
        'storage.objects.list',
        'storage.objects.get',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: false,
      },
    };
  }
}
