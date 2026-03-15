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
 * Confluence connector using the Confluence Cloud REST API v2 / Server REST API.
 * Discovers spaces, pages, and blog posts. Samples page content for PII detection.
 */
export class ConfluenceConnector extends BaseRestApiConnector {
  private isCloud: boolean = true;

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { email, apiToken, personalAccessToken, oauthToken } = config.credentials;

    if (oauthToken) {
      this.setupBearerAuth(oauthToken);
    } else if (personalAccessToken) {
      this.setupBearerAuth(personalAccessToken);
    } else if (email && apiToken) {
      this.setupBasicAuth(email, apiToken);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, isCloud } = config.credentials;
    this.isCloud = isCloud !== false;
    // Cloud uses /wiki/api/v2, Server uses /rest/api
    this.baseUrl = this.isCloud
      ? `https://${host}/wiki/api/v2`
      : `https://${host}/rest/api`;
    this.paginationStyle = 'cursor';
    this.defaultPageSize = 25;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (this.isCloud) {
        const result = await this.request<any>('GET', '/spaces', { query: { limit: 1 } });
        return {
          success: true,
          message: `Connected to Confluence Cloud (${result.results?.length ?? 0} spaces accessible)`,
          metadata: {},
        };
      } else {
        const result = await this.request<any>('GET', '/space', { query: { limit: 1 } });
        return {
          success: true,
          message: `Connected to Confluence Server`,
          metadata: { size: result.size },
        };
      }
    } catch (error: any) {
      return { success: false, message: `Confluence connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    if (this.isCloud) {
      yield* this.listAssetsCloud();
    } else {
      yield* this.listAssetsServer();
    }
  }

  private async *listAssetsCloud(): AsyncGenerator<DiscoveredAsset> {
    // List spaces
    let cursor: string | undefined;

    do {
      try {
        const query: Record<string, any> = { limit: 25 };
        if (cursor) query.cursor = cursor;

        const result = await this.request<any>('GET', '/spaces', { query });

        for (const space of result.results || []) {
          yield {
            externalId: `space:${space.id}`,
            name: space.name,
            type: 'space',
            path: `confluence/spaces/${space.key}`,
            metadata: {
              key: space.key,
              type: space.type,
              status: space.status,
            },
          };

          // List pages in space
          yield* this.listPagesInSpaceCloud(space.id, space.key);
        }

        cursor = result._links?.next ? this.extractCursor(result._links.next) : undefined;
      } catch {
        break;
      }
    } while (cursor);
  }

  private async *listPagesInSpaceCloud(
    spaceId: string,
    spaceKey: string,
  ): AsyncGenerator<DiscoveredAsset> {
    let cursor: string | undefined;

    do {
      try {
        const query: Record<string, any> = { limit: 25 };
        if (cursor) query.cursor = cursor;

        const result = await this.request<any>('GET', `/spaces/${spaceId}/pages`, { query });

        for (const page of result.results || []) {
          yield {
            externalId: `page:${page.id}`,
            name: page.title,
            type: 'file',
            path: `confluence/spaces/${spaceKey}/pages/${page.id}`,
            parentExternalId: `space:${spaceId}`,
            metadata: {
              status: page.status,
              createdAt: page.createdAt,
              version: page.version?.number,
            },
          };
        }

        cursor = result._links?.next ? this.extractCursor(result._links.next) : undefined;
      } catch {
        break;
      }
    } while (cursor);
  }

  private async *listAssetsServer(): AsyncGenerator<DiscoveredAsset> {
    let start = 0;
    while (true) {
      try {
        const result = await this.request<any>('GET', '/space', {
          query: { start, limit: 25, expand: 'description.plain' },
        });

        const spaces = result.results || [];
        if (spaces.length === 0) break;

        for (const space of spaces) {
          yield {
            externalId: `space:${space.key}`,
            name: space.name,
            type: 'space',
            path: `confluence/spaces/${space.key}`,
            metadata: {
              key: space.key,
              type: space.type,
            },
          };

          // List pages (content) in space
          yield* this.listContentInSpaceServer(space.key);
        }

        if (spaces.length < 25) break;
        start += spaces.length;
      } catch {
        break;
      }
    }
  }

  private async *listContentInSpaceServer(spaceKey: string): AsyncGenerator<DiscoveredAsset> {
    let start = 0;
    while (true) {
      try {
        const result = await this.request<any>('GET', '/content', {
          query: { spaceKey, start, limit: 25, type: 'page' },
        });

        const pages = result.results || [];
        if (pages.length === 0) break;

        for (const page of pages) {
          yield {
            externalId: `page:${page.id}`,
            name: page.title,
            type: 'file',
            path: `confluence/spaces/${spaceKey}/pages/${page.id}`,
            parentExternalId: `space:${spaceKey}`,
            metadata: {
              status: page.status,
              type: page.type,
            },
          };
        }

        if (pages.length < 25) break;
        start += pages.length;
      } catch {
        break;
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'page') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'title', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'body', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'status', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: 'createdAt', dataType: 'datetime', ordinalPosition: 4, nullable: true },
          { name: 'authorId', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'version', dataType: 'integer', ordinalPosition: 6, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [type, id] = assetExternalId.split(':');
    if (type !== 'space') return;

    try {
      let pages: any[];

      if (this.isCloud) {
        const result = await this.request<any>('GET', `/spaces/${id}/pages`, {
          query: { limit: Math.min(options.maxRows, 25), 'body-format': 'storage' },
        });
        pages = result.results || [];
      } else {
        const result = await this.request<any>('GET', '/content', {
          query: {
            spaceKey: id,
            limit: Math.min(options.maxRows, 25),
            expand: 'body.storage,version',
          },
        });
        pages = result.results || [];
      }

      if (pages.length === 0) return;

      const fieldExtractors: Record<string, (p: any) => any> = {
        title: (p) => p.title,
        body: (p) => {
          const html = p.body?.storage?.value || '';
          // Strip HTML tags for plain text sampling
          return html.replace(/<[^>]*>/g, '').substring(0, 500);
        },
        status: (p) => p.status,
        authorId: (p) => p.authorId || p.version?.by?.displayName,
      };

      const fields = Object.keys(fieldExtractors)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const extractor = fieldExtractors[fieldName];
        const values = pages.map(extractor).filter((v: any) => v != null && v !== '');
        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Confluence sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [type, id] = assetExternalId.split(':');
    if (type !== 'space') return [];

    const policies: AccessPolicy[] = [];

    try {
      if (this.isCloud) {
        const result = await this.request<any>('GET', `/spaces/${id}/permissions`);
        for (const perm of result.results || []) {
          policies.push({
            principal: perm.principal?.id || 'unknown',
            principalType: perm.principal?.type === 'group' ? 'group' : 'user',
            permissions: [perm.operation?.operation || 'read'],
            source: 'confluence_space_permissions',
          });
        }
      } else {
        const result = await this.request<any>('GET', `/space/${id}`, {
          query: { expand: 'permissions' },
        });
        for (const perm of result.permissions || []) {
          if (perm.subjects?.user) {
            for (const user of Object.values(perm.subjects.user.results || {})) {
              policies.push({
                principal: (user as any).displayName || 'unknown',
                principalType: 'user',
                permissions: [perm.operation?.operation || 'read'],
                source: 'confluence_space_permissions',
              });
            }
          }
        }
      }
    } catch {}

    return policies;
  }

  private extractCursor(url: string): string | undefined {
    try {
      const parsed = new URL(url, 'https://placeholder');
      return parsed.searchParams.get('cursor') || undefined;
    } catch {
      return undefined;
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'confluence',
      displayName: 'Confluence',
      description: 'Connect to Confluence Cloud/Server for space and page discovery with content sampling',
      authMethods: ['api_key', 'pat', 'oauth2'],
      requiredPermissions: [
        'read:confluence-space.summary',
        'read:confluence-content.all',
        'read:confluence-content.permission',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: false,
      },
    };
  }
}
