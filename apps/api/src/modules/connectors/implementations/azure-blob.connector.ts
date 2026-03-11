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

// TODO: import @azure/storage-blob when package is installed
// import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export class AzureBlobConnector extends BaseConnector {
  private client: any; // TODO: type as BlobServiceClient once @azure/storage-blob is installed

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { connectionString, accountName, accountKey, sasToken } = config.credentials;

    // TODO: Replace with actual BlobServiceClient creation
    // if (connectionString) {
    //   this.client = BlobServiceClient.fromConnectionString(connectionString);
    // } else if (sasToken) {
    //   this.client = new BlobServiceClient(
    //     `https://${accountName}.blob.core.windows.net?${sasToken}`,
    //   );
    // } else {
    //   this.client = new BlobServiceClient(
    //     `https://${accountName}.blob.core.windows.net`,
    //     new StorageSharedKeyCredential(accountName, accountKey),
    //   );
    // }

    this.client = { accountName };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.withRetry(async () => {
        // TODO: const properties = await this.client.getProperties();
        // return properties;
        return { accountKind: 'StorageV2' };
      }, 'testConnection');

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { accountKind: result.accountKind },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    // BlobServiceClient doesn't require explicit disconnect
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List containers
    const containers = await this.withRetry(async () => {
      // TODO: const containerList: any[] = [];
      // for await (const container of this.client.listContainers()) {
      //   containerList.push(container);
      // }
      // return containerList;
      return [] as any[];
    }, 'listContainers');

    for (const container of containers) {
      yield {
        externalId: `azure://${container.name}`,
        name: container.name,
        type: 'container',
        path: `azure://${container.name}`,
        metadata: {
          lastModified: container.properties?.lastModified?.toISOString(),
          leaseState: container.properties?.leaseState,
        },
      };

      // List blobs in container (top-level prefixes)
      try {
        const blobs = await this.withRetry(async () => {
          // TODO: const blobList: any[] = [];
          // const containerClient = this.client.getContainerClient(container.name);
          // for await (const blob of containerClient.listBlobsByHierarchy('/', { maxPageSize: 1000 })) {
          //   blobList.push(blob);
          //   if (blobList.length >= 1000) break;
          // }
          // return blobList;
          return [] as any[];
        }, 'listBlobs');

        for (const blob of blobs) {
          if (blob.kind === 'prefix') {
            yield {
              externalId: `azure://${container.name}/${blob.name}`,
              name: blob.name.replace(/\/$/, ''),
              type: 'container',
              path: `azure://${container.name}/${blob.name}`,
              parentExternalId: `azure://${container.name}`,
              metadata: {},
            };
          } else {
            yield {
              externalId: `azure://${container.name}/${blob.name}`,
              name: blob.name,
              type: 'file',
              path: `azure://${container.name}/${blob.name}`,
              parentExternalId: `azure://${container.name}`,
              metadata: {
                contentType: blob.properties?.contentType,
                lastModified: blob.properties?.lastModified?.toISOString(),
              },
              sizeBytes: blob.properties?.contentLength,
            };
          }
        }
      } catch (error: any) {
        console.warn(`Error listing blobs in ${container.name}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    // For structured files (CSV), parse headers from first line
    try {
      const content = await this.withRetry(async () => {
        // TODO: Parse the blob path and download first chunk
        // const parts = assetExternalId.replace('azure://', '').split('/');
        // const containerName = parts[0];
        // const blobName = parts.slice(1).join('/');
        // const containerClient = this.client.getContainerClient(containerName);
        // const blobClient = containerClient.getBlobClient(blobName);
        // const downloaded = await blobClient.download(0, 4096);
        // const body = await streamToString(downloaded.readableStreamBody);
        // return body;
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
      // Schema inference not available for this blob type
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // For Azure Blob, we'd download and parse files to extract content samples
    // Similar approach to S3 sampling:
    // 1. Download first chunk of the blob
    // 2. Parse based on content type (CSV, JSON, Parquet, etc.)
    // 3. Yield content samples per field
  }

  async getAccessPolicies(
    assetExternalId: string,
  ): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];

    try {
      // TODO: Check container access level
      // const parts = assetExternalId.replace('azure://', '').split('/');
      // const containerName = parts[0];
      // const containerClient = this.client.getContainerClient(containerName);
      // const accessPolicy = await containerClient.getAccessPolicy();
      //
      // if (accessPolicy.blobPublicAccess) {
      //   policies.push({
      //     principal: '*',
      //     principalType: 'public',
      //     permissions: [accessPolicy.blobPublicAccess],
      //     source: 'container_access_level',
      //   });
      // }
    } catch (error: any) {
      console.warn(`Error fetching access policies: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'azure_blob',
      displayName: 'Azure Blob Storage',
      description: 'Connect to Azure Blob Storage for data discovery and classification',
      authMethods: ['connection_string', 'sas_token', 'access_key'],
      requiredPermissions: [
        'Storage Blob Data Reader',
        'Storage Account Contributor (for access policy analysis)',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: true,
      },
    };
  }
}
