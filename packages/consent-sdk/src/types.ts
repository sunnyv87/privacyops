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

export interface ConsentGrantInput {
  noticeId: string;
  subjectEmail?: string;
  externalSubjectId?: string;
  purposeCodes: string[];
  channel?: 'web' | 'mobile' | 'api';
  locale?: string;
}

export interface ConsentRecord {
  id: string;
  noticeId: string;
  status: 'granted' | 'revoked';
  purposeCodes: string[];
  grantedAt?: string;
  revokedAt?: string;
}

export interface ConsentSdkConfig {
  /** Base URL of the PrivacyOps API, e.g. https://api.example.com */
  apiBaseUrl: string;
  /** Tenant identifier (UUID) */
  tenantId: string;
  /** Notice id or code to fetch and render */
  noticeId: string;
  /** Optional API key for server-to-server use (NOT exposed in browser) */
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
