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
 * Microsoft Teams connector using Microsoft Graph API.
 * Discovers teams, channels, and files shared within teams.
 */
export class TeamsConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { tenantId, clientId, clientSecret } = config.credentials;

    await this.setupOAuth2ClientCredentials(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      clientId,
      clientSecret,
      ['https://graph.microsoft.com/.default'],
    );
  }

  protected async setupClient(): Promise<void> {
    this.baseUrl = 'https://graph.microsoft.com/v1.0';
    this.paginationStyle = 'odata_next';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/teams', { query: { '$top': 1 } });
      return {
        success: true,
        message: 'Connected to Microsoft Teams',
        metadata: { teamCount: result.value?.length },
      };
    } catch (error: any) {
      return { success: false, message: `Teams connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List teams
    for await (const page of this.paginate<any>('/teams', {
      query: { '$select': 'id,displayName,description,createdDateTime' },
      dataExtractor: (r) => r.value || [],
      maxPages: 20,
    })) {
      for (const team of page) {
        yield {
          externalId: `team:${team.id}`,
          name: team.displayName,
          type: 'team',
          path: `teams/${team.displayName}`,
          metadata: {
            description: team.description,
            created: team.createdDateTime,
          },
        };

        // List channels in team
        try {
          const channels = await this.request<any>(
            'GET',
            `/teams/${team.id}/channels`,
            { query: { '$select': 'id,displayName,description,membershipType,createdDateTime' } },
          );

          for (const channel of channels.value || []) {
            yield {
              externalId: `channel:${team.id}/${channel.id}`,
              name: channel.displayName,
              type: 'channel',
              path: `teams/${team.displayName}/${channel.displayName}`,
              parentExternalId: `team:${team.id}`,
              metadata: {
                description: channel.description,
                membershipType: channel.membershipType,
                created: channel.createdDateTime,
              },
            };
          }
        } catch (error: any) {
          this.logger.warn(`Error listing channels in ${team.displayName}: ${error.message}`);
        }

        // List files in team drive
        try {
          const drive = await this.request<any>('GET', `/groups/${team.id}/drive`);
          const items = await this.request<any>(
            'GET',
            `/drives/${drive.id}/root/children`,
            { query: { '$select': 'id,name,size,file,folder,lastModifiedDateTime' } },
          );

          for (const item of items.value || []) {
            yield {
              externalId: `file:${drive.id}/${item.id}`,
              name: item.name,
              type: item.folder ? 'container' : 'file',
              path: `teams/${team.displayName}/files/${item.name}`,
              parentExternalId: `team:${team.id}`,
              metadata: {
                mimeType: item.file?.mimeType,
                lastModified: item.lastModifiedDateTime,
              },
              sizeBytes: item.size,
            };
          }
        } catch {
          // Drive access may not be available
        }
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('channel:')) {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'from', dataType: 'string', ordinalPosition: 1, nullable: true },
          { name: 'body', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'createdDateTime', dataType: 'datetime', ordinalPosition: 3, nullable: false },
        ],
        metadata: { description: 'Teams channel message schema' },
      };
    }
    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    if (!assetExternalId.startsWith('channel:')) return;

    const [teamId, channelId] = assetExternalId.replace('channel:', '').split('/');

    try {
      const result = await this.request<any>(
        'GET',
        `/teams/${teamId}/channels/${channelId}/messages`,
        { query: { '$top': Math.min(options.maxRows, 50) } },
      );

      const messages = result.value || [];

      const fields = ['body', 'from', 'createdDateTime'];
      for (const field of fields) {
        const values = messages.map((m: any) => {
          if (field === 'body') return m.body?.content?.replace(/<[^>]*>/g, '').slice(0, 500);
          if (field === 'from') return m.from?.user?.displayName;
          return m[field];
        }).filter((v: any) => v != null);

        yield { assetExternalId, fieldName: field, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Teams message sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    if (!assetExternalId.startsWith('team:')) return [];

    const teamId = assetExternalId.replace('team:', '');
    const policies: AccessPolicy[] = [];

    try {
      const members = await this.request<any>('GET', `/teams/${teamId}/members`);

      for (const member of members.value || []) {
        policies.push({
          principal: member.displayName || member.email,
          principalType: 'user',
          permissions: member.roles?.length ? member.roles : ['member'],
          source: 'teams_membership',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching Teams members: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'teams',
      displayName: 'Microsoft Teams',
      description: 'Connect to Microsoft Teams for team, channel, and file discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'Team.ReadBasic.All', 'Channel.ReadBasic.All',
        'ChannelMessage.Read.All', 'Files.Read.All',
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
