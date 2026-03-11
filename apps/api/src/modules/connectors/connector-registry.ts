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

@Injectable()
export class ConnectorRegistry {
  private connectors = new Map<DataSourceType, () => IConnector>();

  constructor() {
    // Register all available connectors
    this.register('aws_s3', () => new AwsS3Connector());
    this.register('postgresql', () => new PostgresConnector());
    this.register('mysql', () => new MysqlConnector());
    this.register('mongodb', () => new MongodbConnector());
    this.register('azure_blob', () => new AzureBlobConnector());
    this.register('gcp_storage', () => new GcpStorageConnector());
    this.register('snowflake', () => new SnowflakeConnector());
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
