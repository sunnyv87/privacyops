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
      // Existing 9
      'postgresql',
      'mysql',
      'sqlserver',
      'mongodb',
      'aws_s3',
      'azure_blob',
      'gcp_storage',
      'snowflake',
      'bigquery',
      // Wave 1 (15 new)
      'aws_rds',
      'redshift',
      'databricks',
      'salesforce',
      'servicenow',
      'google_drive',
      'onedrive',
      'sharepoint',
      'slack',
      'teams',
      'okta',
      'azure_ad',
      'github',
      'splunk',
      'generic_rest',
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

    it('should return distinct instances on each create call', () => {
      const a = registry.create('aws_s3' as any);
      const b = registry.create('aws_s3' as any);
      expect(a).not.toBe(b);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for all 24 registered connectors', () => {
      const metadata = registry.getMetadata();
      expect(metadata.length).toBe(24);
    });

    it('should include correct type for each metadata entry', () => {
      const metadata = registry.getMetadata();
      const types = metadata.map(m => m.type);
      expect(types).toContain('postgresql');
      expect(types).toContain('salesforce');
      expect(types).toContain('okta');
      expect(types).toContain('github');
      expect(types).toContain('generic_rest');
    });

    it('should have valid capabilities for every connector', () => {
      const metadata = registry.getMetadata();
      for (const m of metadata) {
        expect(m.capabilities).toBeDefined();
        expect(typeof m.capabilities.supportsDiscovery).toBe('boolean');
        expect(typeof m.capabilities.supportsContentSampling).toBe('boolean');
        expect(typeof m.capabilities.supportsAccessAnalysis).toBe('boolean');
      }
    });
  });

  describe('getAvailableTypes', () => {
    it('should list all 24 registered types', () => {
      const types = registry.getAvailableTypes();
      expect(types).toHaveLength(24);
      expect(types).toContain('postgresql');
      expect(types).toContain('mysql');
      expect(types).toContain('sqlserver');
      expect(types).toContain('mongodb');
      expect(types).toContain('bigquery');
      expect(types).toContain('snowflake');
      // Wave 1
      expect(types).toContain('aws_rds');
      expect(types).toContain('redshift');
      expect(types).toContain('databricks');
      expect(types).toContain('salesforce');
      expect(types).toContain('okta');
      expect(types).toContain('github');
      expect(types).toContain('splunk');
      expect(types).toContain('generic_rest');
    });
  });
});
