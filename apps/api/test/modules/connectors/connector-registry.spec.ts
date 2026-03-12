import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorRegistry } from '../../../src/modules/connectors/connector-registry';

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectorRegistry],
    }).compile();

    registry = module.get<ConnectorRegistry>(ConnectorRegistry);
  });

  describe('supported connector types', () => {
    const expectedTypes = [
      'postgresql',
      'mysql',
      'sqlserver',
      'mongodb',
      'aws_s3',
      'azure_blob',
      'gcp_storage',
      'snowflake',
      'bigquery',
    ];

    it.each(expectedTypes)('should support %s connector', (type) => {
      expect(() => registry.create(type as any)).not.toThrow();
    });

    it('should throw for unsupported connector type', () => {
      expect(() => registry.create('unsupported' as any)).toThrow();
    });
  });

  describe('create', () => {
    it('should return a connector with the IConnector interface', () => {
      const connector = registry.create('postgresql' as any);

      expect(connector).toBeDefined();
      expect(typeof connector.initialize).toBe('function');
      expect(typeof connector.testConnection).toBe('function');
      expect(typeof connector.listAssets).toBe('function');
      expect(typeof connector.disconnect).toBe('function');
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for all registered connectors', () => {
      const metadata = registry.getMetadata();

      expect(metadata.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('getAvailableTypes', () => {
    it('should list all 9 registered types', () => {
      const types = registry.getAvailableTypes();

      expect(types).toHaveLength(9);
      expect(types).toContain('postgresql');
      expect(types).toContain('mysql');
      expect(types).toContain('sqlserver');
      expect(types).toContain('mongodb');
      expect(types).toContain('bigquery');
      expect(types).toContain('snowflake');
    });
  });
});
