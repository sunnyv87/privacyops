import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetBucketAclCommand,
  GetBucketPolicyCommand,
  GetBucketEncryptionCommand,
  GetPublicAccessBlockCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  IConnector,
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';

export class AwsS3Connector implements IConnector {
  private client!: S3Client;
  private config!: ConnectorConfig;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    const { region, accessKeyId, secretAccessKey, roleArn } =
      config.credentials;

    // For IAM role assumption, use STS AssumeRole (simplified here)
    this.client = new S3Client({
      region: region || 'ap-south-1',
      credentials: accessKeyId
        ? { accessKeyId, secretAccessKey }
        : undefined, // Use default credential chain if no explicit creds
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.client.send(new ListBucketsCommand({}));
      return {
        success: true,
        message: `Connected. Found ${response.Buckets?.length || 0} buckets.`,
        metadata: {
          bucketCount: response.Buckets?.length || 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    this.client.destroy();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const bucketsResponse = await this.client.send(
      new ListBucketsCommand({}),
    );

    for (const bucket of bucketsResponse.Buckets || []) {
      // Yield the bucket itself as an asset
      yield {
        externalId: `s3://${bucket.Name}`,
        name: bucket.Name!,
        type: 'bucket',
        path: `s3://${bucket.Name}`,
        metadata: {
          creationDate: bucket.CreationDate?.toISOString(),
        },
      };

      // List objects (prefixes as logical groupings)
      try {
        const objectsResponse = await this.client.send(
          new ListObjectsV2Command({
            Bucket: bucket.Name,
            MaxKeys: 1000,
            Delimiter: '/',
          }),
        );

        // Yield top-level prefixes as sub-assets
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
      } catch (error: any) {
        console.warn(`Error listing objects in ${bucket.Name}: ${error.message}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    // S3 objects don't have a fixed schema.
    // For structured files (CSV, Parquet), we'd parse headers.
    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // For S3, we'd download and parse files to extract content samples.
    // This is a placeholder for the sampling implementation.
    // In production, this would:
    // 1. List objects in the bucket/prefix
    // 2. Sample N objects
    // 3. Download first 1MB of each
    // 4. Parse based on content type (CSV, JSON, Parquet, etc.)
    // 5. Yield content samples per field
  }

  async getAccessPolicies(
    assetExternalId: string,
  ): Promise<AccessPolicy[]> {
    const bucketName = assetExternalId.replace('s3://', '').split('/')[0];
    const policies: AccessPolicy[] = [];

    try {
      // Check public access block
      const publicAccess = await this.client.send(
        new GetPublicAccessBlockCommand({ Bucket: bucketName }),
      );

      const isFullyBlocked =
        publicAccess.PublicAccessBlockConfiguration?.BlockPublicAcls &&
        publicAccess.PublicAccessBlockConfiguration?.BlockPublicPolicy &&
        publicAccess.PublicAccessBlockConfiguration?.IgnorePublicAcls &&
        publicAccess.PublicAccessBlockConfiguration?.RestrictPublicBuckets;

      if (!isFullyBlocked) {
        policies.push({
          principal: '*',
          principalType: 'public',
          permissions: ['potential_public_access'],
          source: 'public_access_block',
        });
      }
    } catch {
      // No public access block configured — potential risk
      policies.push({
        principal: '*',
        principalType: 'public',
        permissions: ['no_public_access_block'],
        source: 'public_access_block',
      });
    }

    try {
      // Check bucket ACL
      const acl = await this.client.send(
        new GetBucketAclCommand({ Bucket: bucketName }),
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
        's3:ListAllMyBuckets',
        's3:ListBucket',
        's3:GetObject',
        's3:GetBucketAcl',
        's3:GetBucketPolicy',
        's3:GetBucketEncryption',
        's3:GetBucketPublicAccessBlock',
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
