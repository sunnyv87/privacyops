/**
 * Wave 3 connector unit tests.
 * Tests instantiation, metadata, and interface compliance for all Wave 3 connectors.
 * External API calls are not tested here — these verify connector structure and contracts.
 */
import { SapHanaConnector } from '../../../src/modules/connectors/implementations/sap-hana.connector';
import { JiraConnector } from '../../../src/modules/connectors/implementations/jira.connector';
import { ConfluenceConnector } from '../../../src/modules/connectors/implementations/confluence.connector';
import { CyberArkConnector } from '../../../src/modules/connectors/implementations/cyberark.connector';
import { SailPointConnector } from '../../../src/modules/connectors/implementations/sailpoint.connector';
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

const wave3Connectors: ConnectorTestCase[] = [
  {
    name: 'SapHanaConnector',
    ConnectorClass: SapHanaConnector,
    expectedType: 'sap_hana',
    expectedDisplayName: 'SAP HANA',
    expectedAuthMethods: ['connection_string'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'JiraConnector',
    ConnectorClass: JiraConnector,
    expectedType: 'jira',
    expectedDisplayName: 'Jira',
    expectedAuthMethods: ['api_key', 'pat', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'ConfluenceConnector',
    ConnectorClass: ConfluenceConnector,
    expectedType: 'confluence',
    expectedDisplayName: 'Confluence',
    expectedAuthMethods: ['api_key', 'pat', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'CyberArkConnector',
    ConnectorClass: CyberArkConnector,
    expectedType: 'cyberark',
    expectedDisplayName: 'CyberArk',
    expectedAuthMethods: ['basic_auth', 'api_key'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'SailPointConnector',
    ConnectorClass: SailPointConnector,
    expectedType: 'sailpoint',
    expectedDisplayName: 'SailPoint',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
];

describe('Wave 3 Connectors', () => {
  describe.each(wave3Connectors)(
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

  describe('SapHanaConnector', () => {
    it('should return schema for valid table reference', async () => {
      const connector = new SapHanaConnector();
      // Without a connection, getAssetSchema will fail gracefully
      const schema = await connector.getAssetSchema('invalid');
      expect(schema.fields).toEqual([]);
    });

    it('should return empty schema for single-part identifier', async () => {
      const connector = new SapHanaConnector();
      const schema = await connector.getAssetSchema('no_dot');
      expect(schema.fields).toEqual([]);
    });
  });

  describe('JiraConnector', () => {
    it('should return well-known schema for projects', async () => {
      const connector = new JiraConnector();
      const schema = await connector.getAssetSchema('project:TEST');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('summary');
      expect(schema.fields.map(f => f.name)).toContain('status.name');
      expect(schema.fields.map(f => f.name)).toContain('assignee.emailAddress');
      expect(schema.fields.map(f => f.name)).toContain('reporter.emailAddress');
    });

    it('should return empty schema for non-project assets', async () => {
      const connector = new JiraConnector();
      const schema = await connector.getAssetSchema('field:customfield_10001');
      expect(schema.fields).toEqual([]);
    });

    it('should not sample non-project assets', async () => {
      const connector = new JiraConnector();
      const gen = connector.sampleContent('field:test', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('ConfluenceConnector', () => {
    it('should return well-known schema for pages', async () => {
      const connector = new ConfluenceConnector();
      const schema = await connector.getAssetSchema('page:12345');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('title');
      expect(schema.fields.map(f => f.name)).toContain('body');
      expect(schema.fields.map(f => f.name)).toContain('authorId');
    });

    it('should return empty schema for non-page assets', async () => {
      const connector = new ConfluenceConnector();
      const schema = await connector.getAssetSchema('space:DEV');
      expect(schema.fields).toEqual([]);
    });

    it('should not sample non-space assets', async () => {
      const connector = new ConfluenceConnector();
      const gen = connector.sampleContent('page:12345', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('CyberArkConnector', () => {
    it('should return schema for accounts', async () => {
      const connector = new CyberArkConnector();
      const schema = await connector.getAssetSchema('account:123');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('userName');
      expect(schema.fields.map(f => f.name)).toContain('safeName');
    });

    it('should return schema for safes', async () => {
      const connector = new CyberArkConnector();
      const schema = await connector.getAssetSchema('safe:MySafe');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('safeName');
      expect(schema.fields.map(f => f.name)).toContain('managingCPM');
    });

    it('should return empty schema for platforms', async () => {
      const connector = new CyberArkConnector();
      const schema = await connector.getAssetSchema('platform:WinDomain');
      expect(schema.fields).toEqual([]);
    });

    it('should not support content sampling', async () => {
      const connector = new CyberArkConnector();
      const gen = connector.sampleContent('account:123', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });

  describe('SailPointConnector', () => {
    it('should return schema for identities', async () => {
      const connector = new SailPointConnector();
      const schema = await connector.getAssetSchema('object:identities');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('email');
      expect(schema.fields.map(f => f.name)).toContain('department');
      expect(schema.fields.map(f => f.name)).toContain('manager');
    });

    it('should return empty schema for non-identity assets', async () => {
      const connector = new SailPointConnector();
      const schema = await connector.getAssetSchema('source:abc123');
      expect(schema.fields).toEqual([]);
    });

    it('should not support content sampling', async () => {
      const connector = new SailPointConnector();
      const gen = connector.sampleContent('object:identities', { maxRows: 10, maxColumns: 10, excludePatterns: [] });
      const result = await gen.next();
      expect(result.done).toBe(true);
    });
  });
});
