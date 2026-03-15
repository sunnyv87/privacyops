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
 * Azure Active Directory (Entra ID) connector using Microsoft Graph API.
 * Discovers users, groups, and enterprise applications.
 */
export class AzureAdConnector extends BaseRestApiConnector {
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
      const result = await this.request<any>('GET', '/organization');
      const org = result.value?.[0];
      return {
        success: true,
        message: `Connected to Azure AD: ${org?.displayName}`,
        metadata: { tenantId: org?.id, displayName: org?.displayName },
      };
    } catch (error: any) {
      return { success: false, message: `Azure AD connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List users
    for await (const page of this.paginate<any>('/users', {
      query: { '$select': 'id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled,createdDateTime' },
      dataExtractor: (r) => r.value || [],
      maxPages: 50,
    })) {
      for (const user of page) {
        yield {
          externalId: `user:${user.id}`,
          name: user.displayName,
          type: 'user',
          path: `azure-ad/users/${user.userPrincipalName}`,
          metadata: {
            upn: user.userPrincipalName,
            email: user.mail,
            jobTitle: user.jobTitle,
            department: user.department,
            enabled: user.accountEnabled,
            created: user.createdDateTime,
          },
        };
      }
    }

    // List groups
    for await (const page of this.paginate<any>('/groups', {
      query: { '$select': 'id,displayName,description,groupTypes,membershipRule,createdDateTime' },
      dataExtractor: (r) => r.value || [],
      maxPages: 20,
    })) {
      for (const group of page) {
        yield {
          externalId: `group:${group.id}`,
          name: group.displayName,
          type: 'group',
          path: `azure-ad/groups/${group.displayName}`,
          metadata: {
            description: group.description,
            groupTypes: group.groupTypes,
            isDynamic: !!group.membershipRule,
            created: group.createdDateTime,
          },
        };
      }
    }

    // List enterprise applications (service principals)
    for await (const page of this.paginate<any>('/servicePrincipals', {
      query: { '$select': 'id,displayName,appId,servicePrincipalType,accountEnabled' },
      dataExtractor: (r) => r.value || [],
      maxPages: 20,
    })) {
      for (const sp of page) {
        yield {
          externalId: `app:${sp.id}`,
          name: sp.displayName,
          type: 'api_endpoint',
          path: `azure-ad/apps/${sp.displayName}`,
          metadata: {
            appId: sp.appId,
            type: sp.servicePrincipalType,
            enabled: sp.accountEnabled,
          },
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('user:')) {
      return {
        fields: [
          { name: 'userPrincipalName', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'displayName', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'mail', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'jobTitle', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'department', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'accountEnabled', dataType: 'boolean', ordinalPosition: 5, nullable: false },
        ],
      };
    }

    if (assetExternalId.startsWith('group:')) {
      return {
        fields: [
          { name: 'displayName', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'description', dataType: 'string', ordinalPosition: 1, nullable: true },
          { name: 'groupTypes', dataType: 'array', ordinalPosition: 2, nullable: true },
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

      // Get group memberships
      try {
        const memberships = await this.request<any>(
          'GET',
          `/users/${userId}/memberOf`,
          { query: { '$select': 'id,displayName' } },
        );

        for (const membership of memberships.value || []) {
          policies.push({
            principal: membership.displayName || membership.id,
            principalType: 'group',
            permissions: ['member'],
            source: 'azure_ad_membership',
          });
        }
      } catch (error: any) {
        this.logger.warn(`Error fetching user memberships: ${error.message}`);
      }

      // Get directory roles
      try {
        const roles = await this.request<any>(
          'GET',
          `/users/${userId}/transitiveMemberOf/microsoft.graph.directoryRole`,
          { query: { '$select': 'id,displayName' } },
        );

        for (const role of roles.value || []) {
          policies.push({
            principal: role.displayName,
            principalType: 'role',
            permissions: ['assigned'],
            source: 'azure_ad_directory_role',
          });
        }
      } catch {}
    }

    if (assetExternalId.startsWith('group:')) {
      const groupId = assetExternalId.replace('group:', '');

      try {
        const members = await this.request<any>(
          'GET',
          `/groups/${groupId}/members`,
          { query: { '$select': 'id,displayName,userPrincipalName', '$top': 200 } },
        );

        for (const member of members.value || []) {
          policies.push({
            principal: member.userPrincipalName || member.displayName || member.id,
            principalType: 'user',
            permissions: ['member'],
            source: 'azure_ad_group_members',
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
      type: 'azure_ad',
      displayName: 'Azure AD (Entra ID)',
      description: 'Connect to Azure Active Directory for user, group, and app discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'User.Read.All',
        'Group.Read.All',
        'Application.Read.All',
        'Directory.Read.All',
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
