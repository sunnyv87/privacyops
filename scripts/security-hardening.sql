-- ============================================================================
-- TechD PrivacyOps — Security Hardening Migration
-- Adds Row Level Security policies, audit immutability, and DB-level controls
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Row Level Security (RLS) Policies
-- All tenant-scoped tables enforce tenant isolation at DB level
-- ============================================================================

-- Helper function to get current tenant from session config
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policy macro: enable RLS + create policy for each tenant-scoped table
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'data_sources', 'scan_jobs', 'assets', 'asset_fields',
    'classification_labels', 'classifications', 'risk_findings',
    'processing_purposes', 'consent_notices', 'data_subjects', 'consent_records',
    'dsar_requests', 'privacy_assessments', 'incidents',
    'retention_policies', 'vendors', 'vendor_assessments',
    'evidence_artifacts', 'ropa_entries', 'audit_logs',
    'ai_recommendations', 'cross_border_transfers', 'workflows',
    'approval_requests', 'api_keys', 'scim_tokens', 'audit_chain_state'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Force RLS for table owners too (important for superuser safety)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    -- Tenant isolation policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON %I
       USING (tenant_id = current_tenant_id())
       WITH CHECK (tenant_id = current_tenant_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Special policies for tables with nullable tenant_id (system records)
-- Roles: system roles have NULL tenant_id, tenant roles have tenant_id
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Regulations: system regulations have NULL tenant_id
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_regulations ON regulations
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- Controls: system controls have NULL tenant_id
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_controls ON controls
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Obligations and ObligationControls don't have tenant_id — no RLS needed
-- (accessed through regulation/control which are already RLS-protected)

-- User roles join table: access through user relation
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_roles ON user_roles
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = user_id AND u.tenant_id = current_tenant_id()
    )
  );

-- ============================================================================
-- Audit Log Immutability
-- Prevent updates and deletes on audit_logs table
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable — updates and deletes are prohibited';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER audit_log_immutable_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================================================
-- Application database role with limited privileges
-- In production, the application should connect as 'privacyops_app' not 'privacyops'
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'privacyops_app') THEN
    CREATE ROLE privacyops_app LOGIN PASSWORD 'change-in-production';
  END IF;
END $$;

-- Grant access to tables but not to drop/create
GRANT USAGE ON SCHEMA public TO privacyops_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO privacyops_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO privacyops_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO privacyops_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO privacyops_app;

-- Revoke DELETE on audit_logs for app role (belt + suspenders with trigger)
REVOKE DELETE ON audit_logs FROM privacyops_app;
REVOKE UPDATE ON audit_logs FROM privacyops_app;

-- ============================================================================
-- Indexes for security queries
-- ============================================================================

-- API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_active ON api_keys (tenant_id) WHERE revoked_at IS NULL;

-- Approval request lookups
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON approval_requests (tenant_id, status) WHERE status = 'pending';

-- SCIM token lookups
CREATE INDEX IF NOT EXISTS idx_scim_tokens_active ON scim_tokens (token_hash) WHERE is_active = true;

-- Audit log time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs (tenant_id, timestamp DESC);

-- User lockout queries
CREATE INDEX IF NOT EXISTS idx_users_locked ON users (locked_until) WHERE locked_until IS NOT NULL;
