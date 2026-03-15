import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { ConnectorRegistry } from './connector-registry';
import { AwsS3Connector } from './implementations/aws-s3.connector';
import { PostgresConnector } from './implementations/postgres.connector';
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

@Module({
  controllers: [ConnectorsController],
  providers: [
    ConnectorsService,
    ConnectorRegistry,
    AwsS3Connector,
    PostgresConnector,
    // Wave 1
    AwsRdsConnector,
    RedshiftConnector,
    DatabricksConnector,
    SalesforceConnector,
    ServiceNowConnector,
    GoogleDriveConnector,
    OneDriveConnector,
    SharePointConnector,
    SlackConnector,
    TeamsConnector,
    OktaConnector,
    AzureAdConnector,
    GitHubConnector,
    SplunkConnector,
    GenericRestConnector,
    // Wave 2
    OracleConnector,
    CassandraConnector,
    WorkdayConnector,
    HubSpotConnector,
    ZendeskConnector,
    DropboxConnector,
    PingIdentityConnector,
    GitLabConnector,
    BitbucketConnector,
    JenkinsConnector,
    MicrosoftSentinelConnector,
    ElasticSecurityConnector,
    WizConnector,
    PrismaCloudConnector,
  ],
  exports: [ConnectorsService, ConnectorRegistry],
})
export class ConnectorsModule {}
