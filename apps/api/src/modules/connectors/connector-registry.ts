import { Injectable } from '@nestjs/common';
import {
  IConnector,
  DataSourceType,
  ConnectorMetadata,
} from './interfaces/connector.interface';
import { AwsS3Connector } from './implementations/aws-s3.connector';
import { PostgresConnector } from './implementations/postgres.connector';
import { MysqlConnector } from './implementations/mysql.connector';
import { MongodbConnector } from './implementations/mongodb.connector';
import { AzureBlobConnector } from './implementations/azure-blob.connector';
import { GcpStorageConnector } from './implementations/gcp-storage.connector';
import { SnowflakeConnector } from './implementations/snowflake.connector';
import { MssqlConnector } from './implementations/mssql.connector';
import { BigQueryConnector } from './implementations/bigquery.connector';
// Wave 1 connectors
import { AwsRdsConnector } from './implementations/aws-rds.connector';
import { RedshiftConnector } from './implementations/redshift.connector';
import { DatabricksConnector } from './implementations/databricks.connector';
import { SalesforceConnector } from './implementations/salesforce.connector';
import { ServiceNowConnector } from './implementations/servicenow.connector';
import { GoogleDriveConnector } from './implementations/google-drive.connector';
import { OneDriveConnector } from './implementations/onedrive.connector';
import { SharePointConnector } from './implementations/sharepoint.connector';
import { SlackConnector } from './implementations/slack.connector';
import { TeamsConnector } from './implementations/teams.connector';
import { OktaConnector } from './implementations/okta.connector';
import { AzureAdConnector } from './implementations/azure-ad.connector';
import { GitHubConnector } from './implementations/github.connector';
import { SplunkConnector } from './implementations/splunk.connector';
import { GenericRestConnector } from './implementations/generic-rest.connector';
// Wave 2 connectors
import { OracleConnector } from './implementations/oracle.connector';
import { CassandraConnector } from './implementations/cassandra.connector';
import { WorkdayConnector } from './implementations/workday.connector';
import { HubSpotConnector } from './implementations/hubspot.connector';
import { ZendeskConnector } from './implementations/zendesk.connector';
import { DropboxConnector } from './implementations/dropbox.connector';
import { PingIdentityConnector } from './implementations/ping-identity.connector';
import { GitLabConnector } from './implementations/gitlab.connector';
import { BitbucketConnector } from './implementations/bitbucket.connector';
import { JenkinsConnector } from './implementations/jenkins.connector';
import { MicrosoftSentinelConnector } from './implementations/microsoft-sentinel.connector';
import { ElasticSecurityConnector } from './implementations/elastic-security.connector';
import { WizConnector } from './implementations/wiz.connector';
import { PrismaCloudConnector } from './implementations/prisma-cloud.connector';

@Injectable()
export class ConnectorRegistry {
  private connectors = new Map<DataSourceType, () => IConnector>();

  constructor() {
    // ── Existing connectors ─────────────────────────────────
    this.register('aws_s3', () => new AwsS3Connector());
    this.register('postgresql', () => new PostgresConnector());
    this.register('mysql', () => new MysqlConnector());
    this.register('mongodb', () => new MongodbConnector());
    this.register('azure_blob', () => new AzureBlobConnector());
    this.register('gcp_storage', () => new GcpStorageConnector());
    this.register('snowflake', () => new SnowflakeConnector());
    this.register('sqlserver', () => new MssqlConnector());
    this.register('bigquery', () => new BigQueryConnector());

    // ── Wave 1 connectors ───────────────────────────────────
    this.register('aws_rds', () => new AwsRdsConnector());
    this.register('redshift', () => new RedshiftConnector());
    this.register('databricks', () => new DatabricksConnector());
    this.register('salesforce', () => new SalesforceConnector());
    this.register('servicenow', () => new ServiceNowConnector());
    this.register('google_drive', () => new GoogleDriveConnector());
    this.register('onedrive', () => new OneDriveConnector());
    this.register('sharepoint', () => new SharePointConnector());
    this.register('slack', () => new SlackConnector());
    this.register('teams', () => new TeamsConnector());
    this.register('okta', () => new OktaConnector());
    this.register('azure_ad', () => new AzureAdConnector());
    this.register('github', () => new GitHubConnector());
    this.register('splunk', () => new SplunkConnector());
    this.register('generic_rest', () => new GenericRestConnector());

    // ── Wave 2 connectors ───────────────────────────────────
    this.register('oracle', () => new OracleConnector());
    this.register('cassandra', () => new CassandraConnector());
    this.register('workday', () => new WorkdayConnector());
    this.register('hubspot', () => new HubSpotConnector());
    this.register('zendesk', () => new ZendeskConnector());
    this.register('dropbox', () => new DropboxConnector());
    this.register('ping_identity', () => new PingIdentityConnector());
    this.register('gitlab', () => new GitLabConnector());
    this.register('bitbucket', () => new BitbucketConnector());
    this.register('jenkins', () => new JenkinsConnector());
    this.register('microsoft_sentinel', () => new MicrosoftSentinelConnector());
    this.register('elastic_security', () => new ElasticSecurityConnector());
    this.register('wiz', () => new WizConnector());
    this.register('prisma_cloud', () => new PrismaCloudConnector());
  }

  register(type: DataSourceType, factory: () => IConnector): void {
    this.connectors.set(type, factory);
  }

  create(type: DataSourceType): IConnector {
    const factory = this.connectors.get(type);
    if (!factory) {
      throw new Error(`No connector registered for type: ${type}`);
    }
    return factory();
  }

  getAvailableTypes(): DataSourceType[] {
    return Array.from(this.connectors.keys());
  }

  getMetadata(): ConnectorMetadata[] {
    return Array.from(this.connectors.entries()).map(([, factory]) => {
      const connector = factory();
      return connector.getMetadata();
    });
  }
}
