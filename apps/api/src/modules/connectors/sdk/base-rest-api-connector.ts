import { Logger } from '@nestjs/common';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  ConnectorMetadata,
} from '../interfaces/connector.interface';
import { BaseConnector } from './base-connector';

export type PaginationStyle = 'offset' | 'cursor' | 'link_header' | 'odata_next';

export interface RestApiConnectorOptions {
  baseUrl: string;
  paginationStyle?: PaginationStyle;
  defaultPageSize?: number;
  authType?: 'api_key' | 'oauth2' | 'basic' | 'bearer';
}

interface PaginatedResponse<T = any> {
  data: T[];
  nextCursor?: string;
  nextUrl?: string;
  hasMore: boolean;
}

/**
 * Base class for REST API-based connectors.
 * Provides shared HTTP client, auth header injection, pagination, and error handling.
 */
export abstract class BaseRestApiConnector extends BaseConnector {
  protected readonly logger = new Logger(this.constructor.name);
  protected baseUrl: string = '';
  protected authHeaders: Record<string, string> = {};
  protected paginationStyle: PaginationStyle = 'offset';
  protected defaultPageSize: number = 100;

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    await this.setupAuth(config);
    await this.setupClient(config);
  }

  protected abstract setupAuth(config: ConnectorConfig): Promise<void>;
  protected abstract setupClient(config: ConnectorConfig): Promise<void>;

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract disconnect(): Promise<void>;
  abstract getMetadata(): ConnectorMetadata;
  abstract listAssets(): AsyncGenerator<DiscoveredAsset>;
  abstract getAssetSchema(assetExternalId: string): Promise<AssetSchema>;
  abstract sampleContent(assetExternalId: string, options: SampleOptions): AsyncGenerator<ContentSample>;

  /**
   * Make an authenticated HTTP request with retry and rate limiting.
   */
  protected async request<T = any>(
    method: string,
    path: string,
    options?: {
      body?: any;
      query?: Record<string, string | number>;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    return this.withRetry(async () => {
      const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);

      if (options?.query) {
        for (const [key, val] of Object.entries(options.query)) {
          url.searchParams.set(key, String(val));
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.authHeaders,
        ...options?.headers,
      };

      const resp = await fetch(url.toString(), {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const retryAfter = resp.headers.get('retry-after') || '';
        const retryInfo = retryAfter ? ` Retry-After: ${retryAfter}` : '';
        throw new Error(`${method} ${path} failed (${resp.status}): ${text.slice(0, 200)}${retryInfo}`);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return resp.json();
      }
      return resp.text() as any;
    }, `${method} ${path}`);
  }

  /**
   * Paginate through a REST API endpoint. Yields pages of results.
   */
  protected async *paginate<T = any>(
    path: string,
    options?: {
      query?: Record<string, string | number>;
      dataExtractor?: (response: any) => T[];
      cursorExtractor?: (response: any) => string | undefined;
      nextUrlExtractor?: (response: any) => string | undefined;
      hasMoreCheck?: (response: any) => boolean;
      pageSize?: number;
      maxPages?: number;
    },
  ): AsyncGenerator<T[]> {
    const pageSize = options?.pageSize ?? this.defaultPageSize;
    const maxPages = options?.maxPages ?? 100;
    let currentPage = 0;
    let cursor: string | undefined;
    let nextUrl: string | undefined;

    while (currentPage < maxPages) {
      const query: Record<string, string | number> = { ...options?.query };

      if (this.paginationStyle === 'offset') {
        query.offset = currentPage * pageSize;
        query.limit = pageSize;
      } else if (this.paginationStyle === 'cursor' && cursor) {
        query.cursor = cursor;
      }

      const requestPath = nextUrl || path;
      const response = await this.request('GET', requestPath, { query: nextUrl ? {} : query });

      const data = options?.dataExtractor
        ? options.dataExtractor(response)
        : Array.isArray(response) ? response : response.data || response.results || response.value || response.records || [];

      yield data;

      if (data.length === 0) break;

      // Determine if there are more pages
      if (options?.hasMoreCheck && !options.hasMoreCheck(response)) break;

      if (this.paginationStyle === 'cursor') {
        cursor = options?.cursorExtractor?.(response);
        if (!cursor) break;
      } else if (this.paginationStyle === 'odata_next') {
        nextUrl = options?.nextUrlExtractor?.(response) ?? response['@odata.nextLink'];
        if (!nextUrl) break;
      } else if (this.paginationStyle === 'link_header') {
        nextUrl = options?.nextUrlExtractor?.(response);
        if (!nextUrl) break;
      } else {
        // offset-based: if we got fewer than pageSize items, we're done
        if (data.length < pageSize) break;
      }

      currentPage++;
    }
  }

  /**
   * Setup OAuth2 client credentials auth and store the token in authHeaders.
   */
  protected async setupOAuth2ClientCredentials(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    if (scopes?.length) params.set('scope', scopes.join(' '));

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      throw new Error(`OAuth2 token request failed: ${resp.status}`);
    }

    const data = await resp.json();
    this.authHeaders = { Authorization: `Bearer ${data.access_token}` };
  }

  /**
   * Setup basic auth headers.
   */
  protected setupBasicAuth(username: string, password: string): void {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    this.authHeaders = { Authorization: `Basic ${encoded}` };
  }

  /**
   * Setup bearer token auth headers.
   */
  protected setupBearerAuth(token: string): void {
    this.authHeaders = { Authorization: `Bearer ${token}` };
  }

  /**
   * Setup API key auth headers.
   */
  protected setupApiKeyAuth(key: string, headerName = 'Authorization', prefix = 'Bearer'): void {
    this.authHeaders = { [headerName]: `${prefix} ${key}` };
  }
}
