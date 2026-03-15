import { BaseRestApiConnector } from '../../../src/modules/connectors/sdk/base-rest-api-connector';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  ConnectorMetadata,
} from '../../../src/modules/connectors/interfaces/connector.interface';

// Concrete test implementation
class TestRestConnector extends BaseRestApiConnector {
  public setupAuthCalled = false;
  public setupClientCalled = false;

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    this.setupAuthCalled = true;
    const { token } = config.credentials;
    if (token) this.setupBearerAuth(token);
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    this.setupClientCalled = true;
    this.baseUrl = config.credentials.baseUrl || 'https://api.example.com';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { success: true, message: 'OK' };
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    yield { externalId: 'test-1', name: 'test', type: 'api_endpoint', path: '/test', metadata: {} };
  }

  async getAssetSchema(): Promise<AssetSchema> {
    return { fields: [] };
  }

  async *sampleContent(): AsyncGenerator<ContentSample> {}

  getMetadata(): ConnectorMetadata {
    return {
      type: 'generic_rest',
      displayName: 'Test REST',
      description: 'Test',
      authMethods: ['bearer'],
      requiredPermissions: [],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: false,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }

  // Expose protected methods for testing
  public testRequest<T>(method: string, path: string, options?: any): Promise<T> {
    return this.request(method, path, options);
  }

  public getAuthHeaders(): Record<string, string> {
    return this.authHeaders;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}

describe('BaseRestApiConnector', () => {
  let connector: TestRestConnector;

  beforeEach(async () => {
    connector = new TestRestConnector();
  });

  describe('initialize', () => {
    it('should call setupAuth and setupClient', async () => {
      await connector.initialize({
        type: 'generic_rest',
        credentials: { token: 'test-token', baseUrl: 'https://api.test.com' },
        options: {},
      });

      expect(connector.setupAuthCalled).toBe(true);
      expect(connector.setupClientCalled).toBe(true);
    });
  });

  describe('auth helpers', () => {
    it('should setup bearer auth correctly', async () => {
      await connector.initialize({
        type: 'generic_rest',
        credentials: { token: 'my-token', baseUrl: 'https://api.test.com' },
        options: {},
      });

      expect(connector.getAuthHeaders()).toEqual({
        Authorization: 'Bearer my-token',
      });
    });

    it('should set base URL from config', async () => {
      await connector.initialize({
        type: 'generic_rest',
        credentials: { baseUrl: 'https://custom.api.com' },
        options: {},
      });

      expect(connector.getBaseUrl()).toBe('https://custom.api.com');
    });
  });

  describe('listAssets', () => {
    it('should yield discovered assets', async () => {
      const assets: DiscoveredAsset[] = [];
      for await (const asset of connector.listAssets()) {
        assets.push(asset);
      }
      expect(assets).toHaveLength(1);
      expect(assets[0].externalId).toBe('test-1');
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const meta = connector.getMetadata();
      expect(meta.type).toBe('generic_rest');
      expect(meta.capabilities.supportsDiscovery).toBe(true);
    });
  });
});
