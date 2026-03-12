import { Logger } from '@nestjs/common';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  ContainerClient,
} from '@azure/storage-blob';

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
 * Helper to consume a Node.js ReadableStream into a string.
 */
async function streamToString(
  readable: NodeJS.ReadableStream | undefined,
): Promise<string> {
  if (!readable) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Parse a blob path like "azure://containerName/path/to/blob" into its parts.
 */
function parseBlobPath(assetExternalId: string): {
  containerName: string;
  blobName: string;
} {
  const stripped = assetExternalId.replace('azure://', '');
  const slashIndex = stripped.indexOf('/');
  if (slashIndex === -1) {
    return { containerName: stripped, blobName: '' };
  }
  return {
    containerName: stripped.substring(0, slashIndex),
    blobName: stripped.substring(slashIndex + 1),
  };
}

export class AzureBlobConnector extends BaseConnector {
  private readonly logger = new Logger(AzureBlobConnector.name);
  private client: BlobServiceClient | null = null;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { connectionString, accountName, accountKey } = config.credentials;

    if (connectionString) {
      this.client = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const url = `https://${accountName}.blob.core.windows.net`;
      this.client = new BlobServiceClient(url, credential);
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const properties = await this.withRetry(
        () => this.client!.getProperties(),
        'testConnection',
      );

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { accountKind: (properties as any).accountKind },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    // HTTP-based client — no persistent connection to tear down.
    this.client = null;
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const containers = await this.withRetry(async () => {
      const list: any[] = [];
      for await (const container of this.client!.listContainers()) {
        list.push(container);
      }
      return list;
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

      const containerClient: ContainerClient =
        this.client!.getContainerClient(container.name);

      try {
        const blobs = await this.withRetry(async () => {
          const blobList: any[] = [];
          for await (const blob of containerClient.listBlobsFlat()) {
            blobList.push(blob);
          }
          return blobList;
        }, 'listBlobs');

        for (const blob of blobs) {
          yield {
            externalId: `azure://${container.name}/${blob.name}`,
            name: blob.name,
            type: 'file',
            path: `azure://${container.name}/${blob.name}`,
            parentExternalId: container.name,
            metadata: {
              contentType: blob.properties?.contentType,
              lastModified: blob.properties?.lastModified?.toISOString(),
            },
            sizeBytes: blob.properties?.contentLength,
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `Error listing blobs in ${container.name}: ${error.message}`,
        );
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const { containerName, blobName } = parseBlobPath(assetExternalId);

    // No blob name means this is a container — no schema to infer.
    if (!blobName) {
      return { fields: [] };
    }

    const isCsv =
      blobName.toLowerCase().endsWith('.csv') ||
      blobName.toLowerCase().endsWith('.tsv');

    if (!isCsv) {
      // Unstructured blob — cannot infer schema.
      return { fields: [] };
    }

    try {
      const headerLine = await this.withRetry(async () => {
        const containerClient = this.client!.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const response = await blockBlobClient.download(0, 4096);
        const body = await streamToString(response.readableStreamBody);
        return body.split('\n')[0];
      }, 'getAssetSchema');

      if (headerLine) {
        const delimiter = assetExternalId.toLowerCase().endsWith('.tsv')
          ? '\t'
          : ',';
        const headers = headerLine
          .split(delimiter)
          .map((h: string) => h.trim().replace(/"/g, ''));

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
      // Schema inference not available for this blob.
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const { containerName, blobName } = parseBlobPath(assetExternalId);

    if (!blobName) {
      return;
    }

    const isCsv =
      blobName.toLowerCase().endsWith('.csv') ||
      blobName.toLowerCase().endsWith('.tsv');

    // Estimate bytes to download: ~256 bytes per row is a reasonable heuristic.
    const downloadBytes = Math.min(options.maxRows * 256, 1024 * 1024);

    const rawContent = await this.withRetry(async () => {
      const containerClient = this.client!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const response = await blockBlobClient.download(0, downloadBytes);
      return streamToString(response.readableStreamBody);
    }, 'sampleContent');

    if (!rawContent) {
      return;
    }

    if (isCsv) {
      const delimiter = blobName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
      const lines = rawContent.split('\n').filter((l) => l.trim().length > 0);

      if (lines.length < 2) {
        return;
      }

      const headers = lines[0]
        .split(delimiter)
        .map((h) => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1, options.maxRows + 1);

      const columnsToSample = headers.slice(0, options.maxColumns);

      for (let colIdx = 0; colIdx < columnsToSample.length; colIdx++) {
        const fieldName = columnsToSample[colIdx];
        const values = dataLines.map((line) => {
          const cells = line.split(delimiter);
          return cells[colIdx]?.trim().replace(/"/g, '') ?? null;
        });

        yield {
          assetExternalId,
          fieldName,
          values,
          totalSampled: values.length,
        };
      }
    } else {
      // For non-CSV blobs, yield the raw content as a single sample.
      yield {
        assetExternalId,
        fieldName: '_raw',
        values: [rawContent],
        totalSampled: 1,
      };
    }
  }

  async getAccessPolicies(
    assetExternalId: string,
  ): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];
    const { containerName } = parseBlobPath(assetExternalId);

    try {
      const accessPolicy = await this.withRetry(async () => {
        const containerClient =
          this.client!.getContainerClient(containerName);
        return containerClient.getAccessPolicy();
      }, 'getAccessPolicies');

      if (accessPolicy.blobPublicAccess) {
        policies.push({
          principal: '*',
          principalType: 'public',
          permissions: [accessPolicy.blobPublicAccess],
          source: 'container_access_level',
        });
      } else {
        policies.push({
          principal: 'account_owner',
          principalType: 'role',
          permissions: ['private'],
          source: 'container_access_level',
        });
      }

      if (accessPolicy.signedIdentifiers) {
        for (const identifier of accessPolicy.signedIdentifiers) {
          policies.push({
            principal: identifier.id,
            principalType: 'role',
            permissions: [identifier.accessPolicy?.permissions ?? 'unknown'],
            source: 'stored_access_policy',
          });
        }
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching access policies: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'azure_blob',
      displayName: 'Azure Blob Storage',
      description:
        'Connect to Azure Blob Storage for data discovery and classification',
      authMethods: ['connection_string', 'access_key'],
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
