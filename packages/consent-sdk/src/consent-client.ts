import type {
  ConsentGrantInput,
  ConsentNotice,
  ConsentRecord,
  ConsentSdkConfig,
} from './types';

/**
 * ConsentClient — tiny fetch-based client for the PrivacyOps consent APIs.
 * Backend endpoints are untouched; this class just calls existing routes:
 *   GET  /api/v1/consent/notices/:id
 *   POST /api/v1/consent/records
 *   POST /api/v1/consent/records/:id/revoke
 */
export class ConsentClient {
  constructor(private readonly config: ConsentSdkConfig) {
    if (!config.apiBaseUrl) throw new Error('apiBaseUrl is required');
    if (!config.tenantId) throw new Error('tenantId is required');
  }

  private buildHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': this.config.tenantId,
    };
    if (this.config.apiKey) h['X-API-Key'] = this.config.apiKey;
    return h;
  }

  async getNotice(noticeId: string = this.config.noticeId): Promise<ConsentNotice> {
    const res = await fetch(
      `${this.config.apiBaseUrl.replace(/\/$/, '')}/api/v1/consent/notices/${encodeURIComponent(noticeId)}`,
      { method: 'GET', headers: this.buildHeaders(), credentials: 'omit' },
    );
    if (!res.ok) throw new Error(`getNotice failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentNotice;
  }

  async grant(input: ConsentGrantInput): Promise<ConsentRecord> {
    const res = await fetch(
      `${this.config.apiBaseUrl.replace(/\/$/, '')}/api/v1/consent/records`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          ...input,
          channel: input.channel ?? 'web',
        }),
        credentials: 'omit',
      },
    );
    if (!res.ok) throw new Error(`grant failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentRecord;
  }

  async revoke(recordId: string, reason?: string): Promise<ConsentRecord> {
    const res = await fetch(
      `${this.config.apiBaseUrl.replace(/\/$/, '')}/api/v1/consent/records/${encodeURIComponent(recordId)}/revoke`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ reason: reason ?? 'user_action' }),
        credentials: 'omit',
      },
    );
    if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
    const body = await res.json();
    return (body?.data ?? body) as ConsentRecord;
  }
}
