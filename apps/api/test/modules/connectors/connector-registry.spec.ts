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
      // Wave 2 (14 new)
      'oracle',
      'cassandra',
      'workday',
      'hubspot',
      'zendesk',
      'dropbox',
      'ping_identity',
      'gitlab',
      'bitbucket',
      'jenkins',
      'microsoft_sentinel',
      'elastic_security',
      'wiz',
      'prisma_cloud',
      // Wave 3 (5 new)
      'sap_hana',
      'jira',
      'confluence',
      'cyberark',
      'sailpoint',
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
    it('should return metadata for all 43 registered connectors', () => {
      const metadata = registry.getMetadata();
      expect(metadata.length).toBe(43);
    });

    it('should include correct type for each metadata entry', () => {
      const metadata = registry.getMetadata();
      const types = metadata.map(m => m.type);
      expect(types).toContain('postgresql');
      expect(types).toContain('salesforce');
      expect(types).toContain('okta');
      expect(types).toContain('github');
      expect(types).toContain('generic_rest');
      // Wave 2
      expect(types).toContain('oracle');
      expect(types).toContain('cassandra');
      expect(types).toContain('wiz');
      expect(types).toContain('prisma_cloud');
      // Wave 3
      expect(types).toContain('sap_hana');
      expect(types).toContain('jira');
      expect(types).toContain('confluence');
      expect(types).toContain('cyberark');
      expect(types).toContain('sailpoint');
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
    it('should list all 43 registered types', () => {
      const types = registry.getAvailableTypes();
      expect(types).toHaveLength(43);
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
      // Wave 2
      expect(types).toContain('oracle');
      expect(types).toContain('cassandra');
      expect(types).toContain('workday');
      expect(types).toContain('hubspot');
      expect(types).toContain('zendesk');
      expect(types).toContain('dropbox');
      expect(types).toContain('ping_identity');
      expect(types).toContain('gitlab');
      expect(types).toContain('bitbucket');
      expect(types).toContain('jenkins');
      expect(types).toContain('microsoft_sentinel');
      expect(types).toContain('elastic_security');
      expect(types).toContain('wiz');
      expect(types).toContain('prisma_cloud');
      // Wave 3
      expect(types).toContain('sap_hana');
      expect(types).toContain('jira');
      expect(types).toContain('confluence');
      expect(types).toContain('cyberark');
      expect(types).toContain('sailpoint');
    });
  });
});
