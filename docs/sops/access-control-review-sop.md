# SOP-007: Access Control Review

**Document ID:** SOP-PRIVACYOPS-ACR-007
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Security Operations Lead

---

## 1. Purpose

Define the procedure for conducting quarterly reviews of all access control mechanisms within the TechD PrivacyOps platform. This includes RBAC role assignments, ABAC policy evaluation, the 7-layer auth guard pipeline, tenant isolation enforcement via RLS, privileged access auditing, and connector credential access patterns. The review ensures least-privilege enforcement across the multi-tenant SaaS platform.

## 2. Scope

Applies to all access control layers:
- **RBAC**: Roles (`roles` table), UserRole assignments (`user_roles` table), permission strings
- **ABAC**: Attribute-based policies in `abac.guard.ts`, dynamic attribute evaluation
- **Guard Pipeline**: All 7 layers (CSRF -> JWT -> Tenant -> Permissions -> FeatureGate -> ABAC -> Approval)
- **RLS**: PostgreSQL Row Level Security policies enforcing `tenant_id` isolation
- **API Keys**: API key lifecycle (creation, revocation, last-use tracking)
- **Connector Credentials**: Data source credentials in `data_sources.credentials`
- **Temporal Workflow Permissions**: Task queue access and workflow execution authorization
- **NATS Subject Authorization**: Event bus publish/subscribe permissions
- **AI Co-Pilot Access**: Feature gate and tenant-level co-pilot access control

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Security Operations Lead | Coordinates review cycle, produces summary report |
| Identity & Access Manager | Reviews RBAC assignments, system role definitions |
| Security Engineer | Reviews guard pipeline, ABAC policies, RLS enforcement |
| Tenant Success Manager | Validates tenant admin access appropriateness |
| Privacy Officer | Reviews access to PII-containing modules |
| Compliance Auditor | Verifies review completeness for regulatory evidence |
| Platform Architect | Reviews infrastructure-level access controls |

## 4. Prerequisites

- Read access to `users`, `roles`, `user_roles`, `tenants` tables
- Access to AuditService logs for `category: 'auth'` events
- Access to SecurityEvent records (types: `role_assigned`, `role_revoked`, `permission_changed`)
- Prisma schema documentation for RLS policy definitions
- Guard pipeline source code access (`apps/api/src/core/auth/guards/`)
- ABAC policy definition files (`apps/api/src/core/auth/policies/`)
- Previous quarter's review report for comparison

## 5. Procedure

### 5.1 RBAC Role Review

1. **System Role Inventory**
   1.1. Extract all system roles (`isSystem = true`):
        ```sql
        SELECT id, name, slug, permissions, created_at, updated_at
        FROM roles
        WHERE is_system = true
        ORDER BY name;
        ```
   1.2. Review each system role's permission set:
        - Verify permissions follow least-privilege principle
        - Check for overly broad wildcards (e.g., `*.*` or `admin.*`)
        - Confirm no deprecated permissions exist
   1.3. Document any roles requiring modification

2. **Tenant-Specific Role Review**
   2.1. Inventory custom roles per tenant:
        ```sql
        SELECT t.name as tenant_name, r.name as role_name,
               r.slug, r.permissions, r.created_at
        FROM roles r
        JOIN tenants t ON r.tenant_id = t.id
        WHERE r.is_system = false
        ORDER BY t.name, r.name;
        ```
   2.2. Flag custom roles that:
        - Duplicate system role permissions (redundant)
        - Grant broader permissions than any system role (excessive)
        - Have not been modified in >180 days (potentially stale)

3. **User-Role Assignment Review**
   3.1. Extract all active user-role mappings:
        ```sql
        SELECT u.email, u.name, u.status, r.name as role_name,
               r.permissions, ur.scope, t.name as tenant_name
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.status = 'active' AND u.deleted_at IS NULL
        ORDER BY t.name, r.name;
        ```
   3.2. Validate each assignment:
        - Does the user still need this role? (Check last login via `last_login_at`)
        - Are scoped restrictions (`ur.scope`) appropriate?
        - Flag users with multiple roles (potential privilege accumulation)
        - Flag users who have not logged in for >90 days
   3.3. Remove or downgrade inappropriate assignments

4. **Privileged Access Audit**
   4.1. Identify users with administrative permissions:
        ```sql
        SELECT u.email, u.name, r.name as role_name, r.permissions, t.name as tenant
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        JOIN tenants t ON u.tenant_id = t.id
        WHERE r.permissions::text LIKE '%admin%'
           OR r.permissions::text LIKE '%delete%'
           OR r.permissions::text LIKE '%config%'
        ORDER BY t.name;
        ```
   4.2. Verify each privileged user has:
        - MFA enabled (`mfa_enabled = true`)
        - Recent activity (last login within 30 days)
        - Documented business justification
   4.3. Review SecurityEvent audit trail for privileged actions:
        ```sql
        SELECT * FROM audit_logs
        WHERE category = 'admin'
          AND severity IN ('warning', 'critical')
          AND created_at > NOW() - INTERVAL '90 days'
        ORDER BY created_at DESC;
        ```

### 5.2 ABAC Policy Review

5. **Policy Inventory**
   5.1. Review all ABAC policy definitions in `apps/api/src/core/auth/policies/`
   5.2. For each policy, verify:
        - Attributes evaluated are current and correctly sourced
        - Policy conditions align with business requirements
        - No conflicting policies exist (one allowing what another denies)
   5.3. Test policy evaluation with representative scenarios:
        - Cross-tenant access attempt (must deny)
        - Role-based with ABAC attribute override (correct precedence)
        - Feature-gated resource access (gate respected)

