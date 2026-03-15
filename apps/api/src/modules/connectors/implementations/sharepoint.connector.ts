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
 * SharePoint connector using Microsoft Graph API.
 * Discovers sites, document libraries, lists, and files.
 */
export class SharePointConnector extends BaseRestApiConnector {
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
      const result = await this.request<any>('GET', '/sites/root', {
        query: { '$select': 'displayName,webUrl' },
      });
      return {
        success: true,
        message: `Connected to SharePoint: ${result.displayName}`,
        metadata: { rootSite: result.webUrl },
      };
    } catch (error: any) {
      return { success: false, message: `SharePoint connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List all sites
    for await (const page of this.paginate<any>('/sites', {
      query: { '$select': 'id,displayName,webUrl,createdDateTime', search: '*' },
      dataExtractor: (r) => r.value || [],
      maxPages: 20,
    })) {
      for (const site of page) {
        yield {
          externalId: `site:${site.id}`,
          name: site.displayName,
          type: 'site',
          path: site.webUrl,
          metadata: { webUrl: site.webUrl, created: site.createdDateTime },
        };

        // List document libraries (drives) in site
        yield* this.listSiteDrives(site.id, site.displayName);

        // List SharePoint lists
        yield* this.listSiteLists(site.id, site.displayName);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    // For SharePoint lists, get column definitions
    if (assetExternalId.startsWith('list:')) {
      const [siteId, listId] = assetExternalId.replace('list:', '').split('/');
      try {
        const columns = await this.request<any>(
          'GET',
          `/sites/${siteId}/lists/${listId}/columns`,
          { query: { '$select': 'name,displayName,columnGroup,description,readOnly' } },
        );
        return {
          fields: (columns.value || [])
            .filter((c: any) => !c.readOnly && c.columnGroup !== '_Hidden')
            .map((col: any, idx: number) => ({
              name: col.name,
              dataType: 'string',
              ordinalPosition: idx,
              nullable: true,
              description: col.displayName,
            })),
        };
      } catch {
        return { fields: [] };
      }
    }

    // For files, try CSV schema
    if (assetExternalId.startsWith('file:')) {
      const [driveId, itemId] = assetExternalId.replace('file:', '').split('/');
      try {
        const meta = await this.request<any>('GET', `/drives/${driveId}/items/${itemId}`, {
          query: { '$select': 'name' },
        });
        if (meta.name?.toLowerCase().endsWith('.csv')) {
          const content = await this.request<string>(
            'GET',
            `/drives/${driveId}/items/${itemId}/content`,
            { headers: { Range: 'bytes=0-4095' } },
          );
          const firstLine = String(content).split('\n')[0];
          if (firstLine) {
            const headers = firstLine.split(',').map((h: string) => h.trim().replace(/"/g, ''));
            return {
              fields: headers.map((name, idx) => ({
                name,
                dataType: 'string',
                ordinalPosition: idx,
                nullable: true,
              })),
            };
          }
        }
      } catch {}
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    // Sample from SharePoint lists
    if (assetExternalId.startsWith('list:')) {
      yield* this.sampleList(assetExternalId, options);
      return;
    }

    // Sample from CSV files
    if (assetExternalId.startsWith('file:')) {
      yield* this.sampleFile(assetExternalId, options);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    if (!assetExternalId.startsWith('site:')) return [];

    const siteId = assetExternalId.replace('site:', '');
    const policies: AccessPolicy[] = [];

    try {
      const perms = await this.request<any>('GET', `/sites/${siteId}/permissions`);
      for (const perm of perms.value || []) {
        const identity = perm.grantedToIdentities?.[0];
        policies.push({
          principal: identity?.user?.displayName || identity?.application?.displayName || 'unknown',
          principalType: identity?.user ? 'user' : 'service',
          permissions: perm.roles || [],
          source: 'sharepoint_permissions',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching SharePoint permissions: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'sharepoint',
      displayName: 'SharePoint',
      description: 'Connect to SharePoint Online for site, library, and list discovery',
      authMethods: ['oauth2'],
      requiredPermissions: ['Sites.Read.All', 'Files.Read.All'],
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

  private async *listSiteDrives(siteId: string, siteName: string): AsyncGenerator<DiscoveredAsset> {
    try {
      const drives = await this.request<any>('GET', `/sites/${siteId}/drives`, {
        query: { '$select': 'id,name,driveType,quota' },
      });

      for (const drive of drives.value || []) {
        yield {
          externalId: `drive:${siteId}/${drive.id}`,
          name: drive.name,
          type: 'drive',
          path: `sharepoint/${siteName}/${drive.name}`,
          parentExternalId: `site:${siteId}`,
          metadata: { driveType: drive.driveType, totalBytes: drive.quota?.total },
        };

        // List files in drive root
        try {
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
              path: `sharepoint/${siteName}/${drive.name}/${item.name}`,
              parentExternalId: `drive:${siteId}/${drive.id}`,
              metadata: { mimeType: item.file?.mimeType, lastModified: item.lastModifiedDateTime },
              sizeBytes: item.size,
            };
          }
        } catch {}
      }
    } catch (error: any) {
      this.logger.warn(`Error listing drives in site ${siteId}: ${error.message}`);
    }
  }

  private async *listSiteLists(siteId: string, siteName: string): AsyncGenerator<DiscoveredAsset> {
    try {
      const lists = await this.request<any>('GET', `/sites/${siteId}/lists`, {
        query: { '$select': 'id,displayName,list,createdDateTime' },
      });

      for (const list of lists.value || []) {
        if (list.list?.hidden) continue;

        yield {
          externalId: `list:${siteId}/${list.id}`,
          name: list.displayName,
          type: 'list',
          path: `sharepoint/${siteName}/${list.displayName}`,
          parentExternalId: `site:${siteId}`,
          metadata: { template: list.list?.template, created: list.createdDateTime },
        };
      }
    } catch (error: any) {
      this.logger.warn(`Error listing lists in site ${siteId}: ${error.message}`);
    }
  }

  private async *sampleList(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [siteId, listId] = assetExternalId.replace('list:', '').split('/');
    const schema = await this.getAssetSchema(assetExternalId);
    const columns = schema.fields
      .slice(0, options.maxColumns)
      .filter(f => !options.excludePatterns.some(p => f.name.toLowerCase().includes(p.toLowerCase())));

    if (columns.length === 0) return;

    try {
      const fieldNames = columns.map(c => `fields/${c.name}`).join(',');
      const result = await this.request<any>(
        'GET',
        `/sites/${siteId}/lists/${listId}/items`,
        { query: { '$select': `id,${fieldNames}`, '$top': options.maxRows } },
      );

      for (const column of columns) {
        const values = (result.value || [])
          .map((item: any) => item.fields?.[column.name])
          .filter((v: any) => v != null);

        yield { assetExternalId, fieldName: column.name, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`SharePoint list sampling failed: ${error.message}`);
    }
  }

  private async *sampleFile(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [driveId, itemId] = assetExternalId.replace('file:', '').split('/');

    try {
      const meta = await this.request<any>('GET', `/drives/${driveId}/items/${itemId}`, {
        query: { '$select': 'name,size' },
      });

      if (!meta.name?.toLowerCase().endsWith('.csv')) return;
      if (meta.size > 50 * 1024 * 1024) return;

      const downloadBytes = Math.min(options.maxRows * 256, 1024 * 1024);
      const content = await this.request<string>(
        'GET',
        `/drives/${driveId}/items/${itemId}/content`,
        { headers: { Range: `bytes=0-${downloadBytes}` } },
      );

      const lines = String(content).split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1, options.maxRows + 1);

      const columnsToSample = headers
        .slice(0, options.maxColumns)
        .filter(h => !options.excludePatterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of columnsToSample) {
        const colIdx = headers.indexOf(fieldName);
        const values = dataLines
          .map(line => line.split(',')[colIdx]?.trim().replace(/"/g, '') ?? null)
          .filter(v => v != null && v !== '');

        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`SharePoint file sampling failed: ${error.message}`);
    }
  }
}
