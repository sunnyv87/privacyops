export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sid?: string; // session ID
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  requiresMfa?: boolean;
  mfaPendingToken?: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface SessionInfo {
  id: string;
  provider: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'session_revoked'
  | 'permission_changed'
  | 'role_assigned'
  | 'role_revoked'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'data_export'
  | 'bulk_deletion'
  | 'config_change'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'password_changed'
  | 'password_reset'
  | 'account_locked'
  | 'account_unlocked'
  | 'tenant_config_changed';

export type AuditCategory =
  | 'data_access'
  | 'auth'
  | 'admin'
  | 'security'
  | 'compliance';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AbacScope {
  departments?: string[];
  dataSourceIds?: string[];
  classifications?: string[];
}
