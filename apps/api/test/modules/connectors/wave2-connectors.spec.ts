/**
 * Wave 2 connector unit tests.
 * Tests instantiation, metadata, and interface compliance for all Wave 2 connectors.
 * External API calls are not tested here — these verify connector structure and contracts.
 */
import { OracleConnector } from '../../../src/modules/connectors/implementations/oracle.connector';
import { CassandraConnector } from '../../../src/modules/connectors/implementations/cassandra.connector';
import { WorkdayConnector } from '../../../src/modules/connectors/implementations/workday.connector';
import { HubSpotConnector } from '../../../src/modules/connectors/implementations/hubspot.connector';
import { ZendeskConnector } from '../../../src/modules/connectors/implementations/zendesk.connector';
import { DropboxConnector } from '../../../src/modules/connectors/implementations/dropbox.connector';
import { PingIdentityConnector } from '../../../src/modules/connectors/implementations/ping-identity.connector';
import { GitLabConnector } from '../../../src/modules/connectors/implementations/gitlab.connector';
import { BitbucketConnector } from '../../../src/modules/connectors/implementations/bitbucket.connector';
import { JenkinsConnector } from '../../../src/modules/connectors/implementations/jenkins.connector';
import { MicrosoftSentinelConnector } from '../../../src/modules/connectors/implementations/microsoft-sentinel.connector';
import { ElasticSecurityConnector } from '../../../src/modules/connectors/implementations/elastic-security.connector';
import { WizConnector } from '../../../src/modules/connectors/implementations/wiz.connector';
import { PrismaCloudConnector } from '../../../src/modules/connectors/implementations/prisma-cloud.connector';
import { ConnectorMetadata, DataSourceType } from '../../../src/modules/connectors/interfaces/connector.interface';

interface ConnectorTestCase {
  name: string;
  ConnectorClass: new () => any;
  expectedType: DataSourceType;
  expectedDisplayName: string;
  expectedAuthMethods: string[];
  supportsContentSampling: boolean;
  supportsAccessAnalysis: boolean;
}

