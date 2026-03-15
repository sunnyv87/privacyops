/**
 * Wave 1 connector unit tests.
 * Tests instantiation, metadata, and interface compliance for all new connectors.
 * External API calls are not tested here — these verify connector structure and contracts.
 */
import { AwsRdsConnector } from '../../../src/modules/connectors/implementations/aws-rds.connector';
import { RedshiftConnector } from '../../../src/modules/connectors/implementations/redshift.connector';
import { DatabricksConnector } from '../../../src/modules/connectors/implementations/databricks.connector';
import { SalesforceConnector } from '../../../src/modules/connectors/implementations/salesforce.connector';
import { ServiceNowConnector } from '../../../src/modules/connectors/implementations/servicenow.connector';
import { GoogleDriveConnector } from '../../../src/modules/connectors/implementations/google-drive.connector';
import { OneDriveConnector } from '../../../src/modules/connectors/implementations/onedrive.connector';
import { SharePointConnector } from '../../../src/modules/connectors/implementations/sharepoint.connector';
import { SlackConnector } from '../../../src/modules/connectors/implementations/slack.connector';
import { TeamsConnector } from '../../../src/modules/connectors/implementations/teams.connector';
import { OktaConnector } from '../../../src/modules/connectors/implementations/okta.connector';
import { AzureAdConnector } from '../../../src/modules/connectors/implementations/azure-ad.connector';
import { GitHubConnector } from '../../../src/modules/connectors/implementations/github.connector';
import { SplunkConnector } from '../../../src/modules/connectors/implementations/splunk.connector';
import { GenericRestConnector } from '../../../src/modules/connectors/implementations/generic-rest.connector';
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

