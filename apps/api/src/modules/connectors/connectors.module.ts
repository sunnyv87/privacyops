import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { ConnectorRegistry } from './connector-registry';
import { AwsS3Connector } from './implementations/aws-s3.connector';
import { PostgresConnector } from './implementations/postgres.connector';

@Module({
  controllers: [ConnectorsController],
  providers: [
    ConnectorsService,
    ConnectorRegistry,
    AwsS3Connector,
    PostgresConnector,
  ],
  exports: [ConnectorsService, ConnectorRegistry],
})
export class ConnectorsModule {}
