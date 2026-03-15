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
 * SailPoint IdentityNow connector using the SailPoint V3/Beta APIs.
 * Discovers identities, sources, access profiles, roles, and entitlements.
 */
export class SailPointConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { clientId, clientSecret, accessToken, tenant } = config.credentials;

    if (accessToken) {
      this.setupBearerAuth(accessToken);
    } else if (clientId && clientSecret) {
      await this.setupOAuth2ClientCredentials(
        `https://${tenant}.api.identitynow.com/oauth/token`,
        clientId,
        clientSecret,
      );
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { tenant } = config.credentials;
    this.baseUrl = `https://${tenant}.api.identitynow.com`;
    this.paginationStyle = 'offset';
    this.defaultPageSize = 250;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/v3/public-identities', {
        query: { limit: 1 },
      });
      return {
        success: true,
        message: 'Connected to SailPoint IdentityNow',
        metadata: { identityCount: result.length },
      };
    } catch (error: any) {
      return { success: false, message: `SailPoint connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover sources (connected applications/systems)
    try {
      const sources = await this.request<any[]>('GET', '/v3/sources', {
        query: { limit: 250 },
      });

      for (const source of sources || []) {
        yield {
          externalId: `source:${source.id}`,
          name: source.name,
          type: 'container',
          path: `sailpoint/sources/${source.id}`,
          metadata: {
            type: source.type,
            connector: source.connector,
            authoritative: source.authoritative,
            description: source.description,
          },
        };
      }
    } catch {}

    // Discover identity count as a data asset
    try {
      const result = await this.request<any>('GET', '/v3/public-identities', {
        query: { limit: 1, count: 'true' },
      });
      yield {
        externalId: 'object:identities',
        name: 'Identities',
        type: 'user',
        path: 'sailpoint/identities',
        metadata: { description: 'All managed identities' },
      };
    } catch {}

    // Discover access profiles
    try {
      const profiles = await this.request<any[]>('GET', '/v3/access-profiles', {
        query: { limit: 250 },
      });

      for (const profile of profiles || []) {
        yield {
          externalId: `accessProfile:${profile.id}`,
          name: profile.name,
          type: 'group',
          path: `sailpoint/access-profiles/${profile.id}`,
          parentExternalId: profile.source?.id ? `source:${profile.source.id}` : undefined,
          metadata: {
            description: profile.description,
            enabled: profile.enabled,
            requestable: profile.requestable,
            source: profile.source?.name,
          },
        };
      }
    } catch {}

    // Discover roles
    try {
      const roles = await this.request<any[]>('GET', '/v3/roles', {
        query: { limit: 250 },
      });

      for (const role of roles || []) {
        yield {
          externalId: `role:${role.id}`,
          name: role.name,
          type: 'group',
          path: `sailpoint/roles/${role.id}`,
          metadata: {
            description: role.description,
            enabled: role.enabled,
            requestable: role.requestable,
            owner: role.owner?.name,
          },
        };
      }
    } catch {}

    // Discover entitlements (top-level summary)
    try {
      const entitlements = await this.request<any[]>('GET', '/beta/entitlements', {
        query: { limit: 250 },
      });

      for (const ent of entitlements || []) {
        yield {
          externalId: `entitlement:${ent.id}`,
          name: ent.name || ent.value,
          type: 'group',
          path: `sailpoint/entitlements/${ent.id}`,
          parentExternalId: ent.source?.id ? `source:${ent.source.id}` : undefined,
          metadata: {
            type: ent.type,
            attribute: ent.attribute,
            value: ent.value,
            source: ent.source?.name,
            privileged: ent.privileged,
          },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'object' && assetExternalId === 'object:identities') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'displayName', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'email', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'phone', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'manager', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'department', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'identityStatus', dataType: 'string', ordinalPosition: 7, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  // Identity governance connectors: metadata only, no tabular PII sampling
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {}

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [type, id] = assetExternalId.split(':');
    const policies: AccessPolicy[] = [];

    if (type === 'accessProfile') {
      try {
        const profile = await this.request<any>('GET', `/v3/access-profiles/${id}`);
        if (profile.owner) {
          policies.push({
            principal: profile.owner.name || profile.owner.id,
            principalType: 'user',
            permissions: ['owner'],
            source: 'sailpoint_access_profile',
          });
        }
        for (const ent of profile.entitlements || []) {
          policies.push({
            principal: ent.name || ent.id,
            principalType: 'role',
            permissions: ['entitlement'],
            source: 'sailpoint_access_profile',
          });
        }
      } catch {}
    }

    if (type === 'role') {
      try {
        const role = await this.request<any>('GET', `/v3/roles/${id}`);
        if (role.owner) {
          policies.push({
            principal: role.owner.name || role.owner.id,
            principalType: 'user',
            permissions: ['owner'],
            source: 'sailpoint_role',
          });
        }
      } catch {}
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'sailpoint',
      displayName: 'SailPoint',
      description: 'Connect to SailPoint IdentityNow for identity governance and access discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'idn:access-profile:read',
        'idn:role:read',
        'idn:source:read',
        'idn:identity:read',
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