const wave2Connectors: ConnectorTestCase[] = [
  {
    name: 'OracleConnector',
    ConnectorClass: OracleConnector,
    expectedType: 'oracle',
    expectedDisplayName: 'Oracle Database',
    expectedAuthMethods: ['connection_string'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'CassandraConnector',
    ConnectorClass: CassandraConnector,
    expectedType: 'cassandra',
    expectedDisplayName: 'Apache Cassandra',
    expectedAuthMethods: ['connection_string'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'WorkdayConnector',
    ConnectorClass: WorkdayConnector,
    expectedType: 'workday',
    expectedDisplayName: 'Workday',
    expectedAuthMethods: ['oauth2', 'basic_auth'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'HubSpotConnector',
    ConnectorClass: HubSpotConnector,
    expectedType: 'hubspot',
    expectedDisplayName: 'HubSpot',
    expectedAuthMethods: ['api_key', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'ZendeskConnector',
    ConnectorClass: ZendeskConnector,
    expectedType: 'zendesk',
    expectedDisplayName: 'Zendesk',
    expectedAuthMethods: ['api_key', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'DropboxConnector',
    ConnectorClass: DropboxConnector,
    expectedType: 'dropbox',
    expectedDisplayName: 'Dropbox',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'PingIdentityConnector',
    ConnectorClass: PingIdentityConnector,
    expectedType: 'ping_identity',
    expectedDisplayName: 'Ping Identity',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: false,
  },
  {
    name: 'GitLabConnector',
    ConnectorClass: GitLabConnector,
    expectedType: 'gitlab',
    expectedDisplayName: 'GitLab',
    expectedAuthMethods: ['pat', 'oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'BitbucketConnector',
    ConnectorClass: BitbucketConnector,
    expectedType: 'bitbucket',
    expectedDisplayName: 'Bitbucket',
    expectedAuthMethods: ['basic_auth', 'oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'JenkinsConnector',
    ConnectorClass: JenkinsConnector,
    expectedType: 'jenkins',
    expectedDisplayName: 'Jenkins',
    expectedAuthMethods: ['basic_auth', 'api_key'],
    supportsContentSampling: false,
    supportsAccessAnalysis: false,
  },
  {
    name: 'MicrosoftSentinelConnector',
    ConnectorClass: MicrosoftSentinelConnector,
    expectedType: 'microsoft_sentinel',
    expectedDisplayName: 'Microsoft Sentinel',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'ElasticSecurityConnector',
    ConnectorClass: ElasticSecurityConnector,
    expectedType: 'elastic_security',
    expectedDisplayName: 'Elastic Security',
    expectedAuthMethods: ['api_key', 'basic_auth'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'WizConnector',
    ConnectorClass: WizConnector,
    expectedType: 'wiz',
    expectedDisplayName: 'Wiz',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
  {
    name: 'PrismaCloudConnector',
    ConnectorClass: PrismaCloudConnector,
    expectedType: 'prisma_cloud',
    expectedDisplayName: 'Prisma Cloud',
    expectedAuthMethods: ['api_key'],
    supportsContentSampling: true,
    supportsAccessAnalysis: false,
  },
];

describe('Wave 2 Connectors', () => {
  describe.each(wave2Connectors)(
    '$name',
    ({ ConnectorClass, expectedType, expectedDisplayName, expectedAuthMethods, supportsContentSampling, supportsAccessAnalysis }) => {
      let connector: any;
      let metadata: ConnectorMetadata;

      beforeEach(() => {
        connector = new ConnectorClass();
        metadata = connector.getMetadata();
      });

      describe('metadata', () => {
        it('should return correct type', () => {
          expect(metadata.type).toBe(expectedType);
        });

        it('should return correct display name', () => {
          expect(metadata.displayName).toBe(expectedDisplayName);
        });

        it('should have a non-empty description', () => {
          expect(metadata.description).toBeDefined();
          expect(metadata.description.length).toBeGreaterThan(10);
        });

        it('should have correct auth methods', () => {
          expect(metadata.authMethods).toEqual(expect.arrayContaining(expectedAuthMethods));
        });

        it('should have required permissions listed', () => {
          expect(metadata.requiredPermissions).toBeDefined();
          expect(metadata.requiredPermissions.length).toBeGreaterThan(0);
        });

        it('should have correct content sampling capability', () => {
          expect(metadata.capabilities.supportsContentSampling).toBe(supportsContentSampling);
        });

        it('should have correct access analysis capability', () => {
          expect(metadata.capabilities.supportsAccessAnalysis).toBe(supportsAccessAnalysis);
        });

        it('should always support discovery', () => {
          expect(metadata.capabilities.supportsDiscovery).toBe(true);
        });
      });

      describe('interface compliance', () => {
        it('should have testConnection method', () => {
          expect(typeof connector.testConnection).toBe('function');
        });

        it('should have disconnect method', () => {
          expect(typeof connector.disconnect).toBe('function');
        });

        it('should have listAssets method', () => {
          expect(typeof connector.listAssets).toBe('function');
        });

        it('should have getAssetSchema method', () => {
          expect(typeof connector.getAssetSchema).toBe('function');
        });

        it('should have sampleContent method', () => {
          expect(typeof connector.sampleContent).toBe('function');
        });

        it('should have getMetadata method', () => {
          expect(typeof connector.getMetadata).toBe('function');
        });
      });
    },
  );

  // ── Specific functional tests ──────────────────────────────

  describe('ZendeskConnector', () => {
    it('should return well-known schema for tickets', async () => {
      const connector = new ZendeskConnector();
      const schema = await connector.getAssetSchema('object:tickets');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('subject');
      expect(schema.fields.map(f => f.name)).toContain('status');
    });

    it('should return well-known schema for users', async () => {
      const connector = new ZendeskConnector();
      const schema = await connector.getAssetSchema('object:users');
      expect(schema.fields.map(f => f.name)).toContain('email');
      expect(schema.fields.map(f => f.name)).toContain('role');
    });

    it('should return empty schema for unknown types', async () => {
      const connector = new ZendeskConnector();
      const schema = await connector.getAssetSchema('object:unknown');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('WorkdayConnector', () => {
    it('should return well-known schema for workers', async () => {
      const connector = new WorkdayConnector();
      const schema = await connector.getAssetSchema('object:workers');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('primaryWorkEmail');
      expect(schema.fields.map(f => f.name)).toContain('businessTitle');
    });
  });

  describe('PingIdentityConnector', () => {
    it('should return well-known schema for users', async () => {
      const connector = new PingIdentityConnector();
      const schema = await connector.getAssetSchema('object:users');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('username');
      expect(schema.fields.map(f => f.name)).toContain('email');
    });

    it('should return well-known schema for groups', async () => {
      const connector = new PingIdentityConnector();
      const schema = await connector.getAssetSchema('object:groups');
      expect(schema.fields.map(f => f.name)).toContain('name');
    });

    it('should not support content sampling', async () => {
      const connector = new PingIdentityConnector();
      const gen = connector.sampleContent('object:users', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('GitLabConnector', () => {
    it('should not support content sampling', async () => {
      const connector = new GitLabConnector();
      const gen = connector.sampleContent('project:123', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('BitbucketConnector', () => {
    it('should not support content sampling', async () => {
      const connector = new BitbucketConnector();
      const gen = connector.sampleContent('repo:org/repo', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('JenkinsConnector', () => {
    it('should not support content sampling', async () => {
      const connector = new JenkinsConnector();
      const gen = connector.sampleContent('job:my-job', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('WizConnector', () => {
    it('should return schema for issues', async () => {
      const connector = new WizConnector();
      const schema = await connector.getAssetSchema('issues:CRITICAL');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('severity');
      expect(schema.fields.map(f => f.name)).toContain('status');
    });

    it('should return empty schema for non-issue types', async () => {
      const connector = new WizConnector();
      const schema = await connector.getAssetSchema('resource_type:VM');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('PrismaCloudConnector', () => {
    it('should return schema for alert rules', async () => {
      const connector = new PrismaCloudConnector();
      const schema = await connector.getAssetSchema('alertRule:test');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('severity');
      expect(schema.fields.map(f => f.name)).toContain('resourceName');
    });

    it('should return empty schema for accounts', async () => {
      const connector = new PrismaCloudConnector();
      const schema = await connector.getAssetSchema('account:123');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('MicrosoftSentinelConnector', () => {
    it('should return empty schema for non-table assets', async () => {
      const connector = new MicrosoftSentinelConnector();
      const schema = await connector.getAssetSchema('alertRule:test');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('ElasticSecurityConnector', () => {
    it('should return empty schema for non-index assets', async () => {
      const connector = new ElasticSecurityConnector();
      const schema = await connector.getAssetSchema('rule:test');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('DropboxConnector', () => {
    it('should return empty schema for non-CSV files', async () => {
      const connector = new DropboxConnector();
      const schema = await connector.getAssetSchema('dropbox:/docs/readme.pdf');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('HubSpotConnector', () => {
    it('should return empty metadata type', () => {
      const connector = new HubSpotConnector();
      const metadata = connector.getMetadata();
      expect(metadata.type).toBe('hubspot');
      expect(metadata.capabilities.supportsDiscovery).toBe(true);
    });
  });
});
