import { Logger } from '@nestjs/common';
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetBucketAclCommand,
  GetPublicAccessBlockCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
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

const MAX_SAMPLE_BYTES = 1024 * 1024; // 1 MB
const MAX_SCHEMA_BYTES = 4096; // 4 KB for header detection
const MAX_FILE_SIZE = 50 * 1024 * 1024; // Skip files > 50 MB
const SUPPORTED_EXTENSIONS = ['.csv', '.tsv', '.json', '.jsonl', '.txt'];

async function streamToBuffer(
  stream: NodeJS.ReadableStream | ReadableStream | undefined,
): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isSupportedFile(key: string): boolean {
  const lower = key.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function detectDelimiter(filename: string): string {
  return filename.toLowerCase().endsWith('.tsv') ? '\t' : ',';
}

function parseJsonKeys(content: string): { keys: string[]; records: Record<string, any>[] } {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const records = parsed.slice(0, 100);
      const keySet = new Set<string>();
      for (const item of records) {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(k => keySet.add(k));
        }
      }
      return { keys: Array.from(keySet), records };
    }
    if (parsed && typeof parsed === 'object') {
      return { keys: Object.keys(parsed), records: [parsed] };
    }
  } catch {
    // Try JSONL
    const lines = content.split('\n').filter(l => l.trim());
    const records: Record<string, any>[] = [];
    const keySet = new Set<string>();
    for (const line of lines.slice(0, 100)) {
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(k => keySet.add(k));
          records.push(obj);
        }
      } catch {
        break;
      }
    }
    if (records.length > 0) {
      return { keys: Array.from(keySet), records };
    }
  }
  return { keys: [], records: [] };
}

function inferJsonType(values: any[]): string {
  for (const v of values) {
    if (v == null) continue;
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'float';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'object') return Array.isArray(v) ? 'array' : 'object';
    return 'string';
  }
  return 'string';
}

export class AwsS3Connector extends BaseConnector {
  private readonly logger = new Logger(AwsS3Connector.name);
  private client!: S3Client;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const { region, accessKeyId, secretAccessKey } = config.credentials;

