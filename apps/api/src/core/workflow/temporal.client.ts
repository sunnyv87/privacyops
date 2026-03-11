import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';

@Injectable()
export class TemporalClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalClient.name);
  private connection: Connection | null = null;
  private _client: Client | null = null;

  get client(): Client {
    if (!this._client) {
      throw new Error('Temporal client not connected');
    }
    return this._client;
  }

  get isConnected(): boolean {
    return this._client !== null;
  }

  async onModuleInit() {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE || 'privacyops';

    try {
      this.connection = await Connection.connect({ address });
      this._client = new Client({
        connection: this.connection,
        namespace,
      });
      this.logger.log(`Connected to Temporal at ${address} (namespace: ${namespace})`);
    } catch (error) {
      this.logger.warn(
        `Could not connect to Temporal at ${address}. Workflow features will be unavailable.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}
