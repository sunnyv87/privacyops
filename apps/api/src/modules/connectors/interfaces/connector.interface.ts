/**
 * Core connector interface that all data source connectors must implement.
 * This is the plugin contract for the DSPM connector framework.
 */

export interface ConnectorConfig {
  type: DataSourceType;
  credentials: Record<string, any>;
  options: Record<string, any>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  metadata?: Record<string, any>; // e.g., region, version, account ID
}

export interface DiscoveredAsset {
  externalId: string; // Unique ID in the source system
  name: string;
  type: AssetType;
  path: string;
  parentExternalId?: string;
  metadata: Record<string, any>;
  sizeBytes?: number;
  rowCountEstimate?: number;
}

export interface AssetSchema {
  fields: SchemaField[];
  metadata?: Record<string, any>;
}

export interface SchemaField {
  name: string;
  dataType: string;
  ordinalPosition: number;
  nullable: boolean;
  description?: string;
}

export interface ContentSample {
  assetExternalId: string;
  fieldName: string;
  values: any[];
  totalSampled: number;
}

export interface SampleOptions {
  maxRows: number;
  maxColumns: number;
  sampleStrategy: 'first_n' | 'random' | 'stratified';
  excludePatterns: string[];
}

export interface AccessPolicy {
  principal: string;
  principalType: 'user' | 'group' | 'role' | 'service' | 'public';
  permissions: string[];
  source: string; // e.g., "bucket_policy", "iam_policy", "acl"
}

export interface ConnectorCapabilities {
  supportsDiscovery: boolean;
  supportsContentSampling: boolean;
  supportsAccessAnalysis: boolean;
  supportsIncrementalScan: boolean;
  supportsEncryptionCheck: boolean;
}

export interface ConnectorMetadata {
  type: DataSourceType;
  displayName: string;
  description: string;
  authMethods: string[];
  requiredPermissions: string[];
  capabilities: ConnectorCapabilities;
}

export type DataSourceType =
  | 'aws_s3'
  | 'aws_rds'
  | 'azure_blob'
  | 'gcp_storage'
  | 'postgresql'
  | 'mysql'
  | 'sqlserver'
  | 'mongodb'
  | 'snowflake'
  | 'bigquery'
  | 'google_drive'
  | 'onedrive'
  | 'sharepoint'
  | 'salesforce'
  | 'github'
  | 'slack'
  | 'm365'
  | 'generic_rest'
  | 'redshift'
  | 'databricks'
  | 'servicenow'
  | 'okta'
  | 'azure_ad'
  | 'teams'
  | 'splunk'
  | 'oracle'
  | 'cassandra'
  | 'workday'
  | 'hubspot'
  | 'zendesk'
  | 'dropbox'
  | 'ping_identity'
  | 'gitlab'
  | 'bitbucket'
  | 'jenkins'
  | 'microsoft_sentinel'
  | 'elastic_security'
  | 'wiz'
  | 'prisma_cloud'
  | 'sap_hana'
  | 'jira'
  | 'confluence'
  | 'cyberark'
  | 'sailpoint';

export type AssetType =
  | 'table'
  | 'view'
  | 'bucket'
  | 'container'
  | 'collection'
  | 'file'
  | 'api_endpoint'
  | 'channel'
  | 'repository'
  | 'database'
  | 'schema'
  | 'user'
  | 'group'
  | 'team'
  | 'index'
  | 'site'
  | 'list'
  | 'drive'
  | 'keyspace'
  | 'finding'
  | 'alert'
  | 'pipeline'
  | 'job'
  | 'space'
  | 'project'
  | 'vault'
  | 'safe';

/**
 * The interface every connector must implement.
 */
export interface IConnector {
  initialize(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  disconnect(): Promise<void>;

  listAssets(): AsyncGenerator<DiscoveredAsset>;
  getAssetSchema(assetExternalId: string): Promise<AssetSchema>;

  sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample>;

  getAccessPolicies?(assetExternalId: string): Promise<AccessPolicy[]>;

  getMetadata(): ConnectorMetadata;
}
