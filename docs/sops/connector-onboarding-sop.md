# SOP-004: Connector Onboarding

**Document ID:** SOP-PRIVACYOPS-CO-004
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Platform Engineering Lead

---

## 1. Purpose

Define the procedure for designing, implementing, testing, and deploying a new data source connector to the TechD PrivacyOps platform. Each connector must implement the `IConnector` interface, register in the `ConnectorRegistry`, declare capabilities, populate the `CAPABILITY_MATRIX` for remediation actions, and pass comprehensive validation before production rollout.

## 2. Scope

Applies to adding any new connector type to the platform, including:
- Cloud storage (AWS S3, Azure Blob, GCP Storage pattern)
- Relational databases (PostgreSQL, MySQL, MSSQL, Oracle pattern)
- SaaS applications (Salesforce, ServiceNow, Workday pattern)
- Collaboration tools (Slack, Teams, SharePoint pattern)
- Identity providers (Okta, Azure AD, PingIdentity pattern)
- Security platforms (Splunk, Sentinel, Wiz pattern)
- DevOps tools (GitHub, GitLab, Jenkins pattern)
- Generic REST API connector extensions

Currently 43 connectors registered across 3 waves. This SOP governs Wave 4+ additions.

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Connector Developer | Implements IConnector interface, writes tests |
| Platform Architect | Reviews design, approves interface compliance |
| Security Engineer | Reviews credential handling, auth flow, data exposure |
| QA Engineer | Executes integration and load testing |
| Privacy Engineer | Validates classification and DSAR integration |
| Product Manager | Approves connector scope and capability declarations |
| DevOps Engineer | Configures staging environment, production rollout |

## 4. Prerequisites

- Connector type approved in product roadmap
- API documentation for target data source available
- Test account/sandbox provisioned for target system
- Development environment with `apps/api` running locally
- Access to `apps/api/src/modules/connectors/` source directory
- Understanding of existing connector patterns (reference: `aws-s3.connector.ts`, `postgres.connector.ts`)
- Prisma schema reviewed for `DataSource` model compatibility

## 5. Procedure

### 5.1 Design & Planning

1. **Connector Specification**
   1.1. Document target system capabilities:
        - Authentication methods supported (OAuth2, API key, service account, certificate)
        - Asset discovery API endpoints
        - Content sampling feasibility and API rate limits
        - Access policy retrieval methods
        - Data deletion/modification capabilities
   1.2. Map to `ConnectorCapabilities` interface:
        ```typescript
        {
          supportsDiscovery: boolean;
          supportsContentSampling: boolean;
          supportsAccessAnalysis: boolean;
          supportsIncrementalScan: boolean;
          supportsEncryptionCheck: boolean;
        }
        ```
   1.3. Define `ConnectorMetadata`:
        - `type`: New `DataSourceType` enum value
        - `displayName`: Human-readable name
        - `description`: Connector purpose
        - `authMethods`: Supported authentication flows
        - `requiredPermissions`: Minimum permissions needed in source system
   1.4. Design review with Platform Architect (mandatory)

2. **CAPABILITY_MATRIX Entry Planning**
   2.1. Determine which of the 12 remediation action types the connector supports:

   | Action Type | Assessment Criteria |
   |------------|-------------------|
   | `revoke_access` | Can connector modify ACLs/permissions? |
   | `encrypt` | Does source system support encryption toggling? |
   | `enable_mfa` | Can connector enforce MFA on the source? |
   | `apply_retention` | Does source support retention policies? |
   | `restrict_public` | Can public access be disabled programmatically? |
   | `delete_data` | Is record/object deletion supported? |
   | `mask_data` | Does source support field-level masking? |
   | `quarantine` | Can assets be moved to isolation? |
   | `rotate_credentials` | Can connector trigger credential rotation? |
   | `restrict_sharing` | Can sharing settings be modified? |
   | `disable_public_access` | Can public URLs/endpoints be disabled? |
   | `enforce_encryption` | Can encryption be mandated? |

   2.2. Document supported actions with implementation approach
   2.3. Identify any source-specific limitations or prerequisites