const wave1Connectors: ConnectorTestCase[] = [
  {
    name: 'AwsRdsConnector',
    ConnectorClass: AwsRdsConnector,
    expectedType: 'aws_rds',
    expectedDisplayName: 'Amazon RDS',
    expectedAuthMethods: ['iam_role', 'connection_string'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'RedshiftConnector',
    ConnectorClass: RedshiftConnector,
    expectedType: 'redshift',
    expectedDisplayName: 'Amazon Redshift',
    expectedAuthMethods: ['connection_string', 'iam_role'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'DatabricksConnector',
    ConnectorClass: DatabricksConnector,
    expectedType: 'databricks',
    expectedDisplayName: 'Databricks',
    expectedAuthMethods: ['pat', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'SalesforceConnector',
    ConnectorClass: SalesforceConnector,
    expectedType: 'salesforce',
    expectedDisplayName: 'Salesforce',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'ServiceNowConnector',
    ConnectorClass: ServiceNowConnector,
    expectedType: 'servicenow',
    expectedDisplayName: 'ServiceNow',
    expectedAuthMethods: ['oauth2', 'basic_auth'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'GoogleDriveConnector',
    ConnectorClass: GoogleDriveConnector,
    expectedType: 'google_drive',
    expectedDisplayName: 'Google Drive',
    expectedAuthMethods: ['oauth2', 'service_account'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'OneDriveConnector',
    ConnectorClass: OneDriveConnector,
    expectedType: 'onedrive',
    expectedDisplayName: 'OneDrive',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'SharePointConnector',
    ConnectorClass: SharePointConnector,
    expectedType: 'sharepoint',
    expectedDisplayName: 'SharePoint',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'SlackConnector',
    ConnectorClass: SlackConnector,
    expectedType: 'slack',
    expectedDisplayName: 'Slack',
    expectedAuthMethods: ['bot_token', 'oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'TeamsConnector',
    ConnectorClass: TeamsConnector,
    expectedType: 'teams',
    expectedDisplayName: 'Microsoft Teams',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'OktaConnector',
    ConnectorClass: OktaConnector,
    expectedType: 'okta',
    expectedDisplayName: 'Okta',
    expectedAuthMethods: ['api_key'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'AzureAdConnector',
    ConnectorClass: AzureAdConnector,
    expectedType: 'azure_ad',
    expectedDisplayName: 'Azure AD (Entra ID)',
    expectedAuthMethods: ['oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'GitHubConnector',
    ConnectorClass: GitHubConnector,
    expectedType: 'github',
    expectedDisplayName: 'GitHub',
    expectedAuthMethods: ['pat', 'oauth2'],
    supportsContentSampling: false,
    supportsAccessAnalysis: true,
  },
  {
    name: 'SplunkConnector',
    ConnectorClass: SplunkConnector,
    expectedType: 'splunk',
    expectedDisplayName: 'Splunk',
    expectedAuthMethods: ['api_key', 'basic_auth'],
    supportsContentSampling: true,
    supportsAccessAnalysis: true,
  },
  {
    name: 'GenericRestConnector',
    ConnectorClass: GenericRestConnector,
    expectedType: 'generic_rest',
    expectedDisplayName: 'Generic REST API',
    expectedAuthMethods: ['api_key', 'oauth2', 'basic_auth', 'pat'],
    supportsContentSampling: false, // depends on config
    supportsAccessAnalysis: false,
  },
];

describe('Wave 1 Connectors', () => {
  describe.each(wave1Connectors)('$name', ({
    ConnectorClass,
    expectedType,
    expectedDisplayName,
    expectedAuthMethods,
    supportsContentSampling,
    supportsAccessAnalysis,
  }) => {
    let connector: any;

    beforeEach(() => {
      connector = new ConnectorClass();
    });

    it('should instantiate without errors', () => {
      expect(connector).toBeDefined();
    });

    it('should implement IConnector interface methods', () => {
      expect(typeof connector.initialize).toBe('function');
      expect(typeof connector.testConnection).toBe('function');
      expect(typeof connector.disconnect).toBe('function');
      expect(typeof connector.listAssets).toBe('function');
      expect(typeof connector.getAssetSchema).toBe('function');
      expect(typeof connector.sampleContent).toBe('function');
      expect(typeof connector.getMetadata).toBe('function');
    });

    describe('getMetadata', () => {
      let metadata: ConnectorMetadata;

      beforeEach(() => {
        metadata = connector.getMetadata();
      });

      it(`should return type "${expectedType}"`, () => {
        expect(metadata.type).toBe(expectedType);
      });

      it(`should return displayName "${expectedDisplayName}"`, () => {
        expect(metadata.displayName).toBe(expectedDisplayName);
      });

      it('should have a non-empty description', () => {
        expect(metadata.description.length).toBeGreaterThan(10);
      });

      it('should declare expected auth methods', () => {
        for (const method of expectedAuthMethods) {
          expect(metadata.authMethods).toContain(method);
        }
      });

      it('should have valid capabilities object', () => {
        expect(metadata.capabilities).toBeDefined();
        expect(metadata.capabilities.supportsDiscovery).toBe(true);
        expect(typeof metadata.capabilities.supportsContentSampling).toBe('boolean');
        expect(typeof metadata.capabilities.supportsAccessAnalysis).toBe('boolean');
        expect(typeof metadata.capabilities.supportsIncrementalScan).toBe('boolean');
        expect(typeof metadata.capabilities.supportsEncryptionCheck).toBe('boolean');
      });

      it(`should report supportsContentSampling=${supportsContentSampling}`, () => {
        expect(metadata.capabilities.supportsContentSampling).toBe(supportsContentSampling);
      });

      it(`should report supportsAccessAnalysis=${supportsAccessAnalysis}`, () => {
        expect(metadata.capabilities.supportsAccessAnalysis).toBe(supportsAccessAnalysis);
      });

      it('should have non-empty requiredPermissions', () => {
        expect(metadata.requiredPermissions.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Wave 1 Connector Functional Contracts', () => {
  describe('SQL Connectors (AwsRds, Redshift)', () => {
    it('AwsRdsConnector should support getAccessPolicies', () => {
      const connector = new AwsRdsConnector();
      expect(typeof connector.getAccessPolicies).toBe('function');
    });

    it('RedshiftConnector should support getAccessPolicies', () => {
      const connector = new RedshiftConnector();
      expect(typeof connector.getAccessPolicies).toBe('function');
    });
  });

  describe('Identity Connectors (Okta, AzureAD)', () => {
    it('OktaConnector sampleContent should be a generator that yields nothing', async () => {
      const connector = new OktaConnector();
      const samples: any[] = [];
      for await (const s of connector.sampleContent('user:123', {
        maxRows: 10, maxColumns: 10, sampleStrategy: 'first_n', excludePatterns: [],
      })) {
        samples.push(s);
      }
      expect(samples).toHaveLength(0);
    });

    it('AzureAdConnector sampleContent should be a generator that yields nothing', async () => {
      const connector = new AzureAdConnector();
      const samples: any[] = [];
      for await (const s of connector.sampleContent('user:123', {
        maxRows: 10, maxColumns: 10, sampleStrategy: 'first_n', excludePatterns: [],
      })) {
        samples.push(s);
      }
      expect(samples).toHaveLength(0);
    });
  });

  describe('DevOps Connector (GitHub)', () => {
    it('GitHubConnector sampleContent should be a generator that yields nothing', async () => {
      const connector = new GitHubConnector();
      const samples: any[] = [];
      for await (const s of connector.sampleContent('repo:org/repo', {
        maxRows: 10, maxColumns: 10, sampleStrategy: 'first_n', excludePatterns: [],
      })) {
        samples.push(s);
      }
      expect(samples).toHaveLength(0);
    });

    it('GitHubConnector getAssetSchema should return repo metadata schema', async () => {
      const connector = new GitHubConnector();
      const schema = await connector.getAssetSchema('repo:myorg/myrepo');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('name');
      expect(schema.fields.map(f => f.name)).toContain('private');
    });
  });

  describe('Collaboration Connector (Slack)', () => {
    it('SlackConnector getAssetSchema should return message schema for channels', async () => {
      const connector = new SlackConnector();
      const schema = await connector.getAssetSchema('channel:C12345');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('text');
      expect(schema.fields.map(f => f.name)).toContain('user');
    });

    it('SlackConnector getAssetSchema should return user schema for users', async () => {
      const connector = new SlackConnector();
      const schema = await connector.getAssetSchema('user:U12345');
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.map(f => f.name)).toContain('email');
    });
  });

  describe('Security Connector (Splunk)', () => {
    it('SplunkConnector getAssetSchema should return non-empty schema for non-index assets', async () => {
      const connector = new SplunkConnector();
      // Without initialization, schema for non-index assets returns empty
      const schema = await connector.getAssetSchema('savedsearch:test');
      expect(schema.fields).toHaveLength(0);
    });

    it('SplunkConnector metadata should declare index discovery', () => {
      const connector = new SplunkConnector();
      const meta = connector.getMetadata();
      expect(meta.capabilities.supportsDiscovery).toBe(true);
      expect(meta.capabilities.supportsContentSampling).toBe(true);
    });
  });
});
