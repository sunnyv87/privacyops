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
 * GitLab connector using the GitLab REST API v4.
 * Discovers projects, groups, and members. Retrieves project-level access policies.
 */
export class GitLabConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { personalAccessToken, oauthToken } = config.credentials;

    if (oauthToken) {
      this.setupBearerAuth(oauthToken);
    } else if (personalAccessToken) {
      // GitLab uses PRIVATE-TOKEN header for PATs
      this.authHeaders = { 'PRIVATE-TOKEN': personalAccessToken };
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host } = config.credentials;
    this.baseUrl = `https://${host || 'gitlab.com'}/api/v4`;
    this.paginationStyle = 'link_header';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/user');
      return {
        success: true,
        message: `Connected as ${result.username}`,
        metadata: { username: result.username, email: result.email, isAdmin: result.is_admin },
      };
    } catch (error: any) {
      return { success: false, message: `GitLab connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List groups
    let page = 1;
    while (true) {
      try {
        const groups = await this.request<any[]>('GET', '/groups', {
          query: { per_page: 100, page, min_access_level: 10 },
        });
        if (!groups || groups.length === 0) break;

        for (const group of groups) {
          yield {
            externalId: `group:${group.id}`,
            name: group.full_name || group.name,
            type: 'group',
            path: `gitlab/groups/${group.full_path}`,
            metadata: {
              visibility: group.visibility,
              webUrl: group.web_url,
            },
          };
        }
        if (groups.length < 100) break;
        page++;
      } catch {
        break;
      }
    }

    // List projects
    page = 1;
    while (true) {
      try {
        const projects = await this.request<any[]>('GET', '/projects', {
          query: { per_page: 100, page, membership: 'true', order_by: 'last_activity_at' },
        });
        if (!projects || projects.length === 0) break;

        for (const project of projects) {
          yield {
            externalId: `project:${project.id}`,
            name: project.name,
            type: 'container',
            path: `gitlab/projects/${project.path_with_namespace}`,
            parentExternalId: project.namespace?.id ? `group:${project.namespace.id}` : undefined,
            metadata: {
              visibility: project.visibility,
              defaultBranch: project.default_branch,
              lastActivity: project.last_activity_at,
            },
          };
        }
        if (projects.length < 100) break;
        page++;
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
    const [type, id] = assetExternalId.split(':');

    if (type !== 'project') return policies;

    try {
      const members = await this.request<any[]>('GET', `/projects/${id}/members/all`, {
        query: { per_page: 100 },
      });

      const accessLevelMap: Record<number, string> = {
        10: 'guest', 20: 'reporter', 30: 'developer', 40: 'maintainer', 50: 'owner',
      };

      for (const member of members || []) {
        policies.push({
          principal: member.username || member.name || 'unknown',
          principalType: 'user',
          permissions: [accessLevelMap[member.access_level] || `level_${member.access_level}`],
          source: 'gitlab_project_members',
        });
      }
    } catch {}

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'gitlab',
      displayName: 'GitLab',
      description: 'Connect to GitLab for project and group discovery with access analysis',
      authMethods: ['pat', 'oauth2'],
      requiredPermissions: [
        'read_api',
        'read_user',
        'read_repository',
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