### 5.2 Implementation

3. **Connector Class Implementation**
   3.1. Create file: `apps/api/src/modules/connectors/implementations/<type>.connector.ts`
   3.2. Implement `IConnector` interface methods:
        ```typescript
        export class NewConnector implements IConnector {
          async testConnection(config: ConnectorConfig): Promise<ConnectionTestResult>
          async discoverAssets(config: ConnectorConfig): Promise<DiscoveredAsset[]>
          async sampleContent(config: ConnectorConfig, assetId: string, options: SampleOptions): Promise<ContentSample[]>
          async getAccessPolicies(config: ConnectorConfig, assetId: string): Promise<AccessPolicy[]>
          async getAssetSchema(config: ConnectorConfig, assetId: string): Promise<AssetSchema>
          async disposeAsset(config: ConnectorConfig, assetId: string): Promise<void>
          getMetadata(): ConnectorMetadata
          getCapabilities(): ConnectorCapabilities
        }
        ```
   3.3. Authentication implementation:
        - Use SDK auth helpers from `connectors/sdk/auth/`
        - Store credentials encrypted using tenant `encryptionKeyId`
        - Implement credential refresh/rotation for OAuth2 flows
   3.4. Error handling:
        - Wrap all API calls in try/catch with typed errors
        - Implement retry with exponential backoff for transient failures
        - Log via NestJS `Logger` with connector-specific context

4. **Registry Registration**
   4.1. Add import to `connector-registry.ts`:
        ```typescript
        import { NewConnector } from './implementations/<type>.connector';
        ```
   4.2. Add registration in `ConnectorRegistry` constructor:
        ```typescript
        this.register('<type>', () => new NewConnector());
        ```
   4.3. Add `DataSourceType` enum value if new type

5. **CAPABILITY_MATRIX Update**
   5.1. Add entry to CAPABILITY_MATRIX for the new connector type
   5.2. Map each of the 12 action types to `true`/`false`
   5.3. Implement action handlers in connector for supported actions

6. **Prisma Schema Updates (if needed)**
   6.1. Verify `DataSource` model accommodates new connector configuration
   6.2. Add connector-specific metadata fields to schema if required
   6.3. Generate migration: `npx prisma migrate dev --name add-<type>-connector`

7. **DSAR Integration**
   7.1. Implement data subject search for the connector
   7.2. Map connector-specific identifiers to IdentityMatcherService
   7.3. Implement data export for access requests
   7.4. Implement data deletion for erasure requests (if supported)

### 5.3 Testing

8. **Unit Tests**
   8.1. Create test file: `test/modules/connectors/<type>.connector.spec.ts`
   8.2. Test coverage requirements:
        - `testConnection()`: Success and failure scenarios
        - `discoverAssets()`: Empty results, pagination, error handling
        - `sampleContent()`: All sample strategies (`first_n`, `random`, `stratified`)
        - `getAccessPolicies()`: Various principal types (user, group, role, service, public)
        - `getAssetSchema()`: Field type mapping, nullable handling
        - `disposeAsset()`: Successful disposal, not-found, permission denied
        - `getMetadata()` and `getCapabilities()`: Accurate declaration
   8.3. Mock external API calls using test fixtures
   8.4. Minimum 90% code coverage for connector class

9. **Integration Tests**
   9.1. Create integration test: `test/e2e/connectors/<type>.e2e-spec.ts`
   9.2. Test against sandbox/test instance of target system
   9.3. Verify end-to-end flow: connect -> discover -> sample -> classify -> remediate
   9.4. Test DSAR flow: subject search -> data collection -> export -> deletion
   9.5. Test remediation actions against CAPABILITY_MATRIX declarations

10. **Load Testing**
    10.1. Create k6 script: `test/load/connectors/<type>.k6.js`
    10.2. Baseline metrics:
          - Connection establishment: <2s p95
          - Asset discovery (1000 assets): <30s p95
          - Content sampling (100 records): <5s p95
          - Concurrent connections: 10 per worker
    10.3. Compare against existing connector benchmarks
    10.4. Verify no degradation to platform-wide Prometheus metrics

