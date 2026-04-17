import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class SignedUrlService implements OnModuleInit {
  private readonly logger = new Logger(SignedUrlService.name);
  private s3Client: any = null;
  private defaultBucket: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { S3Client } = await import('@aws-sdk/client-s3');

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'ap-south-1');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY', '');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY', '');
    this.defaultBucket = this.config.get<string>(
      'S3_BUCKET',
      'privacyops-data',
    );

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // Required for MinIO / S3-compatible stores
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `S3 client initialized (endpoint: ${endpoint || 'AWS default'}, bucket: ${this.defaultBucket})`,
    );
  }

  /**
   * Generate a pre-signed URL for uploading an object.
   * Default expiry: 15 minutes (900 seconds).
   */
  async generateUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn = 900,
  ): Promise<string> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a pre-signed URL for downloading an object.
   * Default expiry: 1 hour (3600 seconds).
   */
  async generateDownloadUrl(
    bucket: string,
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a pre-signed upload URL scoped to a tenant's evidence folder.
   * Key format: tenants/{tenantId}/evidence/{uuid}/{filename}
   *
   * Returns both the signed URL and the S3 object key for storage reference.
   */
  async generateEvidenceUploadUrl(
    tenantId: string,
    filename: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const objectKey = `tenants/${tenantId}/evidence/${randomUUID()}/${filename}`;
    const url = await this.generateUploadUrl(
      this.defaultBucket,
      objectKey,
      contentType,
    );
    return { url, key: objectKey };
  }

  /**
   * Generate a pre-signed download URL for a DSAR response package.
   * Key format: tenants/{tenantId}/dsar/{requestId}/package.zip
   */
  async generateDsarPackageUrl(
    tenantId: string,
    requestId: string,
  ): Promise<string> {
    const objectKey = `tenants/${tenantId}/dsar/${requestId}/package.zip`;
    // DSAR packages contain personal data — use a short-lived URL (5 minutes)
    return this.generateDownloadUrl(this.defaultBucket, objectKey, 300);
  }
}
