import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, JSONCodec, JetStreamManager, JetStreamClient } from 'nats';

export interface PlatformEvent {
  type: string;
  tenantId: string;
  data: any;
  timestamp: Date;
  correlationId?: string;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private codec = JSONCodec();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    try {
      const natsUrl = this.config.get('NATS_URL', 'nats://localhost:4222');
      this.connection = await connect({ servers: natsUrl });

      // Setup JetStream
      const jsm: JetStreamManager = await this.connection.jetstreamManager();

      // Create stream for platform events
      try {
        await jsm.streams.add({
          name: 'PRIVACYOPS',
          subjects: ['privacyops.>'],
          retention: 'limits' as any,
          max_msgs: 1000000,
          max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
        });
      } catch {
        // Stream may already exist
      }

      this.js = this.connection.jetstream();
      console.log('NATS connected');
    } catch (error) {
      console.warn('NATS connection failed, events will be logged only:', error);
    }
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  async publish(event: PlatformEvent): Promise<void> {
    const subject = `privacyops.${event.type}`;
    const payload = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

    if (this.js) {
      await this.js.publish(subject, this.codec.encode(payload));
    } else {
      console.log(`[Event] ${subject}:`, JSON.stringify(payload));
    }
  }

  async subscribe(
    subject: string,
    durableName: string,
    handler: (event: PlatformEvent) => Promise<void>,
  ): Promise<void> {
    if (!this.js) {
      console.warn(`Cannot subscribe to ${subject}: NATS not connected`);
      return;
    }

    const sub = await this.js.subscribe(`privacyops.${subject}`, {
      durable_name: durableName,
    } as any);

    (async () => {
      for await (const msg of sub) {
        try {
          const event = this.codec.decode(msg.data) as PlatformEvent;
          await handler(event);
          msg.ack();
        } catch (error) {
          console.error(`Error processing event on ${subject}:`, error);
          msg.nak();
        }
      }
    })();
  }
}
