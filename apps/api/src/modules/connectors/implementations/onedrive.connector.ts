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
 * OneDrive connector using the Microsoft Graph API.
 * Discovers files/folders in user or shared drives, samples CSV content.
 */
export class OneDriveConnector extends BaseRestApiConnector {
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
      const result = await this.request<any>('GET', '/drives', { query: { '$top': 1 } });
      return {
        success: true,
        message: 'Connected to OneDrive',
        metadata: { driveCount: result.value?.length },
      };
    } catch (error: any) {
      return { success: false, message: `OneDrive connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List all drives in the org
    for await (const page of this.paginate<any>('/drives', {
      query: { '$select': 'id,name,driveType,owner,quota' },
      dataExtractor: (r) => r.value || [],
    })) {
      for (const drive of page) {
        yield {
          externalId: `drive:${drive.id}`,
          name: drive.name,
          type: 'drive',
          path: `onedrive/${drive.name}`,
          metadata: {
            driveType: drive.driveType,
            owner: drive.owner?.user?.displayName,
            ownerEmail: drive.owner?.user?.email,
            totalBytes: drive.quota?.total,
            usedBytes: drive.quota?.used,
          },
        };

        // List root items in drive
        yield* this.listDriveItems(drive.id, 'root', `onedrive/${drive.name}`);
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    if (!assetExternalId.startsWith('item:')) return { fields: [] };

    const [driveId, itemId] = assetExternalId.replace('item:', '').split('/');

    try {
      const meta = await this.request<any>('GET', `/drives/${driveId}/items/${itemId}`, {
        query: { '$select': 'name,file' },
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
    } catch {
      // Schema not available
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    if (!assetExternalId.startsWith('item:')) return;

    const [driveId, itemId] = assetExternalId.replace('item:', '').split('/');

    try {
      const meta = await this.request<any>('GET', `/drives/${driveId}/items/${itemId}`, {
        query: { '$select': 'name,size' },
      });

      if (!meta.name?.toLowerCase().endsWith('.csv')) return;
      if (meta.size > 50 * 1024 * 1024) return; // Skip files > 50 MB

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
      this.logger.warn(`OneDrive sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    if (!assetExternalId.startsWith('item:')) return [];

    const [driveId, itemId] = assetExternalId.replace('item:', '').split('/');
    const policies: AccessPolicy[] = [];

    try {
      const perms = await this.request<any>('GET', `/drives/${driveId}/items/${itemId}/permissions`);

      for (const perm of perms.value || []) {
        const principal = perm.grantedTo?.user?.displayName
          || perm.grantedToIdentities?.[0]?.user?.displayName
          || perm.link?.scope || 'unknown';

        policies.push({
          principal,
          principalType: perm.link?.scope === 'anonymous' ? 'public' : 'user',
          permissions: perm.roles || [],
          source: 'onedrive_permissions',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching OneDrive permissions: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'onedrive',
      displayName: 'OneDrive',
      description: 'Connect to OneDrive for file discovery and data classification',
      authMethods: ['oauth2'],
      requiredPermissions: ['Files.Read.All', 'Sites.Read.All'],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: false,
      },
    };
  }

  private async *listDriveItems(
    driveId: string,
    folderId: string,
    parentPath: string,
  ): AsyncGenerator<DiscoveredAsset> {
    try {
      for await (const page of this.paginate<any>(
        `/drives/${driveId}/items/${folderId}/children`,
        {
          query: { '$select': 'id,name,size,file,folder,lastModifiedDateTime,createdBy' },
          dataExtractor: (r) => r.value || [],
          maxPages: 10,
        },
      )) {
        for (const item of page) {
          const isFolder = !!item.folder;
          const path = `${parentPath}/${item.name}`;

          yield {
            externalId: `item:${driveId}/${item.id}`,
            name: item.name,
            type: isFolder ? 'container' : 'file',
            path,
            parentExternalId: folderId === 'root' ? `drive:${driveId}` : `item:${driveId}/${folderId}`,
            metadata: {
              mimeType: item.file?.mimeType,
              owner: item.createdBy?.user?.displayName,
              lastModified: item.lastModifiedDateTime,
            },
            sizeBytes: item.size,
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(`Error listing items in drive ${driveId}: ${error.message}`);
    }
  }
}
