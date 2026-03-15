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
 * GitHub connector using the GitHub REST API v3.
 * Discovers organizations, repositories, and branches. Maps collaborators as access policies.
 */
export class GitHubConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { token, appId, privateKey, installationId } = config.credentials;

    if (token) {
      this.setupBearerAuth(token);
    } else if (appId && privateKey && installationId) {
      // GitHub App installation token flow
      const installationToken = await this.getInstallationToken(appId, privateKey, installationId);
      this.setupBearerAuth(installationToken);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { apiUrl } = config.credentials;
    this.baseUrl = apiUrl || 'https://api.github.com';
    this.paginationStyle = 'link_header';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/user');
      return {
        success: true,
        message: `Connected as ${result.login}`,
        metadata: { login: result.login, name: result.name },
      };
    } catch (error: any) {
      return { success: false, message: `GitHub connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List organizations
    const orgs = await this.request<any[]>('GET', '/user/orgs');

    for (const org of orgs || []) {
      yield {
        externalId: `org:${org.login}`,
        name: org.login,
        type: 'database', // org as top-level container
        path: `github/${org.login}`,
        metadata: { description: org.description, url: org.url },
      };

      // List repos in org
      let page = 1;
      while (true) {
        const repos = await this.request<any[]>('GET', `/orgs/${org.login}/repos`, {
          query: { per_page: 100, page, type: 'all' },
        });

        if (!repos?.length) break;

        for (const repo of repos) {
          yield {
            externalId: `repo:${repo.full_name}`,
            name: repo.name,
            type: 'repository',
            path: `github/${repo.full_name}`,
            parentExternalId: `org:${org.login}`,
            metadata: {
              private: repo.private,
              language: repo.language,
              defaultBranch: repo.default_branch,
              archived: repo.archived,
              owner: repo.owner?.login,
              topics: repo.topics,
              pushedAt: repo.pushed_at,
            },
            sizeBytes: (repo.size || 0) * 1024, // GitHub reports KB
          };
        }

        if (repos.length < 100) break;
        page++;
      }
    }

    // Also list user repos (personal)
    let page = 1;
    while (true) {
      const repos = await this.request<any[]>('GET', '/user/repos', {
        query: { per_page: 100, page, type: 'owner' },
      });

      if (!repos?.length) break;

      for (const repo of repos) {
        if (repo.fork) continue; // Skip forks
        yield {
          externalId: `repo:${repo.full_name}`,
          name: repo.name,
          type: 'repository',
          path: `github/${repo.full_name}`,
          metadata: {
            private: repo.private,
            language: repo.language,
            defaultBranch: repo.default_branch,
            owner: repo.owner?.login,
          },
          sizeBytes: (repo.size || 0) * 1024,
        };
      }

      if (repos.length < 100) break;
      page++;
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (assetExternalId.startsWith('repo:')) {
      return {
        fields: [
          { name: 'name', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'full_name', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'private', dataType: 'boolean', ordinalPosition: 2, nullable: false },
          { name: 'language', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'default_branch', dataType: 'string', ordinalPosition: 4, nullable: false },
          { name: 'size_kb', dataType: 'integer', ordinalPosition: 5, nullable: false },
          { name: 'pushed_at', dataType: 'datetime', ordinalPosition: 6, nullable: true },
        ],
        metadata: { description: 'GitHub repository metadata' },
      };
    }
    return { fields: [] };
  }

  // Code repos are not sampled for PII content
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // Repository code is not sampled — out of scope for DSPM content classification
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    if (!assetExternalId.startsWith('repo:')) return [];

    const repoFullName = assetExternalId.replace('repo:', '');
    const policies: AccessPolicy[] = [];

    try {
      const collaborators = await this.request<any[]>(
        'GET',
        `/repos/${repoFullName}/collaborators`,
        { query: { per_page: 100 } },
      );

      for (const collab of collaborators || []) {
        policies.push({
          principal: collab.login,
          principalType: 'user',
          permissions: collab.permissions
            ? Object.entries(collab.permissions).filter(([, v]) => v).map(([k]) => k)
            : [collab.role_name || 'read'],
          source: 'github_collaborators',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching GitHub collaborators: ${error.message}`);
    }

    // Check branch protection
    try {
      const repo = await this.request<any>('GET', `/repos/${repoFullName}`);
      const branch = repo.default_branch;
      const protection = await this.request<any>(
        'GET',
        `/repos/${repoFullName}/branches/${branch}/protection`,
      );

      if (protection.required_pull_request_reviews) {
        policies.push({
          principal: 'branch_protection',
          principalType: 'role',
          permissions: ['require_pr_review'],
          source: 'github_branch_protection',
        });
      }
    } catch {
      // Branch protection may not be configured
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'github',
      displayName: 'GitHub',
      description: 'Connect to GitHub for repository and access discovery',
      authMethods: ['pat', 'oauth2'],
      requiredPermissions: ['repo', 'read:org', 'admin:org (for collaborator listing)'],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: false,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }

  private async getInstallationToken(appId: string, privateKey: string, installationId: string): Promise<string> {
    const crypto = await import('crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: appId, iat: now - 60, exp: now + 600 })).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const resp = await fetch(`${this.baseUrl}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json' },
    });
    const data = await resp.json();
    return data.token;
  }
}