6. **ABAC Attribute Source Verification**
   6.1. Verify attribute sources are authoritative and current
   6.2. Check for stale attributes that could lead to incorrect access decisions
   6.3. Review attribute caching behavior (Redis TTL alignment)

### 5.3 Guard Pipeline Review

7. **Pipeline Integrity Check**
   7.1. Verify all 7 guards are registered and ordered correctly:
        1. **CSRF Guard**: Token validation on state-changing requests
        2. **JWT Auth Guard** (`jwt-auth.guard.ts`): Token signature, expiry, claims
        3. **Tenant Guard**: `tenant_id` extraction and validation against `tenants` table
        4. **Permissions Guard** (`permissions.guard.ts`): Role-based permission check
        5. **FeatureGate Guard**: Tenant feature flag evaluation
        6. **ABAC Guard** (`abac.guard.ts`): Attribute-based policy enforcement
        7. **Approval Guard** (`approval.guard.ts`): Multi-party approval for sensitive actions
   7.2. For each guard:
        - Review rejection metrics from Prometheus: `privacyops_guard_rejection_total{guard="<name>"}`
        - Check for bypass conditions (legitimate exceptions must be documented)
        - Verify error responses do not leak internal information
   7.3. Test guard chain with:
        - Missing token (should fail at JWT guard)
        - Valid token, wrong tenant (should fail at Tenant guard)
        - Valid token/tenant, insufficient permissions (should fail at Permissions guard)
        - Feature-gated endpoint with gate disabled (should fail at FeatureGate)

8. **Rate Limiting Review**
   8.1. Review `rate-limit.guard.ts` configuration:
        - Per-tenant rate limits appropriate for subscription tier
        - Per-endpoint rate limits aligned with API design
        - Rate limit headers returned correctly
   8.2. Review rate limit violation logs for patterns:
        ```sql
        SELECT * FROM audit_logs
        WHERE action LIKE '%rate_limit%'
          AND created_at > NOW() - INTERVAL '90 days'
        ORDER BY created_at DESC LIMIT 100;
        ```

### 5.4 Tenant Isolation Review

9. **RLS Policy Verification**
   9.1. List all RLS policies:
        ```sql
        SELECT schemaname, tablename, policyname, permissive, roles, qual
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename;
        ```
   9.2. Verify every tenant-scoped table has an active RLS policy
   9.3. Test cross-tenant isolation:
        - Set `app.current_tenant` to Tenant A
        - Attempt to query Tenant B data (must return empty)
        - Verify `tenant_id` filter applied in all query plans
   9.4. Review `tenants` table status values:
        ```sql
        SELECT status, COUNT(*) FROM tenants GROUP BY status;
        ```
        - Verify `suspended` tenants cannot access platform
        - Verify `deactivated` tenants have no active sessions

10. **Connector Credential Access Review**
    10.1. Audit who can access data source credentials:
          - Only ConnectorService should decrypt credentials
          - Credential values must not appear in audit logs
          - Credential rotation history tracked
    10.2. Review `data_sources` table for:
          - Expired credentials (check `updated_at` vs. rotation policy)
          - Disabled sources still retaining credentials
          - Sources with overly broad permissions in target system

### 5.5 API Key & Service Account Review

11. **API Key Audit**
    11.1. Review all active API keys:
          - Creation date and creator
          - Last used timestamp
          - Permissions/scopes granted
    11.2. Revoke API keys that:
          - Have not been used in >90 days
          - Were created by users who are no longer active
          - Have broader permissions than needed
    11.3. Review SecurityEvent entries for `api_key_created` and `api_key_revoked`

### 5.6 Reporting

12. **Review Report**
    12.1. Compile findings into quarterly access control review report:
          - Total users reviewed, by tenant and role
          - Accounts deactivated or downgraded
          - Stale roles removed or updated
          - ABAC policies modified
          - Guard pipeline issues identified
          - RLS policy gaps addressed
          - API keys revoked
          - Privileged access exceptions documented
    12.2. Compare metrics against previous quarter
    12.3. Submit report to Compliance Auditor for regulatory evidence
    12.4. Present findings to CAB for action items

## 6. Verification

- [ ] All system and custom roles reviewed for least privilege
- [ ] All user-role assignments validated against current business need
- [ ] Privileged users verified: MFA enabled, recent activity, justified
- [ ] ABAC policies tested with representative scenarios
- [ ] Guard pipeline order and integrity verified
- [ ] RLS policies confirmed active on all tenant-scoped tables
- [ ] Cross-tenant isolation tested and confirmed
- [ ] Stale API keys revoked
- [ ] Connector credentials checked for rotation compliance
- [ ] Review report submitted to compliance

## 7. Rollback

If access control changes cause legitimate access issues:
1. Re-assign revoked roles via `user_roles` table (audit logged)
2. Restore ABAC policy from version control if policy change was incorrect
3. Re-enable deactivated API keys if revocation was premature
4. For RLS policy issues: Restore from backup and apply corrective migration
5. All rollback actions logged as SecurityEvent type `role_assigned` or `permission_changed`

## 8. Frequency

- **Full access control review**: Quarterly
- **Privileged access audit**: Monthly
- **Stale account cleanup**: Monthly (automated via `last_login_at` check)
- **API key rotation reminder**: Every 90 days
- **RLS policy verification**: Quarterly
- **Guard pipeline audit**: Semi-annually

## 9. References

- SOP-001: Incident Response (for access-related incidents)
- SOP-011: Audit Log Review (for access audit trail analysis)
- Architecture Doc: `docs/architecture/11-security-architecture.md`
- Source: `apps/api/src/core/auth/guards/*.ts`
- Source: `apps/api/src/core/auth/policies/`
- Source: `apps/api/prisma/schema.prisma` (Role, UserRole, User models)

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Security Operations Lead | Initial version |
| | | | |
| | | | |
