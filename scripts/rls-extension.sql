-- ============================================================================
-- TechD PrivacyOps — RLS Extension Migration
-- ----------------------------------------------------------------------------
-- Extends Row Level Security to tenant-scoped tables that were introduced
-- after the original security-hardening.sql was written, plus the new SaaS
-- (billing / usage / licensing / onboarding) tables added in the SaaS
-- completion patch.
--
-- Runs AFTER scripts/security-hardening.sql. Safe to re-run — every statement
-- is wrapped in an IF NOT EXISTS / IF EXISTS guard, or uses CREATE POLICY
-- which is caught and ignored if the policy already exists.
--
-- Rollout guidance: deploy behind the `RLS_EXTENDED` env flag. Verify in
-- staging that every background worker (scan-worker, event consumers,
-- schedulers) either runs inside TenantGuard or calls
-- PrismaService.withTenant(tenantId, ...) before flipping to true in prod.
-- ============================================================================

-- Helper function already created by security-hardening.sql:
--   current_tenant_id() RETURNS uuid

-- ----------------------------------------------------------------------------
-- 1. Extend RLS to post-hardening tenant-scoped tables
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  tables TEXT[] := ARRAY[
    -- Data graph / lineage / attack paths
    'data_graph_nodes', 'data_graph_edges', 'entity_risk_profiles',
    'remediation_actions', 'identity_access_mappings', 'shadow_data_alerts',
    'data_lineage_records', 'attack_paths',
    -- Compliance / retention / breach / legal holds
    'legal_holds',
    'dpia_trigger_rules', 'retention_violations', 'disposition_certificates',
    'compliance_frameworks', 'control_gaps', 'breach_detection_rules',
    -- AI governance
    'ai_systems', 'ai_dataset_usages', 'co_pilot_conversations',
    -- Predictive / threat hunting / adaptive
    'risk_predictions', 'risk_anomalies', 'remediation_plans',
    'attack_simulations', 'simulated_attack_paths', 'threat_hunts',
    'threat_indicators', 'access_baselines', 'ai_model_lineages',
    'ai_risk_assessments', 'risk_forecasts', 'graph_analytics_results',
    'compliance_advices', 'control_mappings', 'adaptive_policies',
    'policy_executions', 'incident_playbooks', 'incident_impact_analyses',
    'validation_runs', 'validation_tests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Only act if the table actually exists in this database
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      policy_name := 'tenant_isolation_' || tbl;

      -- Drop + recreate to stay idempotent
      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = policy_name
      ) THEN
        EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
      END IF;

      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (tenant_id = current_tenant_id())
           WITH CHECK (tenant_id = current_tenant_id())',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tables with NULLABLE tenant_id (service_metrics, platform_alerts,
--    optimization_recommendations, connector_health_logs) — allow NULL
--    rows to be visible to everyone but still scope non-NULL rows.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  nullable_tables TEXT[] := ARRAY[
    'service_metrics', 'connector_health_logs', 'platform_alerts',
    'optimization_recommendations'
  ];
BEGIN
  FOREACH tbl IN ARRAY nullable_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      policy_name := 'tenant_isolation_' || tbl;

      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = policy_name
      ) THEN
        EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
      END IF;

      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
           WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id())',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Workflow tasks — tenant isolation via workflowId -> workflows.tenant_id
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workflow_tasks'
  ) THEN
    EXECUTE 'ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE workflow_tasks FORCE ROW LEVEL SECURITY';

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'workflow_tasks'
        AND policyname = 'tenant_isolation_workflow_tasks'
    ) THEN
      EXECUTE 'DROP POLICY tenant_isolation_workflow_tasks ON workflow_tasks';
    END IF;

    EXECUTE
      'CREATE POLICY tenant_isolation_workflow_tasks ON workflow_tasks
         USING (tenant_id = current_tenant_id())
         WITH CHECK (tenant_id = current_tenant_id())';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3b. audit_logs and security_events — were previously missing from RLS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  security_tables TEXT[] := ARRAY['audit_logs', 'security_events'];
BEGIN
  FOREACH tbl IN ARRAY security_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      policy_name := 'tenant_isolation_' || tbl;

      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = policy_name
      ) THEN
        EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
      END IF;

      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (tenant_id = current_tenant_id() OR is_platform_admin())
           WITH CHECK (tenant_id = current_tenant_id())',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. SaaS tenant-scoped tables (billing / usage / licensing / onboarding)
--    Plan / PlanFeature / PlanLimit are intentionally NOT RLS-protected —
--    they are the public catalogue.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  saas_tables TEXT[] := ARRAY[
    'subscriptions', 'billing_accounts', 'invoices',
    'usage_events', 'usage_aggregates',
    'feature_overrides', 'onboarding_states'
  ];
BEGIN
  FOREACH tbl IN ARRAY saas_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      policy_name := 'tenant_isolation_' || tbl;

      IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = policy_name
      ) THEN
        EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
      END IF;

      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (tenant_id = current_tenant_id())
           WITH CHECK (tenant_id = current_tenant_id())',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Super-admin bypass policy — a dedicated app role that legitimately
--    needs cross-tenant access (billing webhook handlers, usage aggregator,
--    onboarding workflow). Uses a separate session variable so that regular
--    app requests cannot reach this bypass.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.platform_admin', true), 'false')::boolean;
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- The platform-admin bypass is applied to SaaS-specific tables where
-- cross-tenant writes are legitimate (billing webhooks, aggregator) AND to
-- the core tables touched during tenant provisioning (users, user_roles,
-- roles) so that `TenantService.provisionTenant` can create the initial
-- admin user without being blocked by tenant_isolation_users.
DO $$
DECLARE
  tbl TEXT;
  admin_tables TEXT[] := ARRAY[
    -- SaaS tables
    'subscriptions', 'billing_accounts', 'invoices',
    'usage_events', 'usage_aggregates',
    'feature_overrides', 'onboarding_states',
    -- Provisioning tables
    'users', 'user_roles', 'roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY admin_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Additive policy: allow rows through when the session is flagged
      -- as a platform admin. Policies are OR-combined by Postgres.
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND policyname = 'platform_admin_' || tbl
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I
             USING (is_platform_admin())
             WITH CHECK (is_platform_admin())',
          'platform_admin_' || tbl, tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Performance indexes for SaaS query hot-paths
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_metric_time
  ON usage_events (tenant_id, metric, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_occurred_at
  ON usage_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_lookup
  ON usage_aggregates (tenant_id, metric, period, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issued
  ON invoices (tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider
  ON subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
