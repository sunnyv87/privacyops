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
 * Google Drive connector using the Google Drive REST API v3.
 * Discovers files and folders, infers schema from CSV/Sheets, samples content.
 */
export class GoogleDriveConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { accessToken, refreshToken, clientId, clientSecret, serviceAccountKey } = config.credentials;

    if (serviceAccountKey) {
      // Service account auth via JWT -> access token
      const key = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
      const token = await this.getServiceAccountToken(key);
      this.setupBearerAuth(token);
    } else if (refreshToken) {
      const token = await this.refreshAccessToken(clientId, clientSecret, refreshToken);
      this.setupBearerAuth(token);
    } else if (accessToken) {
      this.setupBearerAuth(accessToken);
    }
  }

  protected async setupClient(): Promise<void> {
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
    this.paginationStyle = 'cursor';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/about', { query: { fields: 'user,storageQuota' } });
      return {
        success: true,
        message: `Connected as ${result.user?.displayName}`,
        metadata: { email: result.user?.emailAddress },
      };
    } catch (error: any) {
      return { success: false, message: `Google Drive connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    for await (const page of this.paginate<any>('/files', {
      query: {
        fields: 'nextPageToken,files(id,name,mimeType,size,owners,createdTime,modifiedTime,parents)',
        pageSize: 100,
        q: "trashed=false",
      },
      dataExtractor: (r) => r.files || [],
      cursorExtractor: (r) => r.nextPageToken,
      maxPages: 50,
    })) {
      for (const file of page) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        yield {
          externalId: `gdrive:${file.id}`,
          name: file.name,
          type: isFolder ? 'container' : 'file',
          path: `drive/${file.name}`,
          parentExternalId: file.parents?.[0] ? `gdrive:${file.parents[0]}` : undefined,
          metadata: {
            mimeType: file.mimeType,
            owner: file.owners?.[0]?.displayName,
            ownerEmail: file.owners?.[0]?.emailAddress,
            modifiedTime: file.modifiedTime,
          },
          sizeBytes: file.size ? parseInt(file.size) : undefined,
        };
      }
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const fileId = assetExternalId.replace('gdrive:', '');

    try {
      const fileMeta = await this.request<any>('GET', `/files/${fileId}`, {
        query: { fields: 'mimeType,name' },
      });

      // For Google Sheets, use Sheets API
      if (fileMeta.mimeType === 'application/vnd.google-apps.spreadsheet') {
        return this.getSheetsSchema(fileId);
      }

      // For CSV files, download first 4KB and parse headers
      if (fileMeta.name?.toLowerCase().endsWith('.csv') || fileMeta.mimeType === 'text/csv') {
        return this.getCsvSchema(fileId);
      }
    } catch {
      // Schema inference not available
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const fileId = assetExternalId.replace('gdrive:', '');

    try {
      const fileMeta = await this.request<any>('GET', `/files/${fileId}`, {
        query: { fields: 'mimeType,name,size' },
      });

      if (fileMeta.mimeType === 'application/vnd.google-apps.spreadsheet') {
        yield* this.sampleSheets(fileId, assetExternalId, options);
        return;
      }

      if (fileMeta.name?.toLowerCase().endsWith('.csv') || fileMeta.mimeType === 'text/csv') {
        yield* this.sampleCsv(fileId, assetExternalId, options);
        return;
      }
    } catch (error: any) {
      this.logger.warn(`Google Drive sampling failed: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const fileId = assetExternalId.replace('gdrive:', '');
    const policies: AccessPolicy[] = [];

    try {
      const perms = await this.request<any>('GET', `/files/${fileId}/permissions`, {
        query: { fields: 'permissions(id,type,role,emailAddress,displayName)' },
      });

      for (const perm of perms.permissions || []) {
        policies.push({
          principal: perm.emailAddress || perm.displayName || perm.id,
          principalType: perm.type === 'anyone' ? 'public' : perm.type === 'group' ? 'group' : 'user',
          permissions: [perm.role],
          source: 'drive_permissions',
        });
      }
    } catch (error: any) {
      this.logger.warn(`Error fetching Drive permissions: ${error.message}`);
    }

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'google_drive',
      displayName: 'Google Drive',
      description: 'Connect to Google Drive for file discovery and data classification',
      authMethods: ['oauth2', 'service_account'],
      requiredPermissions: ['drive.readonly', 'drive.metadata.readonly'],
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

  private async getServiceAccountToken(key: any): Promise<string> {
    // Create JWT and exchange for access token
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(key.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    const data = await resp.json();
    return data.access_token;
  }

  private async refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    const data = await resp.json();
    return data.access_token;
  }

  private async getSheetsSchema(fileId: string): Promise<AssetSchema> {
    try {
      const resp = await this.request<any>(
        'GET',
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`,
        { query: { ranges: 'A1:ZZ1', includeGridData: 'true' } },
      );
      const sheet = resp.sheets?.[0];
      const headerRow = sheet?.data?.[0]?.rowData?.[0]?.values || [];

      return {
        fields: headerRow
          .map((cell: any, idx: number) => ({
            name: cell.formattedValue || `column_${idx}`,
            dataType: 'string',
            ordinalPosition: idx,
            nullable: true,
          }))
          .filter((f: any) => f.name),
      };
    } catch {
      return { fields: [] };
    }
  }

  private async getCsvSchema(fileId: string): Promise<AssetSchema> {
    try {
      const content = await this.request<string>(
        'GET',
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        { query: { alt: 'media' }, headers: { Range: 'bytes=0-4095' } },
      );
      const firstLine = String(content).split('\n')[0];
      if (!firstLine) return { fields: [] };

      const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
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

  private async *sampleSheets(
    fileId: string,
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    try {
      const range = `A1:ZZ${options.maxRows + 1}`;
      const resp = await this.request<any>(
        'GET',
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${range}`,
      );
      const rows = resp.values || [];
      if (rows.length < 2) return;

      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);

      const columnsToSample = headers
        .slice(0, options.maxColumns)
        .filter((h: string) => !options.excludePatterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of columnsToSample) {
        const colIdx = headers.indexOf(fieldName);
        const values = dataRows
          .map((row: any[]) => row[colIdx])
          .filter((v: any) => v != null && v !== '');

        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Sheets sampling failed: ${error.message}`);
    }
  }

  private async *sampleCsv(
    fileId: string,
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    try {
      const downloadBytes = Math.min(options.maxRows * 256, 1024 * 1024);
      const content = await this.request<string>(
        'GET',
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        { query: { alt: 'media' }, headers: { Range: `bytes=0-${downloadBytes}` } },
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
      this.logger.warn(`CSV sampling failed: ${error.message}`);
    }
  }
}
