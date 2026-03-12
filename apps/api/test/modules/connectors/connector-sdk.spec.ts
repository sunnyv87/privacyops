import { BaseConnector } from '../../../src/modules/connectors/sdk/base-connector';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../../../src/modules/connectors/interfaces/connector.interface';

// Concrete test implementation of BaseConnector
class TestConnector extends BaseConnector {
  public initCalled = false;
  public shouldFail = false;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.initCalled = true;
    if (this.shouldFail) throw new Error('Init failed');
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { success: true, message: 'OK' };
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    yield { externalId: 'ext-1', name: 'test', type: 'table', path: '/test', metadata: {} };
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    return { fields: [{ name: 'id', dataType: 'int', ordinalPosition: 0, nullable: false }] };
  }

  async *sampleContent(assetExternalId: string, options: SampleOptions): AsyncGenerator<ContentSample> {
    yield { assetExternalId, fieldName: 'id', values: [1, 2, 3], totalSampled: 3 };
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'postgresql',
      displayName: 'Test',
      description: 'Test connector',
      authMethods: ['password'],
      requiredPermissions: ['SELECT'],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }

  // Expose protected methods for testing
  public testWithRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    return this.withRetry(operation, context);
  }

  public testNormalizeSchema(raw: any[]): any[] {
    return this.normalizeSchema(raw);
  }
}

describe('BaseConnector (SDK)', () => {
  let connector: TestConnector;

  beforeEach(() => {
    connector = new TestConnector();
  });

  describe('initialize', () => {
    it('should call doInitialize with config', async () => {
      const config: ConnectorConfig = {
        type: 'postgresql',
        credentials: { host: 'localhost' },
        options: {},
      };

      await connector.initialize(config);

      expect(connector.initCalled).toBe(true);
    });

    it('should allow custom retry config', async () => {
      await connector.initialize({
        type: 'postgresql',
        credentials: {},
        options: { retryConfig: { maxRetries: 5, backoffMs: 500, backoffMultiplier: 3 } },
      });

      expect(connector.initCalled).toBe(true);
    });

    it('should allow custom rate limit config', async () => {
      await connector.initialize({
        type: 'postgresql',
        credentials: {},
        options: { rateLimitConfig: { maxRequestsPerSecond: 5, burstLimit: 10 } },
      });

      expect(connector.initCalled).toBe(true);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      await connector.initialize({ type: 'postgresql', credentials: {}, options: {} });

      const result = await connector.testWithRetry(
        async () => 'success',
        'test-op',
      );

      expect(result).toBe('success');
    });

    it('should retry on failure and eventually succeed', async () => {
      await connector.initialize({
        type: 'postgresql',
        credentials: {},
        options: { retryConfig: { maxRetries: 3, backoffMs: 10, backoffMultiplier: 1 } },
      });

      let attempts = 0;
      const result = await connector.testWithRetry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('transient');
          return 'recovered';
        },
        'test-op',
      );

      expect(result).toBe('recovered');
      expect(attempts).toBe(3);
    });

    it('should throw after all retries exhausted', async () => {
      await connector.initialize({
        type: 'postgresql',
        credentials: {},
        options: { retryConfig: { maxRetries: 2, backoffMs: 10, backoffMultiplier: 1 } },
      });

      await expect(
        connector.testWithRetry(
          async () => { throw new Error('permanent failure'); },
          'test-op',
        ),
      ).rejects.toThrow('test-op failed after 3 attempts: permanent failure');
    });
  });

  describe('normalizeSchema', () => {
    it('should normalize standard column formats', async () => {
      await connector.initialize({ type: 'postgresql', credentials: {}, options: {} });

      const result = connector.testNormalizeSchema([
        { name: 'id', dataType: 'integer', ordinalPosition: 0, nullable: false },
        { name: 'email', dataType: 'varchar', ordinalPosition: 1, nullable: true },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('id');
      expect(result[0].dataType).toBe('integer');
      expect(result[0].nullable).toBe(false);
    });

    it('should normalize snake_case column formats (Postgres style)', async () => {
      await connector.initialize({ type: 'postgresql', credentials: {}, options: {} });

      const result = connector.testNormalizeSchema([
        { column_name: 'id', data_type: 'int4', ordinal_position: 1, is_nullable: 'NO' },
        { column_name: 'name', data_type: 'varchar', ordinal_position: 2, is_nullable: 'YES' },
      ]);

      expect(result[0].name).toBe('id');
      expect(result[0].dataType).toBe('int4');
      expect(result[0].nullable).toBe(false);
      expect(result[1].nullable).toBe(true);
    });

    it('should normalize UPPER_CASE column formats (MSSQL style)', async () => {
      await connector.initialize({ type: 'postgresql', credentials: {}, options: {} });

      const result = connector.testNormalizeSchema([
        { COLUMN_NAME: 'Id', DATA_TYPE: 'int' },
      ]);

      expect(result[0].name).toBe('Id');
      expect(result[0].dataType).toBe('int');
    });

    it('should handle missing fields gracefully', async () => {
      await connector.initialize({ type: 'postgresql', credentials: {}, options: {} });

      const result = connector.testNormalizeSchema([{}]);

      expect(result[0].name).toBe('');
      expect(result[0].dataType).toBe('unknown');
      expect(result[0].nullable).toBe(true);
    });
  });

  describe('listAssets', () => {
    it('should yield discovered assets', async () => {
      const assets: DiscoveredAsset[] = [];
      for await (const asset of connector.listAssets()) {
        assets.push(asset);
      }
      expect(assets).toHaveLength(1);
      expect(assets[0].externalId).toBe('ext-1');
    });
  });

  describe('sampleContent', () => {
    it('should yield content samples', async () => {
      const samples: ContentSample[] = [];
      for await (const sample of connector.sampleContent('ext-1', {
        maxRows: 10,
        maxColumns: 10,
        sampleStrategy: 'first_n',
        excludePatterns: [],
      })) {
        samples.push(sample);
      }
      expect(samples).toHaveLength(1);
      expect(samples[0].values).toEqual([1, 2, 3]);
    });
  });
});
