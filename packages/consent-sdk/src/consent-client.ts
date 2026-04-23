import type {
  ConsentGrantInput,
  ConsentNotice,
  ConsentRecord,
  ConsentRevokeInput,
  ConsentSdkConfig,
} from './types';

/**
 * ConsentClient — fetch-based wrapper for the PrivacyOps consent APIs.
 *
 * Backend routes (aligned with apps/api/src/modules/consent/consent.controller.ts):
 *   GET  /api/v1/consent/notices/:id
 *   POST /api/v1/consent/records           body: RecordConsentDto
 *   POST /api/v1/consent/revoke            body: RevokeConsentDto
 *
 * Auth: consent write endpoints require an authenticated session. Supply
 * either `bearerToken` (JWT) or `apiKey` (server-to-server). The SDK does
 * NOT attempt to call write endpoints anonymously — if neither credential
 * is provided the request will 401. A future public cookie-ingest endpoint
 * may relax this.
 */
export class ConsentClient {
  constructor(private readonly config: ConsentSdkConfig) {
    if (!config.apiBaseUrl) throw new Error('apiBaseUrl is required');
    if (!config.tenantId) throw new Error('tenantId is required');
  }

  private buildHeaders(requireAuth = false): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.bearerToken) {
      h['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }
    if (this.config.apiKey) {
      h['X-API-Key'] = this.config.apiKey;
    }
    if (requireAuth && !this.config.bearerToken && !this.config.apiKey) {
      throw new Error(
        'ConsentClient: bearerToken or apiKey is required for write operations',
      );
    }
    return h;
  }

  private baseUrl(): string {
    return this.config.apiBaseUrl.replace(/\/$/, '');
  }

  async getNotice(noticeId: string = this.config.noticeId): Promise<ConsentNotice> {
    const res = await fetch(
      `${this.baseUrl()}/api/v1/consent/notices/${encodeURIComponent(noticeId)}`,
      { method: 'GET', headers: this.buildHeaders(), credentials: 'omit' },
    );
    if (!res.ok) throw new Error(`getNotice failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentNotice;
  }

  async grant(input: ConsentGrantInput): Promise<ConsentRecord> {
    const res = await fetch(
      `${this.baseUrl()}/api/v1/consent/records`,
      {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify({
          dataSubjectIdentifier: input.dataSubjectIdentifier,
          noticeId: input.noticeId,
          status: input.status,
          channel: input.channel ?? 'web',
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        }),
        credentials: 'omit',
      },
    );
    if (!res.ok) throw new Error(`grant failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentRecord;
  }

  async revoke(input: ConsentRevokeInput): Promise<ConsentRecord> {
    const res = await fetch(
      `${this.baseUrl()}/api/v1/consent/revoke`,
      {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify({
          dataSubjectIdentifier: input.dataSubjectIdentifier,
          noticeId: input.noticeId,
          ...(input.reason ? { reason: input.reason } : {}),
        }),
        credentials: 'omit',
      },
    );
    if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentRecord;
  }
}