    this.client = new S3Client({
      region: region || 'ap-south-1',
      credentials: accessKeyId
        ? { accessKeyId, secretAccessKey }
        : undefined,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.withRetry(
        () => this.client.send(new ListBucketsCommand({})),
        'testConnection',
      );
      return {
        success: true,
        message: `Connected. Found ${response.Buckets?.length || 0} buckets.`,
        metadata: { bucketCount: response.Buckets?.length || 0 },
      };
    } catch (error: any) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    this.client.destroy();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const bucketsResponse = await this.withRetry(
      () => this.client.send(new ListBucketsCommand({})),
      'listBuckets',
    );

    for (const bucket of bucketsResponse.Buckets || []) {
      yield {
        externalId: `s3://${bucket.Name}`,
        name: bucket.Name!,
        type: 'bucket',
        path: `s3://${bucket.Name}`,
        metadata: { creationDate: bucket.CreationDate?.toISOString() },
      };

      try {
        const objectsResponse = await this.withRetry(
          () => this.client.send(new ListObjectsV2Command({
            Bucket: bucket.Name,
            MaxKeys: 1000,
            Delimiter: '/',
          })),
          'listObjects',
        );

        for (const prefix of objectsResponse.CommonPrefixes || []) {
          yield {
            externalId: `s3://${bucket.Name}/${prefix.Prefix}`,
            name: prefix.Prefix!.replace(/\/$/, ''),
            type: 'container',
            path: `s3://${bucket.Name}/${prefix.Prefix}`,
            parentExternalId: `s3://${bucket.Name}`,
            metadata: {},
          };
        }

        for (const obj of objectsResponse.Contents || []) {
          if (obj.Key && isSupportedFile(obj.Key)) {
            yield {
              externalId: `s3://${bucket.Name}/${obj.Key}`,
              name: obj.Key.split('/').pop() || obj.Key,
              type: 'file',
              path: `s3://${bucket.Name}/${obj.Key}`,
              parentExternalId: `s3://${bucket.Name}`,
              metadata: { lastModified: obj.LastModified?.toISOString() },
              sizeBytes: obj.Size,
            };
          }
        }
      } catch (error: any) {
        this.logger.warn(`Error listing objects in ${bucket.Name}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const { bucket, key } = this.parseS3Path(assetExternalId);

    // No schema for buckets or prefixes
    if (!key || key.endsWith('/')) {
      return { fields: [] };
    }

    if (!isSupportedFile(key)) {
      return { fields: [] };
    }

    try {
      const content = await this.downloadRange(bucket, key, MAX_SCHEMA_BYTES);
      if (!content) return { fields: [] };

      const lower = key.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
        return this.parseCsvSchema(content, key);
      }
      if (lower.endsWith('.json') || lower.endsWith('.jsonl')) {
        return this.parseJsonSchema(content);
      }
    } catch (error: any) {
      this.logger.warn(`Schema inference failed for ${assetExternalId}: ${error.message}`);
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const { bucket, key } = this.parseS3Path(assetExternalId);

    // If this is a bucket or prefix, list files and sample from them
    if (!key || key.endsWith('/')) {
      yield* this.sampleFromPrefix(bucket, key || '', options);
      return;
    }

    // Single file sampling
    if (!isSupportedFile(key)) return;

    yield* this.sampleFromFile(bucket, key, assetExternalId, options);
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const { bucket } = this.parseS3Path(assetExternalId);
    const policies: AccessPolicy[] = [];

    try {
      const publicAccess = await this.withRetry(
        () => this.client.send(new GetPublicAccessBlockCommand({ Bucket: bucket })),
        'getPublicAccessBlock',
      );
      const config = publicAccess.PublicAccessBlockConfiguration;
      const isFullyBlocked =
        config?.BlockPublicAcls && config?.BlockPublicPolicy &&
        config?.IgnorePublicAcls && config?.RestrictPublicBuckets;

      if (!isFullyBlocked) {
        policies.push({
          principal: '*',
          principalType: 'public',
          permissions: ['potential_public_access'],
          source: 'public_access_block',
        });
      }
    } catch {
      policies.push({
        principal: '*',
        principalType: 'public',
        permissions: ['no_public_access_block'],
        source: 'public_access_block',
      });
    }

    try {
      const acl = await this.withRetry(
        () => this.client.send(new GetBucketAclCommand({ Bucket: bucket })),
        'getBucketAcl',
      );
      for (const grant of acl.Grants || []) {
        const uri = grant.Grantee?.URI || '';
        if (uri.includes('AllUsers') || uri.includes('AuthenticatedUsers')) {
          policies.push({
            principal: uri,
            principalType: 'public',
            permissions: [grant.Permission || 'unknown'],
            source: 'acl',
          });
        }
      }
    } catch {
      // ACL check failed
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'aws_s3',
      displayName: 'Amazon S3',
      description: 'Connect to AWS S3 buckets for data discovery and classification',
      authMethods: ['iam_role', 'access_key'],
      requiredPermissions: [
        's3:ListAllMyBuckets', 's3:ListBucket', 's3:GetObject',
        's3:GetBucketAcl', 's3:GetBucketPolicy',
        's3:GetBucketEncryption', 's3:GetBucketPublicAccessBlock',
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

  // ── Private helpers ──────────────────────────────────────────

  private parseS3Path(externalId: string): { bucket: string; key: string } {
    const stripped = externalId.replace('s3://', '');
    const slashIndex = stripped.indexOf('/');
    if (slashIndex === -1) return { bucket: stripped, key: '' };
    return { bucket: stripped.substring(0, slashIndex), key: stripped.substring(slashIndex + 1) };
  }

  private async downloadRange(bucket: string, key: string, bytes: number): Promise<string> {
    const response = await this.withRetry(
      () => this.client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      })),
      'downloadRange',
    );
    const buf = await streamToBuffer(response.Body as any);
    return buf.toString('utf-8');
  }

  private parseCsvSchema(content: string, filename: string): AssetSchema {
    const delimiter = detectDelimiter(filename);
    const firstLine = content.split('\n')[0];
    if (!firstLine) return { fields: [] };

    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    return {
      fields: headers.map((name, idx) => ({
        name,
        dataType: 'string',
        ordinalPosition: idx,
        nullable: true,
      })),
    };
  }

  private parseJsonSchema(content: string): AssetSchema {
    const { keys } = parseJsonKeys(content);
    return {
      fields: keys.map((name, idx) => ({
        name,
        dataType: 'string',
        ordinalPosition: idx,
        nullable: true,
      })),
    };
  }

  private async *sampleFromPrefix(
    bucket: string,
    prefix: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const listResp = await this.withRetry(
      () => this.client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 50,
      })),
      'listObjectsForSampling',
    );

    const sampledFiles = (listResp.Contents || [])
      .filter(obj => obj.Key && isSupportedFile(obj.Key) && (obj.Size || 0) <= MAX_FILE_SIZE)
      .slice(0, 10);

    for (const obj of sampledFiles) {
      const externalId = `s3://${bucket}/${obj.Key}`;
      yield* this.sampleFromFile(bucket, obj.Key!, externalId, options);
    }
  }

  private async *sampleFromFile(
    bucket: string,
    key: string,
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    try {
      const downloadBytes = Math.min(options.maxRows * 256, MAX_SAMPLE_BYTES);
      const content = await this.downloadRange(bucket, key, downloadBytes);
      if (!content) return;

      const lower = key.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
        yield* this.sampleCsv(content, key, assetExternalId, options);
      } else if (lower.endsWith('.json') || lower.endsWith('.jsonl')) {
        yield* this.sampleJson(content, assetExternalId, options);
      } else {
        // Plain text — yield as single field
        yield {
          assetExternalId,
          fieldName: '_raw',
          values: [content.slice(0, 1000)],
          totalSampled: 1,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Sampling failed for s3://${bucket}/${key}: ${error.message}`);
    }
  }

  private *sampleCsv(
    content: string,
    filename: string,
    assetExternalId: string,
    options: SampleOptions,
  ): Generator<ContentSample> {
    const delimiter = detectDelimiter(filename);
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1, options.maxRows + 1);
    const columnsToSample = headers
      .slice(0, options.maxColumns)
      .filter(h => !options.excludePatterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

    for (const fieldName of columnsToSample) {
      const colIdx = headers.indexOf(fieldName);
      const values = dataLines
        .map(line => {
          const cells = line.split(delimiter);
          return cells[colIdx]?.trim().replace(/"/g, '') ?? null;
        })
        .filter(v => v !== null && v !== '');

      yield { assetExternalId, fieldName, values, totalSampled: values.length };
    }
  }

  private *sampleJson(
    content: string,
    assetExternalId: string,
    options: SampleOptions,
  ): Generator<ContentSample> {
    const { keys, records } = parseJsonKeys(content);
    if (keys.length === 0) return;

    const columnsToSample = keys
      .slice(0, options.maxColumns)
      .filter(k => !options.excludePatterns.some(p => k.toLowerCase().includes(p.toLowerCase())));

    const sampledRecords = records.slice(0, options.maxRows);

    for (const fieldName of columnsToSample) {
      const values = sampledRecords
        .map(r => r[fieldName])
        .filter(v => v !== null && v !== undefined);

      yield { assetExternalId, fieldName, values, totalSampled: values.length };
    }
  }
}
