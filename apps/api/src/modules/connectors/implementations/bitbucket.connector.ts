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
 * Bitbucket connector using the Bitbucket Cloud REST API 2.0.
 * Discovers workspaces, repositories, and project structure.
 */
export class BitbucketConnector extends BaseRestApiConnector {
  private workspace: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { username, appPassword, oauthToken } = config.credentials;

    if (oauthToken) {
      this.setupBearerAuth(oauthToken);
    } else if (username && appPassword) {
      this.setupBasicAuth(username, appPassword);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { workspace, host } = config.credentials;
    this.workspace = workspace || '';
    this.baseUrl = host
      ? `https://${host}/rest/api/1.0`  // Bitbucket Server/DC
      : 'https://api.bitbucket.org/2.0'; // Bitbucket Cloud
    this.paginationStyle = 'cursor';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/user');
      return {
        success: true,
        message: `Connected as ${result.display_name || result.username}`,
        metadata: { username: result.username, accountId: result.account_id },
      };
    } catch (error: any) {
      return { success: false, message: `Bitbucket connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    if (!this.workspace) {
      // List all accessible workspaces
      try {
        const result = await this.request<any>('GET', '/workspaces', {
          query: { pagelen: 100 },
        });
        for (const ws of result.values || []) {
          yield {
            externalId: `workspace:${ws.slug}`,
            name: ws.name,
            type: 'container',
            path: `bitbucket/${ws.slug}`,
            metadata: { uuid: ws.uuid },
          };
          // List repos in each workspace
          yield* this.listReposInWorkspace(ws.slug);
        }
      } catch {}
    } else {
      yield* this.listReposInWorkspace(this.workspace);
    }
  }

  private async *listReposInWorkspace(workspace: string): AsyncGenerator<DiscoveredAsset> {
    let url: string | null = `/repositories/${workspace}`;

    while (url) {
      try {
        const result = await this.request<any>('GET', url, {
          query: { pagelen: 100 },
        });

        for (const repo of result.values || []) {
          yield {
            externalId: `repo:${repo.full_name}`,
            name: repo.name,
            type: 'container',
            path: `bitbucket/${repo.full_name}`,
            parentExternalId: `workspace:${workspace}`,
            metadata: {
              isPrivate: repo.is_private,
              language: repo.language,
              mainBranch: repo.mainbranch?.name,
              updatedOn: repo.updated_on,
            },
          };
        }

        // Bitbucket Cloud uses 'next' URL for pagination
        url = result.next ? result.next.replace(this.baseUrl, '') : null;
      } catch {
        break;
      }
    }
  }

  async getAssetSchema(_assetExternalId: string): Promise<AssetSchema> {
    return { fields: [] };
  }

  // DevOps connectors: code repos are not sampled for PII
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {}

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const policies: AccessPolicy[] = [];
    const [type, ...rest] = assetExternalId.split(':');
    const fullName = rest.join(':');

    if (type !== 'repo') return policies;

    try {
      // Get repository permissions
      let url: string | null = `/repositories/${fullName}/permissions-config/users`;
      while (url) {
        const result = await this.request<any>('GET', url, { query: { pagelen: 100 } });

        for (const perm of result.values || []) {
          policies.push({
            principal: perm.user?.display_name || perm.user?.nickname || 'unknown',
            principalType: 'user',
            permissions: [perm.permission || 'read'],
            source: 'bitbucket_repo_permissions',
          });
        }

        url = result.next ? result.next.replace(this.baseUrl, '') : null;
      }
    } catch {}

    try {
      // Get group permissions
      let url: string | null = `/repositories/${fullName}/permissions-config/groups`;
      while (url) {
        const result = await this.request<any>('GET', url, { query: { pagelen: 100 } });

        for (const perm of result.values || []) {
          policies.push({
            principal: perm.group?.name || perm.group?.slug || 'unknown',
            principalType: 'group',
            permissions: [perm.permission || 'read'],
            source: 'bitbucket_repo_permissions',
          });
        }

        url = result.next ? result.next.replace(this.baseUrl, '') : null;
      }
    } catch {}

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'bitbucket',
      displayName: 'Bitbucket',
      description: 'Connect to Bitbucket Cloud/Server for repository and workspace discovery',
      authMethods: ['basic_auth', 'oauth2'],
      requiredPermissions: [
        'repository:read',
        'account:read',
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
