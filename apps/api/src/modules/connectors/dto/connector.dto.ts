import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';

export enum DataSourceTypeEnum {
  AWS_S3 = 'aws_s3',
  AWS_RDS = 'aws_rds',
  AZURE_BLOB = 'azure_blob',
  GCP_STORAGE = 'gcp_storage',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLSERVER = 'sqlserver',
  MONGODB = 'mongodb',
  SNOWFLAKE = 'snowflake',
  BIGQUERY = 'bigquery',
  GOOGLE_DRIVE = 'google_drive',
  ONEDRIVE = 'onedrive',
  SHAREPOINT = 'sharepoint',
  SALESFORCE = 'salesforce',
  GITHUB = 'github',
  SLACK = 'slack',
  M365 = 'm365',
  GENERIC_REST = 'generic_rest',
  REDSHIFT = 'redshift',
  DATABRICKS = 'databricks',
  SERVICENOW = 'servicenow',
  OKTA = 'okta',
  AZURE_AD = 'azure_ad',
  TEAMS = 'teams',
  SPLUNK = 'splunk',
}

export enum AuthMethodEnum {
  IAM_ROLE = 'iam_role',
  ACCESS_KEY = 'access_key',
  OAUTH2 = 'oauth2',
  SERVICE_ACCOUNT = 'service_account',
  CONNECTION_STRING = 'connection_string',
  API_KEY = 'api_key',
  PAT = 'pat',
  BOT_TOKEN = 'bot_token',
  BASIC_AUTH = 'basic_auth',
}

export class CreateConnectorDto {
  @ApiProperty({ description: 'Display name for this data source' })
  @IsString()
  name: string;

  @ApiProperty({ enum: DataSourceTypeEnum })
  @IsEnum(DataSourceTypeEnum)
  type: DataSourceTypeEnum;

  @ApiProperty({ enum: AuthMethodEnum })
  @IsEnum(AuthMethodEnum)
  authMethod: AuthMethodEnum;

  @ApiProperty({ description: 'Connection configuration (encrypted at rest)' })
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional({ description: 'Cron schedule for automated scans' })
  @IsOptional()
  @IsString()
  scanSchedule?: string;

  @ApiPropertyOptional({ description: 'Tags for organization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateConnectorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scanSchedule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class TestConnectorDto {
  @ApiProperty({ enum: DataSourceTypeEnum })
  @IsEnum(DataSourceTypeEnum)
  type: DataSourceTypeEnum;

  @ApiProperty({ enum: AuthMethodEnum })
  @IsEnum(AuthMethodEnum)
  authMethod: AuthMethodEnum;

  @ApiProperty()
  @IsObject()
  config: Record<string, any>;
}

export class ConnectorResponseDto {
  id: string;
  name: string;
  type: string;
  status: string;
  authMethod: string;
  lastConnectedAt: string | null;
  lastScanAt: string | null;
  scanSchedule: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
