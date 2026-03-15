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
 * CyberArk connector using the CyberArk PAM (Privileged Access Manager) REST API.
 * Discovers safes, accounts, platforms, and users.
 * Does NOT retrieve actual secrets — only metadata for access governance.
 */
export class CyberArkConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { username, password, token, authType } = config.credentials;

    if (token) {
      this.authHeaders = { Authorization: token };
    } else if (username && password) {
      // CyberArk uses a session token from the Logon endpoint
      const method = authType || 'CyberArk';
      const resp = await fetch(`${this.baseUrl}/API/Auth/${method}/Logon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) throw new Error(`CyberArk auth failed: ${resp.status}`);
      const sessionToken = await resp.json();
      // CyberArk returns the token as a raw JSON string
      this.authHeaders = { Authorization: typeof sessionToken === 'string' ? sessionToken : sessionToken.token };
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, port, protocol } = config.credentials;
    const proto = protocol || 'https';
    const portSuffix = port ? `:${port}` : '';
    this.baseUrl = `${proto}://${host}${portSuffix}/PasswordVault`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/API/ServerWebServices.svc/verify');
      return {
        success: true,
        message: 'Connected to CyberArk PAM',
        metadata: { serverName: result.ServerName, serverId: result.ServerId },
      };
    } catch (error: any) {
      // Verify endpoint may return different formats
      return { success: false, message: `CyberArk connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.request<any>('POST', '/API/Auth/Logoff');
    } catch {
      // Best-effort logoff
    }
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover safes
    let offset = 0;
    const limit = 100;

    while (true) {
      try {
        const result = await this.request<any>('GET', '/API/Safes', {
          query: { offset, limit },
        });

        const safes = result.value || result.Safes || [];
        if (safes.length === 0) break;

        for (const safe of safes) {
          const safeName = safe.safeName || safe.SafeName;
          yield {
            externalId: `safe:${safeName}`,
            name: safeName,
            type: 'safe',
            path: `cyberark/safes/${safeName}`,
            metadata: {
              description: safe.description || safe.Description,
              managingCPM: safe.managingCPM || safe.ManagingCPM,
              numberOfDaysRetention: safe.numberOfDaysRetention,
              numberOfVersionsRetention: safe.numberOfVersionsRetention,
            },
          };
        }

        if (safes.length < limit) break;
        offset += safes.length;
      } catch {
        break;
      }
    }

    // Discover accounts (privileged credentials metadata)
    offset = 0;
    while (true) {
      try {
        const result = await this.request<any>('GET', '/API/Accounts', {
          query: { offset, limit },
        });

        const accounts = result.value || [];
        if (accounts.length === 0) break;

        for (const account of accounts) {
          yield {
            externalId: `account:${account.id}`,
            name: account.name || account.userName || account.address,
            type: 'user',
            path: `cyberark/accounts/${account.id}`,
            parentExternalId: account.safeName ? `safe:${account.safeName}` : undefined,
            metadata: {
              platformId: account.platformId,
              address: account.address,
              userName: account.userName,
              safeName: account.safeName,
              secretType: account.secretType,
              secretManagement: account.secretManagement,
            },
          };
        }

        if (accounts.length < limit) break;
        offset += accounts.length;
      } catch {
        break;
      }
    }

    // Discover platforms
    try {
      const result = await this.request<any>('GET', '/API/Platforms');
      for (const platform of result.Platforms || []) {
        yield {
          externalId: `platform:${platform.PlatformID}`,
          name: platform.Name || platform.PlatformID,
          type: 'container',
          path: `cyberark/platforms/${platform.PlatformID}`,
          metadata: {
            active: platform.Active,
            systemType: platform.SystemType,
          },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'account') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'address', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'userName', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'platformId', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'safeName', dataType: 'string', ordinalPosition: 5, nullable: false },
          { name: 'secretType', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'createdTime', dataType: 'datetime', ordinalPosition: 7, nullable: true },
        ],
      };
    }

    if (type === 'safe') {
      return {
        fields: [
          { name: 'safeName', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'description', dataType: 'string', ordinalPosition: 1, nullable: true },
          { name: 'managingCPM', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'numberOfDaysRetention', dataType: 'integer', ordinalPosition: 3, nullable: true },
          { name: 'numberOfVersionsRetention', dataType: 'integer', ordinalPosition: 4, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  // Identity/PAM connectors: metadata only, no tabular PII sampling
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {}

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [type, name] = assetExternalId.split(':');
    if (type !== 'safe') return [];

    const policies: AccessPolicy[] = [];

    try {
      const result = await this.request<any>('GET', `/API/Safes/${encodeURIComponent(name)}/Members`);
      for (const member of result.value || result.members || []) {
        const memberName = member.memberName || member.MemberName;
        const memberType = member.memberType || member.MemberType;

        const permissions: string[] = [];
        const perms = member.permissions || member.Permissions || {};
        for (const [perm, granted] of Object.entries(perms)) {
          if (granted) permissions.push(perm);
        }

        policies.push({
          principal: memberName || 'unknown',
          principalType: memberType === 'Group' ? 'group' : 'user',
          permissions,
          source: 'cyberark_safe_members',
        });
      }
    } catch {}

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'cyberark',
      displayName: 'CyberArk',
      description: 'Connect to CyberArk PAM for safe, account, and privileged access discovery',
      authMethods: ['basic_auth', 'api_key'],
      requiredPermissions: [
        'List Safes',
        'List Accounts',
        'View Safe Members',
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
