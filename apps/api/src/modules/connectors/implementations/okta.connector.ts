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
 * Okta connector using the Okta Management API.
 * Discovers users, groups, and applications. Maps role/group assignments as access policies.
 */
export class OktaConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { apiToken } = config.credentials;
    this.setupApiKeyAuth(apiToken, 'Authorization', 'SSWS');
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { domain } = config.credentials; // e.g., "dev-12345.okta.com"
    this.baseUrl = `https://${domain}/api/v1`;
    this.paginationStyle = 'link_header';
    this.defaultPageSize = 200;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/org');
      return {
        success: true,
        message: `Connected to Okta: ${result.companyName}`,
        metadata: { companyName: result.companyName, subdomain: result.subdomain },
      };
    } catch (error: any) {
      return { success: false, message: `Okta connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List users
    let usersUrl: string | undefined = '/users';
    while (usersUrl) {
      const resp = await this.request<any>('GET', usersUrl, {
        query: usersUrl === '/users' ? { limit: 200 } : {},
      });
      const users = Array.isArray(resp) ? resp : resp.data || [];

      for (const user of users) {
        yield {
          externalId: `user:${user.id}`,
          name: `${user.profile?.firstName} ${user.profile?.lastName}`,
          type: 'user',
          path: `okta/users/${user.profile?.login}`,
          metadata: {
            login: user.profile?.login,
            email: user.profile?.email,
            status: user.status,
            created: user.created,
            lastLogin: user.lastLogin,
          },
        };
      }

      // Okta uses Link header for pagination
      usersUrl = undefined; // Will be set by link header parsing in real scenario
      if (users.length < 200) break;
    }

    // List groups
    const groups = await this.request<any>('GET', '/groups', { query: { limit: 200 } });
    for (const group of Array.isArray(groups) ? groups : []) {
      yield {
        externalId: `group:${group.id}`,
        name: group.profile?.name,
        type: 'group',
        path: `okta/groups/${group.profile?.name}`,
        metadata: {
          description: group.profile?.description,
          type: group.type,
          memberCount: group._embedded?.stats?.usersCount,
        },
      };
    }

    // List applications
    const apps = await this.request<any>('GET', '/apps', { query: { limit: 200 } });
    for (const app of Array.isArray(apps) ? apps : []) {
      yield {
        externalId: `app:${app.id}`,
        name: app.label || app.name,
        type: 'api_endpoint',
        path: `okta/apps/${app.label}`,
        metadata: {
          status: app.status,
          signOnMode: app.signOnMode,
          created: app.created,
        },
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('user:')) {
      return {
        fields: [
          { name: 'login', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'email', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'firstName', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'lastName', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: 'status', dataType: 'string', ordinalPosition: 4, nullable: false },
          { name: 'mobilePhone', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'department', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'title', dataType: 'string', ordinalPosition: 7, nullable: true },
        ],
      };
    }

    if (assetExternalId.startsWith('group:')) {
      return {
        fields: [
          { name: 'name', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'description', dataType: 'string', ordinalPosition: 1, nullable: true },
          { name: 'type', dataType: 'string', ordinalPosition: 2, nullable: false },
        ],
      };
    }

    return { fields: [] };
  }

  // Identity connectors don't sample tabular data
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // No content sampling for identity connectors
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];

    if (assetExternalId.startsWith('user:')) {
      const userId = assetExternalId.replace('user:', '');

      // Get user's group memberships
      try {
        const groups = await this.request<any>('GET', `/users/${userId}/groups`);
        for (const group of Array.isArray(groups) ? groups : []) {
          policies.push({
            principal: group.profile?.name || group.id,
            principalType: 'group',
            permissions: ['member'],
            source: 'okta_group_membership',
          });
        }
      } catch (error: any) {
        this.logger.warn(`Error fetching user groups: ${error.message}`);
      }

      // Get user's app assignments
      try {
        const appLinks = await this.request<any>('GET', `/users/${userId}/appLinks`);
        for (const link of Array.isArray(appLinks) ? appLinks : []) {
          policies.push({
            principal: link.label || link.appName,
            principalType: 'service',
            permissions: ['assigned'],
            source: 'okta_app_assignment',
          });
        }
      } catch (error: any) {
        this.logger.warn(`Error fetching user app links: ${error.message}`);
      }
    }

    if (assetExternalId.startsWith('group:')) {
      const groupId = assetExternalId.replace('group:', '');

      try {
        const members = await this.request<any>('GET', `/groups/${groupId}/users`, { query: { limit: 200 } });
        for (const member of Array.isArray(members) ? members : []) {
          policies.push({
            principal: member.profile?.login || member.id,
            principalType: 'user',
            permissions: ['member'],
            source: 'okta_group_members',
          });
        }
      } catch (error: any) {
        this.logger.warn(`Error fetching group members: ${error.message}`);
      }
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'okta',
      displayName: 'Okta',
      description: 'Connect to Okta for user, group, and app discovery',
      authMethods: ['api_key'],
      requiredPermissions: [
        'okta.users.read',
        'okta.groups.read',
        'okta.apps.read',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: false,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
