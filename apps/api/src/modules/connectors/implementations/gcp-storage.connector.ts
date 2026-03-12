import { Logger } from '@nestjs/common';
import { Storage, Bucket } from '@google-cloud/storage';
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

export class GcpStorageConnector extends BaseConnector {
  private readonly logger = new Logger(GcpStorageConnector.name);
  private storage: Storage | null = null;
  private projectId: string;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { projectId, keyFilename, credentials: credentialsJson } = config.credentials;
    this.projectId = projectId;

    if (keyFilename) {
      this.storage = new Storage({ projectId, keyFilename });
    } else if (credentialsJson) {
      const credentials =
        typeof credentialsJson === 'string'
          ? JSON.parse(credentialsJson)
          : credentialsJson;
      this.storage = new Storage({ projectId, credentials });
    } else {
      // Fall back to application default credentials
      this.storage = new Storage({ projectId });
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const [buckets] = await this.withRetry(
        () => this.storage!.getBuckets(),
        'testConnection',
      );

      return {
        success: true,
        message: `Connected. Found ${buckets.length} buckets.`,
        metadata: { bucketCount: buckets.length, projectId: this.projectId },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    // GCP Storage uses an HTTP client; no persistent connection to close.
    this.storage = null;
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const [buckets] = await this.withRetry(
      () => this.storage!.getBuckets(),
      'listBuckets',
    );

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

      // List objects within the bucket
      try {
        const [files] = await this.withRetry(
          () => bucket.getFiles({ maxResults: 1000 }),
          `listObjects:${bucket.name}`,
        );

        for (const file of files) {
          yield {
            externalId: `gs://${bucket.name}/${file.name}`,
            name: file.name,
            type: 'file',
            path: `gs://${bucket.name}/${file.name}`,
            parentExternalId: bucket.name,
            metadata: {
              contentType: file.metadata?.contentType,
              timeCreated: file.metadata?.timeCreated,
              updated: file.metadata?.updated,
            },
            sizeBytes: file.metadata?.size
              ? parseInt(String(file.metadata.size), 10)
              : undefined,
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `Error listing objects in ${bucket.name}: ${error.message}`,
        );
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    try {
      const { bucketName, objectName } = this.parseGcsUri(assetExternalId);
      const file = this.storage!.bucket(bucketName).file(objectName);

      // Check content type to decide if we can infer a schema
      const [metadata] = await this.withRetry(
        () => file.getMetadata(),
        'getAssetSchema:metadata',
      );

      const contentType: string = metadata.contentType || '';
      const isCsv =
        contentType.includes('csv') ||
        contentType.includes('text/plain') ||
        objectName.endsWith('.csv') ||
        objectName.endsWith('.tsv');

      if (!isCsv) {
        return { fields: [] };
      }

      // Download first 4KB to parse header row
      const [buffer] = await this.withRetry(
        () => file.download({ start: 0, end: 4095 }),
        'getAssetSchema:download',
      );

      const content = buffer.toString('utf-8');
      const firstLine = content.split('\n')[0];
      if (!firstLine) {
        return { fields: [] };
      }

      const delimiter = objectName.endsWith('.tsv') ? '\t' : ',';
      const headers = firstLine
        .split(delimiter)
        .map((h: string) => h.trim().replace(/^"|"$/g, ''));

      return {
        fields: headers.map((name: string, idx: number) => ({
          name,
          dataType: 'string',
          ordinalPosition: idx,
          nullable: true,
          description: undefined,
        })),
      };
    } catch {
      // Schema inference not available for this object type
      return { fields: [] };
    }
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const { bucketName, objectName } = this.parseGcsUri(assetExternalId);
    const file = this.storage!.bucket(bucketName).file(objectName);

    const isCsv =
      objectName.endsWith('.csv') || objectName.endsWith('.tsv');

    if (!isCsv) {
      return;
    }

    const maxRows = options.maxRows || 100;
    // Download enough bytes to cover the requested rows (estimate ~512 bytes per row)
    const downloadBytes = Math.min(maxRows * 512, 5 * 1024 * 1024);

    const [buffer] = await this.withRetry(
      () => file.download({ start: 0, end: downloadBytes - 1 }),
      'sampleContent:download',
    );

    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return;
    }

    const delimiter = objectName.endsWith('.tsv') ? '\t' : ',';
    const headers = lines[0]
      .split(delimiter)
      .map((h: string) => h.trim().replace(/^"|"$/g, ''));

    // Parse data rows (skip header)
    const dataLines = lines.slice(1, maxRows + 1);
    const maxColumns = options.maxColumns || headers.length;

    // Collect values per column
    const columnValues: Map<string, any[]> = new Map();
    for (let colIdx = 0; colIdx < Math.min(headers.length, maxColumns); colIdx++) {
      columnValues.set(headers[colIdx], []);
    }

    for (const line of dataLines) {
      const cells = line.split(delimiter).map((c: string) =>
        c.trim().replace(/^"|"$/g, ''),
      );
      for (let colIdx = 0; colIdx < Math.min(headers.length, maxColumns); colIdx++) {
        columnValues.get(headers[colIdx])!.push(cells[colIdx] ?? null);
      }
    }

    for (const [fieldName, values] of columnValues) {
      yield {
        assetExternalId,
        fieldName,
        values,
        totalSampled: values.length,
      };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const { bucketName } = this.parseGcsUri(assetExternalId);
    const bucket: Bucket = this.storage!.bucket(bucketName);

    const [policy] = await this.withRetry(
      () => bucket.iam.getPolicy(),
      'getAccessPolicies',
    );

    const policies: AccessPolicy[] = [];

    if (policy.bindings) {
      for (const binding of policy.bindings) {
        const role = binding.role || '';
        const permissions = [role];

        for (const member of binding.members || []) {
          const { principal, principalType } = this.parseMember(member);

          policies.push({
            principal,
            principalType,
            permissions,
            source: 'iam_policy',
          });
        }
      }
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'gcp_storage',
      displayName: 'Google Cloud Storage',
      description:
        'Connect to Google Cloud Storage for data discovery and classification',
      authMethods: ['service_account', 'workload_identity'],
      requiredPermissions: [
        'storage.buckets.list',
        'storage.objects.list',
        'storage.objects.get',
        'storage.buckets.getIamPolicy',
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

  // ── Private helpers ──────────────────────────────────────────────────

  private parseGcsUri(uri: string): {
    bucketName: string;
    objectName: string;
  } {
    const stripped = uri.replace('gs://', '');
    const slashIndex = stripped.indexOf('/');
    if (slashIndex === -1) {
      return { bucketName: stripped, objectName: '' };
    }
    return {
      bucketName: stripped.substring(0, slashIndex),
      objectName: stripped.substring(slashIndex + 1),
    };
  }

  private parseMember(
    member: string,
  ): { principal: string; principalType: AccessPolicy['principalType'] } {
    if (member === 'allUsers' || member === 'allAuthenticatedUsers') {
      return { principal: member, principalType: 'public' };
    }

    const [typePrefix, identity] = member.split(':', 2);

    switch (typePrefix) {
      case 'user':
        return { principal: identity, principalType: 'user' };
      case 'group':
        return { principal: identity, principalType: 'group' };
      case 'serviceAccount':
        return { principal: identity, principalType: 'service' };
      case 'domain':
        return { principal: identity, principalType: 'group' };
      default:
        return { principal: member, principalType: 'role' };
    }
  }
}
