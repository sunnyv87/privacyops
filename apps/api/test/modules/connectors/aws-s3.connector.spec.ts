import { AwsS3Connector } from '../../../src/modules/connectors/implementations/aws-s3.connector';
import {
  ContentSample,
  DiscoveredAsset,
  SampleOptions,
} from '../../../src/modules/connectors/interfaces/connector.interface';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: jest.fn(),
    })),
    ListBucketsCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'ListBuckets' })),
    ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ input, _type: 'ListObjectsV2' })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'GetObject' })),
    GetBucketAclCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'GetBucketAcl' })),
    GetPublicAccessBlockCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'GetPublicAccessBlock' })),
  };
});

function createReadableStream(content: string): AsyncIterable<Buffer> {
  return {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(content);
    },
  };
}

describe('AwsS3Connector', () => {
  let connector: AwsS3Connector;
  const defaultSampleOptions: SampleOptions = {
    maxRows: 10,
    maxColumns: 10,
    sampleStrategy: 'first_n',
    excludePatterns: [],
  };

  beforeEach(async () => {
    mockSend.mockReset();
    connector = new AwsS3Connector();
    await connector.initialize({
      type: 'aws_s3',
      credentials: { region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'test' },
      options: { retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 } },
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const meta = connector.getMetadata();
      expect(meta.type).toBe('aws_s3');
      expect(meta.displayName).toBe('Amazon S3');
      expect(meta.capabilities.supportsDiscovery).toBe(true);
      expect(meta.capabilities.supportsContentSampling).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should return success when listing buckets succeeds', async () => {
      mockSend.mockResolvedValueOnce({ Buckets: [{ Name: 'test-bucket' }] });
      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.metadata?.bucketCount).toBe(1);
    });

    it('should return failure on error', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access Denied'));
      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied');
    });
  });

  describe('listAssets', () => {
    it('should yield buckets and file assets', async () => {
      mockSend
        .mockResolvedValueOnce({
          Buckets: [{ Name: 'data-bucket', CreationDate: new Date('2024-01-01') }],
        })
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'logs/' }],
          Contents: [
            { Key: 'data.csv', Size: 1024, LastModified: new Date() },
            { Key: 'image.png', Size: 2048 }, // Not a supported extension
          ],
        });

      const assets: DiscoveredAsset[] = [];
      for await (const asset of connector.listAssets()) {
        assets.push(asset);
      }

      expect(assets).toHaveLength(3); // bucket + prefix + csv file
      expect(assets[0].type).toBe('bucket');
      expect(assets[0].name).toBe('data-bucket');
      expect(assets[1].type).toBe('container');
      expect(assets[1].name).toBe('logs');
      expect(assets[2].type).toBe('file');
      expect(assets[2].name).toBe('data.csv');
    });
  });

  describe('getAssetSchema', () => {
    it('should parse CSV headers from S3 object', async () => {
      mockSend.mockResolvedValueOnce({
        Body: createReadableStream('name,email,age\nAlice,alice@example.com,30'),
      });

      const schema = await connector.getAssetSchema('s3://bucket/data.csv');
      expect(schema.fields).toHaveLength(3);
      expect(schema.fields[0].name).toBe('name');
      expect(schema.fields[1].name).toBe('email');
      expect(schema.fields[2].name).toBe('age');
    });

    it('should parse JSON keys from S3 object', async () => {
      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(JSON.stringify([
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ])),
      });

      const schema = await connector.getAssetSchema('s3://bucket/data.json');
      expect(schema.fields).toHaveLength(3);
      expect(schema.fields.map(f => f.name)).toEqual(['id', 'name', 'email']);
    });

    it('should return empty schema for buckets', async () => {
      const schema = await connector.getAssetSchema('s3://bucket');
      expect(schema.fields).toHaveLength(0);
    });

    it('should return empty schema for unsupported file types', async () => {
      const schema = await connector.getAssetSchema('s3://bucket/image.png');
      expect(schema.fields).toHaveLength(0);
    });
  });

  describe('sampleContent', () => {
    it('should sample CSV content per column', async () => {
      const csvContent = 'name,email,age\nAlice,alice@example.com,30\nBob,bob@test.com,25\n';

      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(csvContent),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('s3://bucket/data.csv', defaultSampleOptions)) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(3); // name, email, age
      expect(samples[0].fieldName).toBe('name');
      expect(samples[0].values).toEqual(['Alice', 'Bob']);
      expect(samples[1].fieldName).toBe('email');
      expect(samples[1].values).toEqual(['alice@example.com', 'bob@test.com']);
      expect(samples[2].fieldName).toBe('age');
      expect(samples[2].values).toEqual(['30', '25']);
    });

    it('should sample JSON content per field', async () => {
      const jsonContent = JSON.stringify([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);

      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(jsonContent),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('s3://bucket/data.json', defaultSampleOptions)) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(2); // id, name
      expect(samples[0].fieldName).toBe('id');
      expect(samples[0].values).toEqual([1, 2]);
      expect(samples[1].fieldName).toBe('name');
      expect(samples[1].values).toEqual(['Alice', 'Bob']);
    });

    it('should sample JSONL content per field', async () => {
      const jsonlContent = '{"user":"alice","action":"login"}\n{"user":"bob","action":"logout"}\n';

      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(jsonlContent),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('s3://bucket/data.jsonl', defaultSampleOptions)) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(2);
      expect(samples[0].fieldName).toBe('user');
      expect(samples[0].values).toEqual(['alice', 'bob']);
    });

    it('should sample from prefix by listing files', async () => {
      // ListObjectsV2 response for the prefix
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'prefix/data.csv', Size: 500 },
        ],
      });

      // GetObject for the CSV file
      mockSend.mockResolvedValueOnce({
        Body: createReadableStream('col1,col2\nval1,val2\n'),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('s3://bucket/prefix/', defaultSampleOptions)) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(2);
      expect(samples[0].fieldName).toBe('col1');
    });

    it('should respect excludePatterns', async () => {
      const csvContent = 'name,password,email\nAlice,secret,alice@test.com\n';

      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(csvContent),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent(
        's3://bucket/data.csv',
        { ...defaultSampleOptions, excludePatterns: ['password'] },
      )) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(2); // name, email — password excluded
      expect(samples.map(s => s.fieldName)).toEqual(['name', 'email']);
    });

    it('should handle empty files gracefully', async () => {
      mockSend.mockResolvedValueOnce({
        Body: createReadableStream(''),
      });

      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('s3://bucket/empty.csv', defaultSampleOptions)) {
        samples.push(sample);
      }

      expect(samples).toHaveLength(0);
    });
  });

  describe('getAccessPolicies', () => {
    it('should detect public access', async () => {
      mockSend
        .mockResolvedValueOnce({
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: false,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true,
          },
        })
        .mockResolvedValueOnce({ Grants: [] });

      const policies = await connector.getAccessPolicies!('s3://test-bucket');
      expect(policies.some(p => p.principalType === 'public')).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should destroy the S3 client', async () => {
      await connector.disconnect();
      // No error means success
    });
  });
});
