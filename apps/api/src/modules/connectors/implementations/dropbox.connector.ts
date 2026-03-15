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
 * Dropbox connector using the Dropbox HTTP API v2.
 * Discovers files and folders, samples CSV content, retrieves sharing permissions.
 */
export class DropboxConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { accessToken, refreshToken, clientId, clientSecret } = config.credentials;

    if (refreshToken && clientId && clientSecret) {
      const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const data = await resp.json();
      this.setupBearerAuth(data.access_token);
    } else if (accessToken) {
      this.setupBearerAuth(accessToken);
    }
  }

  protected async setupClient(): Promise<void> {
    this.baseUrl = 'https://api.dropboxapi.com/2';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('POST', '/users/get_current_account');
      return {
        success: true,
        message: `Connected as ${result.name?.display_name}`,
        metadata: { email: result.email, accountId: result.account_id },
      };
    } catch (error: any) {
      return { success: false, message: `Dropbox connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    let cursor: string | undefined;
    let hasMore = true;

    // Initial list
    const firstResult = await this.request<any>('POST', '/files/list_folder', {
      body: { path: '', recursive: true, limit: 500 },
    });

    yield* this.yieldEntries(firstResult.entries || []);
    cursor = firstResult.cursor;
    hasMore = firstResult.has_more;

    // Continue listing
    while (hasMore && cursor) {
      const result = await this.request<any>('POST', '/files/list_folder/continue', {
        body: { cursor },
      });

      yield* this.yieldEntries(result.entries || []);
      cursor = result.cursor;
      hasMore = result.has_more;
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const path = assetExternalId.replace('dropbox:', '');
    const lower = path.toLowerCase();

    if (!lower.endsWith('.csv') && !lower.endsWith('.tsv')) {
      return { fields: [] };
    }

    try {
      const content = await this.downloadRange(path, 4096);
      if (!content) return { fields: [] };

      const delimiter = lower.endsWith('.tsv') ? '\t' : ',';
      const firstLine = content.split('\n')[0];
      if (!firstLine) return { fields: [] };

      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
      return {
        fields: headers.map((name, idx) => ({
          name,
          dataType: 'string',
          ordinalPosition: idx,
          nullable: true,
        })),
      };
    } catch {
      return { fields: [] };
    }
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const path = assetExternalId.replace('dropbox:', '');
    const lower = path.toLowerCase();

    if (!lower.endsWith('.csv') && !lower.endsWith('.tsv')) return;

    try {
      const downloadBytes = Math.min(options.maxRows * 256, 1024 * 1024);
      const content = await this.downloadRange(path, downloadBytes);
      if (!content) return;

      const delimiter = lower.endsWith('.tsv') ? '\t' : ',';
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1, options.maxRows + 1);

      const columnsToSample = headers
        .slice(0, options.maxColumns)
        .filter(h => !options.excludePatterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of columnsToSample) {
        const colIdx = headers.indexOf(fieldName);
        const values = dataLines
          .map(line => line.split(delimiter)[colIdx]?.trim().replace(/"/g, '') ?? null)
          .filter(v => v != null && v !== '');

        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Dropbox sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const path = assetExternalId.replace('dropbox:', '');
    const policies: AccessPolicy[] = [];

    try {
      const result = await this.request<any>('POST', '/sharing/list_file_members', {
        body: { file: path, limit: 100 },
      });

      for (const user of result.users || []) {
        policies.push({
          principal: user.user?.email || user.user?.display_name || 'unknown',
          principalType: 'user',
          permissions: [user.access_type?.['.tag'] || 'viewer'],
          source: 'dropbox_sharing',
        });
      }

      for (const group of result.groups || []) {
        policies.push({
          principal: group.group?.group_name || 'unknown',
          principalType: 'group',
          permissions: [group.access_type?.['.tag'] || 'viewer'],
          source: 'dropbox_sharing',
        });
      }
    } catch {
      // Sharing info may not be accessible for all files
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'dropbox',
      displayName: 'Dropbox',
      description: 'Connect to Dropbox for file discovery and data classification',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'files.metadata.read',
        'files.content.read',
        'sharing.read',
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

  // ── Private helpers ──────────────────────────────────────────

  private *yieldEntries(entries: any[]): Generator<DiscoveredAsset> {
    for (const entry of entries) {
      const isFolder = entry['.tag'] === 'folder';
      yield {
        externalId: `dropbox:${entry.path_lower || entry.id}`,
        name: entry.name,
        type: isFolder ? 'container' : 'file',
        path: `dropbox${entry.path_display || entry.path_lower}`,
        parentExternalId: entry.path_lower
          ? `dropbox:${entry.path_lower.substring(0, entry.path_lower.lastIndexOf('/')) || '/'}`
          : undefined,
        metadata: {
          contentHash: entry.content_hash,
          serverModified: entry.server_modified,
        },
        sizeBytes: entry.size,
      };
    }
  }

  private async downloadRange(path: string, bytes: number): Promise<string> {
    const resp = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'Dropbox-API-Arg': JSON.stringify({ path }),
        Range: `bytes=0-${bytes - 1}`,
      },
    });

    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    return Buffer.from(buffer).toString('utf-8');
  }
}
