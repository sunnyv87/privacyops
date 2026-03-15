import { Logger } from '@nestjs/common';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';
import { BaseRestApiConnector } from '../sdk/base-rest-api-connector';

/**
 * Slack connector using the Slack Web API.
 * Discovers channels and users, samples recent messages.
 */
export class SlackConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { botToken } = config.credentials;
    this.setupBearerAuth(botToken);
  }

  protected async setupClient(): Promise<void> {
    this.baseUrl = 'https://slack.com/api';
    this.paginationStyle = 'cursor';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('POST', '/auth.test');
      if (!result.ok) {
        return { success: false, message: `Slack auth failed: ${result.error}` };
      }
      return {
        success: true,
        message: `Connected to ${result.team}`,
        metadata: { team: result.team, teamId: result.team_id, user: result.user },
      };
    } catch (error: any) {
      return { success: false, message: `Slack connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List channels
    let cursor: string | undefined;
    do {
      const params: Record<string, string | number> = { limit: 200, types: 'public_channel,private_channel' };
      if (cursor) params.cursor = cursor;

      const result = await this.request<any>('GET', '/conversations.list', { query: params });
      if (!result.ok) break;

      for (const channel of result.channels || []) {
        yield {
          externalId: `channel:${channel.id}`,
          name: channel.name,
          type: 'channel',
          path: `slack/#${channel.name}`,
          metadata: {
            isPrivate: channel.is_private,
            numMembers: channel.num_members,
            topic: channel.topic?.value,
            purpose: channel.purpose?.value,
            creator: channel.creator,
            created: channel.created ? new Date(channel.created * 1000).toISOString() : undefined,
          },
        };
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    // List users
    let userCursor: string | undefined;
    do {
      const params: Record<string, string | number> = { limit: 200 };
      if (userCursor) params.cursor = userCursor;

      const result = await this.request<any>('GET', '/users.list', { query: params });
      if (!result.ok) break;

      for (const user of result.members || []) {
        if (user.deleted || user.is_bot) continue;

        yield {
          externalId: `user:${user.id}`,
          name: user.real_name || user.name,
          type: 'user',
          path: `slack/@${user.name}`,
          metadata: {
            email: user.profile?.email,
            title: user.profile?.title,
            isAdmin: user.is_admin,
            isOwner: user.is_owner,
          },
        };
      }

      userCursor = result.response_metadata?.next_cursor;
    } while (userCursor);
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('channel:')) {
      return {
        fields: [
          { name: 'ts', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'user', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'text', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'type', dataType: 'string', ordinalPosition: 3, nullable: false },
        ],
        metadata: { description: 'Slack message schema' },
      };
    }

    if (assetExternalId.startsWith('user:')) {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'real_name', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'email', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'title', dataType: 'string', ordinalPosition: 4, nullable: true },
        ],
        metadata: { description: 'Slack user profile schema' },
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    if (!assetExternalId.startsWith('channel:')) return;

    const channelId = assetExternalId.replace('channel:', '');

    try {
      const result = await this.request<any>('GET', '/conversations.history', {
        query: { channel: channelId, limit: Math.min(options.maxRows, 100) },
      });

      if (!result.ok) return;

      const messages = result.messages || [];

      // Yield per-field samples
      for (const field of ['user', 'text', 'type', 'ts']) {
        const values = messages
          .map((m: any) => m[field])
          .filter((v: any) => v != null);

        yield {
          assetExternalId,
          fieldName: field,
          values: values.slice(0, 100),
          totalSampled: values.length,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Slack message sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    if (!assetExternalId.startsWith('channel:')) return [];

    const channelId = assetExternalId.replace('channel:', '');
    const policies: AccessPolicy[] = [];

    try {
      let cursor: string | undefined;
      do {
        const params: Record<string, string | number> = { channel: channelId, limit: 200 };
        if (cursor) params.cursor = cursor;

        const result = await this.request<any>('GET', '/conversations.members', { query: params });
        if (!result.ok) break;

        for (const userId of result.members || []) {
          policies.push({
            principal: userId,
            principalType: 'user',
            permissions: ['read', 'write'],
            source: 'channel_membership',
          });
        }

        cursor = result.response_metadata?.next_cursor;
      } while (cursor);
    } catch (error: any) {
      this.logger.warn(`Error fetching Slack channel members: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'slack',
      displayName: 'Slack',
      description: 'Connect to Slack for channel and message discovery',
      authMethods: ['bot_token', 'oauth2'],
      requiredPermissions: [
        'channels:read', 'channels:history',
        'groups:read', 'groups:history',
        'users:read', 'users:read.email',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