### 5.4 Staging Validation

11. **Staging Deployment**
    11.1. Deploy connector to staging environment via CI pipeline
    11.2. Configure test tenant with new connector type
    11.3. Execute full connector lifecycle:
          - Create data source with new connector type
          - Run initial scan via Temporal `SCAN` task queue
          - Verify assets appear in asset inventory
          - Run classification on discovered assets
          - Execute DSAR workflow against connector
          - Test each supported remediation action
    11.4. Verify Prometheus metrics emitted:
          - `privacyops_connector_scan_duration_seconds{connector_type="<type>"}`
          - `privacyops_connector_errors_total{connector_type="<type>"}`

12. **Security Review**
    12.1. Code review by Security Engineer focusing on:
          - Credential storage and handling
          - Input validation and injection prevention
          - Rate limiting compliance
          - Data exposure in logs (no PII in log messages)
          - Error message information leakage
    12.2. Verify tenant isolation in multi-tenant scenarios
    12.3. Test with restricted ABAC policies to confirm guard enforcement

### 5.5 Production Rollout

13. **Production Deployment**
    13.1. Submit change request per SOP-005 (Change Management)
    13.2. Deploy behind feature gate: `CONNECTOR_<TYPE>_ENABLED`
    13.3. Enable for pilot tenant(s) first via FeatureOverride table
    13.4. Monitor for 48 hours:
          - ConnectorHealthService status
          - Error rates in Prometheus
          - Temporal workflow success rates
          - NATS event delivery rates
    13.5. Progressively enable for all tenants
    13.6. Remove feature gate after 2-week stable period

14. **Documentation**
    14.1. Update `docs/CONNECTOR-IMPLEMENTATION-PLAN.md` with new connector entry
    14.2. Add connector to customer-facing documentation (`docs/customer-guides/`)
    14.3. Update API documentation with new data source type
    14.4. Add connector to platform dashboard connector gallery

## 6. Verification

- [ ] IConnector interface fully implemented with all methods
- [ ] ConnectorRegistry registration confirmed
- [ ] CAPABILITY_MATRIX entry accurate and tested
- [ ] Unit tests passing with >90% coverage
- [ ] Integration tests passing against sandbox
- [ ] k6 load test baselines established
- [ ] Security review completed and findings addressed
- [ ] Staging validation passed (scan, classify, DSAR, remediate)
- [ ] Feature gate deployed and pilot tenant validated
- [ ] Documentation updated
- [ ] Prometheus metrics emitting correctly

## 7. Rollback

If connector causes issues in production:
1. Disable feature gate: Set `CONNECTOR_<TYPE>_ENABLED = false` in FeatureOverride
2. Cancel active Temporal workflows for affected connector type
3. Set affected data sources to `status: 'disabled'`
4. Drain NATS events for connector-specific subjects
5. Revert deployment if connector code affects shared modules
6. Notify affected tenants via NotificationService

## 8. Frequency

- **New connector development**: Per product roadmap (typically quarterly waves)
- **Existing connector review**: Semi-annually (capability accuracy, API compatibility)
- **SDK/auth helper updates**: As upstream SDKs release breaking changes
- **CAPABILITY_MATRIX audit**: Quarterly (verify declared capabilities match actual)

## 9. References

- SOP-005: Change Management
- SOP-009: Release Management
- Architecture Doc: `docs/architecture/06-dspm-detailed-design.md`
- Source: `apps/api/src/modules/connectors/interfaces/connector.interface.ts`
- Source: `apps/api/src/modules/connectors/connector-registry.ts`
- Source: `apps/api/src/modules/remediation/remediation-agent.service.ts`
- Doc: `docs/CONNECTOR-IMPLEMENTATION-PLAN.md`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Platform Engineering | Initial version |
| | | | |
| | | | |
