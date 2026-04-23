export interface ConsentPurpose {
  id: string;
  code: string;
  name: string;
  description?: string;
  required?: boolean;
  defaultEnabled?: boolean;
}

export interface ConsentNotice {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  language: string;
  jurisdiction?: string;
  purposes: ConsentPurpose[];
  version: number;
}

/**
 * Aligned with backend RecordConsentDto:
 *   dataSubjectIdentifier (required), noticeId (required),
 *   status ('granted' | 'denied'), channel (optional), ipAddress (optional)
 */
export interface ConsentGrantInput {
  noticeId: string;
  dataSubjectIdentifier: string;
  status: 'granted' | 'denied';
  channel?: string;
  ipAddress?: string;
}

/**
 * Aligned with backend RevokeConsentDto:
 *   dataSubjectIdentifier, noticeId, reason (optional)
 */
export interface ConsentRevokeInput {
  noticeId: string;
  dataSubjectIdentifier: string;
  reason?: string;
}

export interface ConsentRecord {
  id: string;
  noticeId: string;
  status: 'granted' | 'denied' | 'revoked';
  grantedAt?: string;
  revokedAt?: string;
}

export interface ConsentSdkConfig {
  /** Base URL of the PrivacyOps API, e.g. https://api.example.com */
  apiBaseUrl: string;
  /** Tenant identifier (UUID). Used only for Swagger hints — actual tenant
   *  scope is derived server-side from the auth token. */
  tenantId: string;
  /** Notice id to fetch and render */
  noticeId: string;
  /** Bearer token for the PrivacyOps API (required for consent write ops). */
  bearerToken?: string;
  /** Optional API key for server-to-server use (mutually exclusive with bearerToken) */
  apiKey?: string;
  /** Optional CSS class root for the banner */
  className?: string;
  /** Language hint; defaults to navigator.language */
  language?: string;
  /** Callback invoked after successful consent submission */
  onSubmit?: (record: ConsentRecord) => void;
  /** Callback invoked on error */
  onError?: (err: Error) => void;
}
