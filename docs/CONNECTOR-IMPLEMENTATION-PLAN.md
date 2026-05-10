# TechD PrivacyOps — Connector Implementation Plan

> **Date:** 2026-03-15
> **Scope:** Implementation plan for 33 missing connectors + 1 partial gap fix
> **Status:** Plan only — no code generation

---

## 1. Executive Summary

The PrivacyOps connector SDK is production-quality with a clean `IConnector` interface, `BaseConnector` abstract class (retry + rate limiting), factory registry, and three auth modules (API Key, OAuth2, IAM Role). Of the 9 implemented connectors, 8 are fully implemented and 1 (AWS S3) has an empty `sampleContent()`.

This plan extends the ecosystem from 9 to 43 connectors across 7 connector families, implemented in 3 waves. The architecture introduces 7 family-level base classes that sit between `BaseConnector` and individual connectors, reducing per-connector implementation to ~100–150 lines by encapsulating shared patterns (OAuth flow, REST pagination, SQL metadata queries, etc.).

**Estimated scope:**

| Wave | Connectors | New Files | Priority |
|------|-----------|-----------|----------|
| Wave 1 | 15 connectors + S3 fix | ~25 files | Critical — enables enterprise sales |
| Wave 2 | 14 connectors | ~18 files | Important — broadens coverage |
| Wave 3 | 4 connectors | ~6 files | Strategic — niche/future |
| **Total** | **34 items** | **~49 new files** | |

---

## 2. Existing Connector SDK Audit

### 2.1 SDK Structure (No Changes Needed)

| Component | File | Status |
|-----------|------|--------|
| Core interface | `connectors/interfaces/connector.interface.ts` | ⚠️ Extended — `disposeAsset?(assetExternalId, action)` added for retention disposal. Extend `DataSourceType` union for new connectors. |
| Base connector | `connectors/sdk/base-connector.ts` | ✅ Stable — no modifications needed |
| Registry | `connectors/connector-registry.ts` | ⚠️ Extend — add `register()` calls for new connectors |
| Service | `connectors/connectors.service.ts` | ✅ Stable — uses registry dynamically, no changes needed |
| Controller | `connectors/connectors.controller.ts` | ✅ Stable — no endpoint changes needed |
| Module | `connectors/connectors.module.ts` | ⚠️ Extend — add new connector providers |
| DTOs | `connectors/dto/connector.dto.ts` | ⚠️ Extend — add new enum values to `DataSourceTypeEnum` |

### 2.2 Auth Modules (Extend)

| Module | File | Status |
|--------|------|--------|
| API Key | `sdk/auth/api-key.auth.ts` | ✅ Reusable for Splunk, Elastic, HubSpot, etc. |
| IAM Role | `sdk/auth/iam-role.auth.ts` | ✅ Reusable for AWS connectors (RDS, Redshift) |
| OAuth2 (Client Credentials) | `sdk/auth/oauth2.auth.ts` | ✅ Reusable for Salesforce, ServiceNow, etc. |
| OAuth2 (Authorization Code) | **NEW** | ❌ Needed for Google Drive, OneDrive, Slack, Teams — requires refresh token flow |
| Microsoft Graph Auth | **NEW** | ❌ Needed for OneDrive, SharePoint, Teams, Azure AD — MS Graph specific |
| SCIM / OIDC Token Exchange | Not needed | — Auth handled by Keycloak on the platform side |

### 2.3 Worker / Orchestration Model

| Component | How It Consumes Connectors | Changes Needed |
|-----------|---------------------------|---------------|
| `ConnectorsService.testConnection()` | `registry.create(type)` → `connector.initialize()` → `connector.testConnection()` | None |
| `ConnectorsService.healthCheck()` | Same pattern as testConnection | None |
| `DiscoveryService.executeScan()` | Creates connector → calls `listAssets()`, `getAssetSchema()`, `sampleContent()` → stores in `Asset`/`AssetField` tables | None |
| Temporal Worker | Calls `DiscoveryService.executeScan()` as a Temporal activity | None |
| Scan Worker (NATS) | Subscribes to `scan.queued` → calls `DiscoveryService.executeScan()` | None |

**Key insight:** The orchestration layer is connector-agnostic. New connectors are automatically usable through the registry without any worker/pipeline changes.

### 2.4 Normalization Pipeline

The `IConnector` interface already defines normalized output types:
- `DiscoveredAsset` → stored in `Asset` table
- `AssetSchema` / `SchemaField` → stored in `AssetField` table
- `ContentSample` → fed to `ClassificationService`
- `AccessPolicy` → stored as part of asset metadata

New connectors must yield data in these exact shapes. No normalization layer changes needed.

### 2.5 Current Dependencies Inventory

**Already installed (no action):**
`@aws-sdk/client-s3`, `@azure/storage-blob`, `@google-cloud/storage`, `@google-cloud/bigquery`, `pg`, `mysql2`, `mssql`, `mongodb`, `snowflake-sdk`

**Missing (need installation):** See Section 11.

---

## 3. Missing Connector Inventory

### 3.1 Declared in Code — No Implementation

| # | Type Key | In `DataSourceType` | In `DataSourceTypeEnum` | In Registry | Auth Exists | Implementation |
|---|----------|--------------------|-----------------------|-------------|-------------|---------------|
| 1 | `aws_rds` | ✅ | ✅ | ❌ | ✅ (IAM) | Missing |
| 2 | `google_drive` | ✅ | ✅ | ❌ | ❌ (need OAuth2 auth code flow) | Missing |
| 3 | `onedrive` | ✅ | ✅ | ❌ | ❌ (need MS Graph) | Missing |
| 4 | `sharepoint` | ✅ | ✅ | ❌ | ❌ (need MS Graph) | Missing |
| 5 | `salesforce` | ✅ | ✅ | ❌ | ✅ (OAuth2 CC) | Missing |
| 6 | `github` | ✅ | ✅ | ❌ | ✅ (API Key) | Missing |
| 7 | `slack` | ✅ | ✅ | ❌ | ✅ (API Key/OAuth2) | Missing |
| 8 | `m365` | ✅ | ✅ | ❌ | ❌ (need MS Graph) | Missing |
| 9 | `generic_rest` | ✅ | ✅ | ❌ | ✅ (API Key/OAuth2) | Missing |

### 3.2 Not in Codebase — Need Type Declarations + Implementation

| # | Connector | Needs `DataSourceType` entry | Needs `DataSourceTypeEnum` entry |
|---|-----------|-----------------------------|---------------------------------|
| 10 | Redshift | ✅ `redshift` | ✅ `REDSHIFT` |
| 11 | Databricks | ✅ `databricks` | ✅ `DATABRICKS` |
| 12 | Oracle | ✅ `oracle` | ✅ `ORACLE` |
| 13 | Cassandra | ✅ `cassandra` | ✅ `CASSANDRA` |
| 14 | ServiceNow | ✅ `servicenow` | ✅ `SERVICENOW` |
| 15 | Okta | ✅ `okta` | ✅ `OKTA` |
| 16 | Azure AD | ✅ `azure_ad` | ✅ `AZURE_AD` |
| 17 | Teams | ✅ `teams` | ✅ `TEAMS` |
| 18 | Splunk | ✅ `splunk` | ✅ `SPLUNK` |
| 19 | Workday | ✅ `workday` | ✅ `WORKDAY` |
| 20 | HubSpot | ✅ `hubspot` | ✅ `HUBSPOT` |
| 21 | Zendesk | ✅ `zendesk` | ✅ `ZENDESK` |
| 22 | Dropbox | ✅ `dropbox` | ✅ `DROPBOX` |
| 23 | Ping Identity | ✅ `ping_identity` | ✅ `PING_IDENTITY` |
| 24 | GitLab | ✅ `gitlab` | ✅ `GITLAB` |
| 25 | Bitbucket | ✅ `bitbucket` | ✅ `BITBUCKET` |
| 26 | Jenkins | ✅ `jenkins` | ✅ `JENKINS` |
| 27 | Microsoft Sentinel | ✅ `microsoft_sentinel` | ✅ `MICROSOFT_SENTINEL` |
| 28 | Elastic Security | ✅ `elastic_security` | ✅ `ELASTIC_SECURITY` |
| 29 | Wiz | ✅ `wiz` | ✅ `WIZ` |
| 30 | Prisma Cloud | ✅ `prisma_cloud` | ✅ `PRISMA_CLOUD` |
| 31 | CrowdStrike | ✅ `crowdstrike` | ✅ `CROWDSTRIKE` |
| 32 | Palo Alto | ✅ `palo_alto` | ✅ `PALO_ALTO` |
| 33 | CircleCI | ✅ `circleci` | ✅ `CIRCLECI` |

### 3.3 Partial Gap

| Connector | Gap | Impact |
|-----------|-----|--------|
| AWS S3 | `sampleContent()` is empty generator body | Blocks classification of S3 data |
| AWS S3 | `getAssetSchema()` returns empty fields | No schema inference for structured files |
| AWS S3 | Does not extend `BaseConnector` | Misses retry/rate-limiting |

---

## 4. Connector Family Design

### Family Hierarchy

```
BaseConnector (existing — retry, rate-limit, normalize)
├── BaseSqlConnector (NEW)
│   ├── PostgresConnector (migrate to extend)
│   ├── MysqlConnector (already extends BaseConnector)
│   ├── MssqlConnector (already extends BaseConnector)
│   ├── RedshiftConnector (new — reuses pg driver)
│   ├── OracleConnector (new)
│   ├── DatabricksConnector (new)
│   └── AwsRdsConnector (new — thin wrapper over Postgres/MySQL)
│
├── BaseCloudStorageConnector (NEW)
│   ├── AwsS3Connector (migrate to extend, fix sampleContent)
│   ├── AzureBlobConnector (already extends BaseConnector)
│   ├── GcpStorageConnector (already extends BaseConnector)
│   └── DropboxConnector (new)
│
├── BaseRestApiConnector (NEW)
│   ├── BaseSaasConnector (NEW — extends BaseRestApi)
│   │   ├── SalesforceConnector (new)
│   │   ├── ServiceNowConnector (new)
│   │   ├── WorkdayConnector (new)
│   │   ├── HubSpotConnector (new)
│   │   └── ZendeskConnector (new)
│   │
│   ├── BaseIdentityConnector (NEW — extends BaseRestApi)
│   │   ├── OktaConnector (new)
│   │   ├── AzureAdConnector (new)
│   │   └── PingIdentityConnector (new)
│   │
│   ├── BaseDevOpsConnector (NEW — extends BaseRestApi)
│   │   ├── GitHubConnector (new)
│   │   ├── GitLabConnector (new)
│   │   ├── BitbucketConnector (new)
│   │   ├── JenkinsConnector (new)
│   │   └── CircleCIConnector (new)
│   │
│   ├── BaseSecurityConnector (NEW — extends BaseRestApi)
│   │   ├── SplunkConnector (new)
│   │   ├── MicrosoftSentinelConnector (new)
│   │   ├── ElasticSecurityConnector (new)
│   │   ├── WizConnector (new)
│   │   ├── PrismaCloudConnector (new)
│   │   ├── CrowdStrikeConnector (new)
│   │   └── PaloAltoConnector (new)
│   │
│   └── GenericRestConnector (new)
│
├── BaseCollaborationConnector (NEW)
│   ├── GoogleDriveConnector (new)
│   ├── OneDriveConnector (new)
│   ├── SharePointConnector (new)
│   ├── SlackConnector (new)
│   ├── TeamsConnector (new)
│   └── M365Connector (new)
│
├── MongodbConnector (existing — no family needed)
├── SnowflakeConnector (existing — unique SDK)
├── BigQueryConnector (existing — unique SDK)
└── CassandraConnector (new — unique driver)
```

### 4.1 Family Base Class Responsibilities

#### A. `BaseSqlConnector` (extends `BaseConnector`)

**Shared logic:**
- `listAssets()`: Query `information_schema.schemata` → `information_schema.tables` → yield schemas + tables/views
- `getAssetSchema()`: Query `information_schema.columns` → normalize to `SchemaField[]`
- `sampleContent()`: `SELECT ... LIMIT/TOP/FETCH FIRST` with random/sequential strategy
- `getAccessPolicies()`: Query `information_schema.table_privileges` or equivalent

**Per-connector overrides:**
- `doInitialize()`: Driver-specific connection (pg, mysql2, mssql, oracledb, etc.)
- `testConnection()`: Vendor-specific version query
- Dialect differences: `LIMIT` vs `TOP` vs `FETCH FIRST`, schema enumeration queries

#### B. `BaseCloudStorageConnector` (extends `BaseConnector`)

**Shared logic:**
- `getAssetSchema()`: Download first N bytes, detect file type (CSV/TSV/JSON/Parquet), parse headers
- `sampleContent()`: Download sample bytes, parse by content type, yield per-column samples
- File type detection: extension + content-type header heuristics
- Size-limited downloads (max 5 MB for sampling)

**Per-connector overrides:**
- `doInitialize()`: SDK-specific client creation
- `listAssets()`: Vendor-specific list API (buckets/containers/folders)
- `getAccessPolicies()`: Vendor-specific IAM/ACL queries

#### C. `BaseRestApiConnector` (extends `BaseConnector`)

**Shared logic:**
- `makeRequest(method, path, params)`: HTTP client with auth header injection, retry, rate limiting
- `paginate(path, params)`: Generic pagination handler (offset, cursor, link-header)
- `testConnection()`: `GET /` or vendor-specific health endpoint
- Auth integration: Injects `ApiKeyAuth` or `OAuth2Auth` headers automatically
- Response parsing and error handling

**Per-connector overrides:**
- Base URL, auth config, pagination style
- `listAssets()`: API-specific endpoint + response mapping
- `getAssetSchema()`: Object/entity field enumeration
- `sampleContent()`: Record sampling via API queries

#### D. `BaseSaasConnector` (extends `BaseRestApiConnector`)

**Shared logic:**
- Object discovery pattern: list objects/entities → yield as assets
- Field/metadata discovery: describe object → map to `SchemaField`
- Record sampling: query records → yield per-field samples
- Owner mapping: extract `OwnerId`, `CreatedBy`, `ModifiedBy` patterns

#### E. `BaseIdentityConnector` (extends `BaseRestApiConnector`)

**Shared logic:**
- User enumeration → yield as assets (type: `user`)
- Group enumeration → yield as assets (type: `group`)
- Role/app assignment discovery → yield as access policies
- Membership resolution: user → groups → roles
- No `sampleContent()` — identity connectors don't sample data (return empty generator)

**Documented limitation:** Identity connectors don't support `sampleContent()` or `getAssetSchema()` in the traditional sense. They yield identity objects as assets with membership/assignment as access policies.

#### F. `BaseDevOpsConnector` (extends `BaseRestApiConnector`)

**Shared logic:**
- Repository/project discovery → yield as assets
- Branch/pipeline metadata
- Owner/team mapping from repo metadata
- No deep content sampling — repos are code, not PII storage (optional: scan for secrets/config)

**Documented limitation:** Content sampling is limited to repository metadata. Deep secret scanning is a separate feature (out of scope for connector contract).

#### G. `BaseSecurityConnector` (extends `BaseRestApiConnector`)

**Shared logic:**
- Alert/finding ingestion → yield as assets (type: `alert` or `finding`)
- Asset inventory from security platform → yield as assets
- Risk score/severity normalization
- No `sampleContent()` — security platforms emit findings, not tabular data

**Documented limitation:** Security connectors ingest security findings/alerts, not tabular data. `sampleContent()` returns empty. `getAssetSchema()` returns finding schema (severity, status, resource, etc.).

---

## 5. Wave 1 Implementation Plan

**Target:** 15 new connectors + S3 fix. Estimated effort: 3–4 weeks with 2 engineers.

### 5.1 Pre-requisites (shared infrastructure)

| Task | Files to Modify/Create |
|------|----------------------|
| Add new `DataSourceType` entries | `interfaces/connector.interface.ts` |
| Add new `DataSourceTypeEnum` entries | `dto/connector.dto.ts` |
| Create `BaseRestApiConnector` | `sdk/base-rest-api-connector.ts` (NEW) |
| Create `BaseSqlConnector` | `sdk/base-sql-connector.ts` (NEW) |
| Create `BaseCloudStorageConnector` | `sdk/base-cloud-storage-connector.ts` (NEW) |
| Create `BaseCollaborationConnector` | `sdk/base-collaboration-connector.ts` (NEW) |
| Create OAuth2 auth code flow module | `sdk/auth/oauth2-authcode.auth.ts` (NEW) |
| Create Microsoft Graph auth module | `sdk/auth/msgraph.auth.ts` (NEW) |

### 5.2 Wave 1 Connectors

| # | Connector | Family Base | SDK/Package | Auth | New File |
|---|-----------|------------|-------------|------|----------|
| 1 | **S3 Fix** | BaseCloudStorageConnector | `@aws-sdk/client-s3` (existing) | IAM/AccessKey | Modify `aws-s3.connector.ts` |
| 2 | **aws_rds** | BaseSqlConnector | `pg` + `mysql2` (existing) | IAM/ConnectionString | `aws-rds.connector.ts` |
| 3 | **redshift** | BaseSqlConnector | `pg` (existing) | ConnectionString | `redshift.connector.ts` |
| 4 | **databricks** | BaseSqlConnector | `@databricks/sql` (NEW) | PAT/OAuth2 | `databricks.connector.ts` |
| 5 | **google_drive** | BaseCollaborationConnector | `googleapis` (NEW) | OAuth2 AuthCode | `google-drive.connector.ts` |
| 6 | **onedrive** | BaseCollaborationConnector | `@microsoft/microsoft-graph-client` (NEW) | MS Graph OAuth2 | `onedrive.connector.ts` |
| 7 | **sharepoint** | BaseCollaborationConnector | `@microsoft/microsoft-graph-client` (existing after #6) | MS Graph OAuth2 | `sharepoint.connector.ts` |
| 8 | **salesforce** | BaseSaasConnector | `jsforce` (NEW) | OAuth2 CC | `salesforce.connector.ts` |
| 9 | **github** | BaseDevOpsConnector | `@octokit/rest` (NEW) | PAT/OAuth2 | `github.connector.ts` |
| 10 | **slack** | BaseCollaborationConnector | `@slack/web-api` (NEW) | Bot Token | `slack.connector.ts` |
| 11 | **servicenow** | BaseSaasConnector | HTTP (built-in `fetch`) | OAuth2/BasicAuth | `servicenow.connector.ts` |
| 12 | **okta** | BaseIdentityConnector | `@okta/okta-sdk-nodejs` (NEW) | API Key | `okta.connector.ts` |
| 13 | **azure_ad** | BaseIdentityConnector | `@microsoft/microsoft-graph-client` (existing) | MS Graph OAuth2 | `azure-ad.connector.ts` |
| 14 | **teams** | BaseCollaborationConnector | `@microsoft/microsoft-graph-client` (existing) | MS Graph OAuth2 | `teams.connector.ts` |
| 15 | **splunk** | BaseSecurityConnector | HTTP (built-in `fetch`) | API Key/Token | `splunk.connector.ts` |
| 16 | **generic_rest** | BaseRestApiConnector | HTTP (built-in `fetch`) | Configurable | `generic-rest.connector.ts` |

### 5.3 Wave 1 Minimum Functional Contract

| Connector | Auth | Health | Discovery | Schema | Sampling | Access/Perms | Owner |
|-----------|------|--------|-----------|--------|----------|-------------|-------|
| S3 Fix | ✅ | ✅ | ✅ | ✅ (CSV/JSON/Parquet headers) | ✅ (NEW) | ✅ | ❌ |
| aws_rds | ✅ | ✅ | ✅ schemas/tables | ✅ columns | ✅ rows | ✅ grants | ❌ |
| redshift | ✅ | ✅ | ✅ schemas/tables | ✅ columns | ✅ rows | ✅ grants | ✅ (table owner) |
| databricks | ✅ | ✅ | ✅ catalogs/schemas/tables | ✅ columns | ✅ rows | ✅ grants | ✅ (table owner) |
| google_drive | ✅ | ✅ | ✅ files/folders | ✅ (CSV headers) | ✅ (CSV content) | ✅ sharing | ✅ (file owner) |
| onedrive | ✅ | ✅ | ✅ files/folders | ✅ (CSV headers) | ✅ (CSV content) | ✅ sharing | ✅ (file owner) |
| sharepoint | ✅ | ✅ | ✅ sites/libraries/files | ✅ (CSV/list columns) | ✅ (CSV/list rows) | ✅ sharing | ✅ (site owner) |
| salesforce | ✅ | ✅ | ✅ sObjects | ✅ describe fields | ✅ SOQL records | ✅ (profiles/perms) | ✅ (OwnerId) |
| github | ✅ | ✅ | ✅ repos/branches | ⚠️ repo metadata only | ❌ (code not sampled) | ✅ collaborators | ✅ (repo owner) |
| slack | ✅ | ✅ | ✅ channels/users | ⚠️ channel metadata | ⚠️ recent messages | ✅ channel members | ✅ (channel creator) |
| servicenow | ✅ | ✅ | ✅ tables/cmdb | ✅ table schema | ✅ record sample | ✅ ACLs | ❌ |
| okta | ✅ | ✅ | ✅ users/groups/apps | ⚠️ user profile schema | ❌ (identity, not data) | ✅ assignments | ❌ |
| azure_ad | ✅ | ✅ | ✅ users/groups/apps | ⚠️ user profile schema | ❌ (identity, not data) | ✅ memberships | ❌ |
| teams | ✅ | ✅ | ✅ teams/channels/files | ⚠️ channel metadata | ⚠️ recent messages | ✅ members | ✅ (team owner) |
| splunk | ✅ | ✅ | ✅ indexes/saved searches | ⚠️ field summary | ⚠️ search results | ✅ roles/capabilities | ❌ |
| generic_rest | ✅ | ✅ | ✅ (configurable) | ✅ (configurable) | ✅ (configurable) | ❌ | ❌ |

Legend: ✅ = full, ⚠️ = limited/adapted to connector type, ❌ = not applicable

---

## 6. Wave 2 Implementation Plan

**Target:** 14 connectors. Estimated effort: 3–4 weeks with 2 engineers.

| # | Connector | Family Base | SDK/Package | Auth |
|---|-----------|------------|-------------|------|
| 17 | **oracle** | BaseSqlConnector | `oracledb` (NEW) | ConnectionString |
| 18 | **cassandra** | BaseConnector (direct) | `cassandra-driver` (NEW) | Credentials |
| 19 | **workday** | BaseSaasConnector | HTTP fetch | OAuth2/SAML |
| 20 | **hubspot** | BaseSaasConnector | HTTP fetch | API Key/OAuth2 |
| 21 | **zendesk** | BaseSaasConnector | HTTP fetch | API Key/OAuth2 |
| 22 | **dropbox** | BaseCollaborationConnector | `dropbox` (NEW) | OAuth2 AuthCode |
| 23 | **ping_identity** | BaseIdentityConnector | HTTP fetch | OAuth2/API Key |
| 24 | **gitlab** | BaseDevOpsConnector | HTTP fetch | PAT/OAuth2 |
| 25 | **bitbucket** | BaseDevOpsConnector | HTTP fetch | App Password/OAuth2 |
| 26 | **jenkins** | BaseDevOpsConnector | HTTP fetch | API Token/BasicAuth |
| 27 | **microsoft_sentinel** | BaseSecurityConnector | `@azure/arm-securityinsight` (NEW) | MS Graph OAuth2 |
| 28 | **elastic_security** | BaseSecurityConnector | `@elastic/elasticsearch` (NEW) | API Key |
| 29 | **wiz** | BaseSecurityConnector | HTTP fetch (GraphQL) | OAuth2 CC |
| 30 | **prisma_cloud** | BaseSecurityConnector | HTTP fetch | Access Key |

### Wave 2 Minimum Functional Contract

Same structure as Wave 1. Key differences:

- **Oracle / Cassandra**: Full SQL/CQL discovery + sampling, similar to existing DB connectors.
- **Workday**: REST API with complex auth (ISU credentials). Discovery limited to worker/organization objects. Sampling limited by API rate limits (documented).
- **HubSpot / Zendesk**: Standard REST APIs. Discover contacts/tickets/deals as objects. Sample record fields.
- **GitLab / Bitbucket**: Mirror GitHub pattern (repos → assets, metadata → schema, collaborators → access).
- **Jenkins**: Discover jobs/pipelines/nodes. No content sampling (CI/CD metadata only).
- **Wiz / Prisma Cloud**: GraphQL APIs. Discover cloud assets + vulnerabilities as findings.
- **Elastic Security**: Uses Elasticsearch client. Discover indices + security rules/alerts.

---

## 7. Wave 3 Implementation Plan

**Target:** 4 connectors. Estimated effort: 1–2 weeks with 1 engineer.

| # | Connector | Family Base | SDK/Package | Auth |
|---|-----------|------------|-------------|------|
| 31 | **m365** | BaseCollaborationConnector | `@microsoft/microsoft-graph-client` (existing) | MS Graph OAuth2 |
| 32 | **crowdstrike** | BaseSecurityConnector | HTTP fetch | OAuth2 CC |
| 33 | **palo_alto** | BaseSecurityConnector | HTTP fetch | API Key |
| 34 | **circleci** | BaseDevOpsConnector | HTTP fetch | API Token |

**Notes:**
- **m365**: Umbrella connector wrapping OneDrive + SharePoint + Teams + Outlook. Delegates to individual connectors internally. Requires all Wave 1 Microsoft connectors to be complete first.
- **CrowdStrike**: Falcon API with OAuth2 CC. Discover hosts/detections/vulnerabilities.
- **Palo Alto**: Cortex XDR or XSOAR API. Discover incidents/alerts/assets.
- **CircleCI**: REST API v2. Discover projects/pipelines/workflows.

---

## 8. AWS S3 Partial Gap Fix Plan

### Current State

```typescript
// aws-s3.connector.ts — lines 115-127
async *sampleContent(assetExternalId: string, options: SampleOptions): AsyncGenerator<ContentSample> {
  // For S3, we'd download and parse files to extract content samples.
  // This is a placeholder for the sampling implementation.
  // ... (empty body, no yield statements)
}
```

Also:
- `getAssetSchema()` returns `{ fields: [] }` always
- Class implements `IConnector` directly instead of extending `BaseConnector`

### Fix Plan

1. **Migrate to extend `BaseCloudStorageConnector`** (which extends `BaseConnector`), gaining retry/rate-limiting.

2. **Implement `sampleContent()`:**
   - Accept bucket or prefix as `assetExternalId`
   - List objects in the prefix (max 50 objects)
   - Filter by supported types: `.csv`, `.tsv`, `.json`, `.jsonl`, `.parquet`, `.txt`
   - For each selected file:
     - Check file size — skip files > 50 MB
     - Download first 1 MB using `Range: bytes=0-1048575` header (`GetObjectCommand` with `Range`)
     - Detect file type from extension + Content-Type header
     - **CSV/TSV**: Parse header + data rows, yield per-column `ContentSample`
     - **JSON/JSONL**: Parse first N records, extract top-level keys, yield per-field samples
     - **Parquet**: Defer to Phase 2 (requires `parquetjs` or `@duckdb/node-bindings`)
     - **Other**: Skip (log warning)
   - Respect `options.maxRows`, `options.maxColumns`, `options.excludePatterns`
   - Yield results per-field as `ContentSample`

3. **Implement `getAssetSchema()`:**
   - Detect if asset is a specific file (has extension) vs a prefix/bucket
   - For CSV/TSV: Download first 4 KB, parse header row, return as `SchemaField[]`
   - For JSON: Download first 4 KB, parse object keys, infer types, return as `SchemaField[]`
   - For bucket/prefix: Return empty (no schema for containers)

4. **Error handling:**
   - `AccessDenied` → log + skip (don't fail entire scan)
   - Network timeout → retry via `withRetry()`
   - Corrupted/binary file → skip with warning

5. **Tests:**
   - Unit test with mocked S3 client
   - Test CSV parsing (with/without headers, various delimiters)
   - Test JSON parsing (objects, arrays, nested)
   - Test size limit enforcement
   - Test error handling (AccessDenied, timeout)

### Files Changed

| Action | File |
|--------|------|
| Modify | `implementations/aws-s3.connector.ts` — rewrite to extend `BaseCloudStorageConnector`, implement `sampleContent()` and `getAssetSchema()` |
| Create | `sdk/base-cloud-storage-connector.ts` — shared CSV/JSON parsing, size-limited download |
| Create | `test/modules/connectors/aws-s3.connector.spec.ts` — unit tests |

---

## 9. Files To Modify

| # | File | Modification |
|---|------|-------------|
| 1 | `connectors/interfaces/connector.interface.ts` | Add 25 new entries to `DataSourceType` union |
| 2 | `connectors/dto/connector.dto.ts` | Add 25 new entries to `DataSourceTypeEnum` + new `AuthMethodEnum` values |
| 3 | `connectors/connector-registry.ts` | Add `register()` calls for all new connectors |
| 4 | `connectors/connectors.module.ts` | Add new connector classes to `providers` array |
| 5 | `connectors/implementations/aws-s3.connector.ts` | Rewrite to extend `BaseCloudStorageConnector`, implement `sampleContent()` + `getAssetSchema()` |
| 6 | `test/modules/connectors/connector-registry.spec.ts` | Update expected type count from 9 to 43 |
| 7 | `apps/api/package.json` | Add new dependencies |

---

## 10. New Files Needed

### SDK / Base Classes (7 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `sdk/base-rest-api-connector.ts` | Shared HTTP client, pagination, auth injection |
| 2 | `sdk/base-sql-connector.ts` | Shared SQL metadata queries, schema enumeration |
| 3 | `sdk/base-cloud-storage-connector.ts` | Shared file parsing (CSV/JSON), size-limited download |
| 4 | `sdk/base-collaboration-connector.ts` | Shared file/folder discovery, sharing permission mapping |
| 5 | `sdk/base-identity-connector.ts` | Shared user/group/role enumeration |
| 6 | `sdk/auth/oauth2-authcode.auth.ts` | OAuth2 authorization code flow with refresh tokens |
| 7 | `sdk/auth/msgraph.auth.ts` | Microsoft Graph auth (wraps MSAL / client credentials for MS APIs) |

### Wave 1 Connector Files (14 new files)

| # | File |
|---|------|
| 8 | `implementations/aws-rds.connector.ts` |
| 9 | `implementations/redshift.connector.ts` |
| 10 | `implementations/databricks.connector.ts` |
| 11 | `implementations/google-drive.connector.ts` |
| 12 | `implementations/onedrive.connector.ts` |
| 13 | `implementations/sharepoint.connector.ts` |
| 14 | `implementations/salesforce.connector.ts` |
| 15 | `implementations/github.connector.ts` |
| 16 | `implementations/slack.connector.ts` |
| 17 | `implementations/servicenow.connector.ts` |
| 18 | `implementations/okta.connector.ts` |
| 19 | `implementations/azure-ad.connector.ts` |
| 20 | `implementations/teams.connector.ts` |
| 21 | `implementations/splunk.connector.ts` |
| 22 | `implementations/generic-rest.connector.ts` |

### Wave 2 Connector Files (14 new files)

| # | File |
|---|------|
| 23 | `implementations/oracle.connector.ts` |
| 24 | `implementations/cassandra.connector.ts` |
| 25 | `implementations/workday.connector.ts` |
| 26 | `implementations/hubspot.connector.ts` |
| 27 | `implementations/zendesk.connector.ts` |
| 28 | `implementations/dropbox.connector.ts` |
| 29 | `implementations/ping-identity.connector.ts` |
| 30 | `implementations/gitlab.connector.ts` |
| 31 | `implementations/bitbucket.connector.ts` |
| 32 | `implementations/jenkins.connector.ts` |
| 33 | `implementations/microsoft-sentinel.connector.ts` |
| 34 | `implementations/elastic-security.connector.ts` |
| 35 | `implementations/wiz.connector.ts` |
| 36 | `implementations/prisma-cloud.connector.ts` |

### Wave 3 Connector Files (4 new files)

| # | File |
|---|------|
| 37 | `implementations/m365.connector.ts` |
| 38 | `implementations/crowdstrike.connector.ts` |
| 39 | `implementations/palo-alto.connector.ts` |
| 40 | `implementations/circleci.connector.ts` |

### Test Files (per-connector + per-family)

| # | File | Covers |
|---|------|--------|
| 41 | `test/modules/connectors/base-rest-api-connector.spec.ts` | Pagination, auth injection, error handling |
| 42 | `test/modules/connectors/base-sql-connector.spec.ts` | Schema discovery, sampling |
| 43 | `test/modules/connectors/base-cloud-storage-connector.spec.ts` | CSV/JSON parsing, size limits |
| 44 | `test/modules/connectors/aws-s3.connector.spec.ts` | S3 fix tests |
| 45 | `test/modules/connectors/salesforce.connector.spec.ts` | SaaS connector pattern |
| 46 | `test/modules/connectors/github.connector.spec.ts` | DevOps connector pattern |
| 47 | `test/modules/connectors/okta.connector.spec.ts` | Identity connector pattern |
| 48 | `test/modules/connectors/splunk.connector.spec.ts` | Security connector pattern |
| 49 | `test/modules/connectors/generic-rest.connector.spec.ts` | Configurable adapter |

**Total new files: ~49** (40 source + 9 test)

---

## 11. Dependencies / Packages Missing

### Wave 1

| Package | npm Name | Version | Used By | Required? |
|---------|----------|---------|---------|-----------|
| Databricks SQL | `@databricks/sql` | ^1.0.0 | Databricks | Yes |
| Google APIs | `googleapis` | ^140.0.0 | Google Drive | Yes |
| Microsoft Graph Client | `@microsoft/microsoft-graph-client` | ^3.0.0 | OneDrive, SharePoint, Teams, Azure AD | Yes |
| MSAL Node (MS auth) | `@azure/msal-node` | ^2.0.0 | MS Graph token acquisition | Yes |
| JSForce (Salesforce) | `jsforce` | ^3.0.0 | Salesforce | Yes |
| Octokit (GitHub) | `@octokit/rest` | ^21.0.0 | GitHub | Yes |
| Slack Web API | `@slack/web-api` | ^7.0.0 | Slack | Yes |
| Okta SDK | `@okta/okta-sdk-nodejs` | ^7.0.0 | Okta | Yes |

### Wave 2

| Package | npm Name | Version | Used By | Required? |
|---------|----------|---------|---------|-----------|
| Oracle DB | `oracledb` | ^6.0.0 | Oracle | Yes |
| Cassandra Driver | `cassandra-driver` | ^4.7.0 | Cassandra | Yes |
| Dropbox SDK | `dropbox` | ^10.0.0 | Dropbox | Yes |
| Azure Security Insight | `@azure/arm-securityinsight` | ^1.0.0 | Microsoft Sentinel | Yes |
| Elasticsearch Client | `@elastic/elasticsearch` | ^8.0.0 | Elastic Security | Yes |

### Wave 3

No additional packages needed — all Wave 3 connectors use HTTP `fetch` or existing packages.

### Not Needed (use built-in `fetch`)

ServiceNow, Workday, HubSpot, Zendesk, Ping Identity, GitLab, Bitbucket, Jenkins, CircleCI, CrowdStrike, Palo Alto, Wiz, Prisma Cloud, Splunk — all have standard REST APIs that work with built-in `fetch` + existing auth modules.

---

## 12. Test Plan

### Test Strategy Per Level

| Level | Approach | Coverage Target |
|-------|----------|----------------|
| **Unit tests** (per connector) | Mock external SDK/API calls, test method contracts | Every connector |
| **Unit tests** (family base) | Test shared pagination, auth injection, schema normalization | Every family base class |
| **Integration tests** | Test with real APIs using test accounts (optional, CI/CD) | Critical connectors only (S3, PostgreSQL, Salesforce) |
| **Registry test** | Verify all connectors register and instantiate correctly | `connector-registry.spec.ts` update |

### Per-Connector Test Requirements

Every connector test must verify:

1. **Instantiation**: `new Connector()` succeeds
2. **Metadata**: `getMetadata()` returns valid `ConnectorMetadata` with correct type and capabilities
3. **Initialize**: `initialize(config)` sets up client with valid config
4. **Initialize failure**: `initialize(badConfig)` throws meaningful error
5. **Test connection**: `testConnection()` returns `{ success: true }` with mocked backend
6. **Test connection failure**: Returns `{ success: false }` on error (does not throw)
7. **List assets**: `listAssets()` yields expected `DiscoveredAsset` objects
8. **Get schema**: `getAssetSchema()` returns expected `SchemaField[]`
9. **Sample content**: `sampleContent()` yields `ContentSample` per field (where applicable)
10. **Access policies**: `getAccessPolicies()` returns `AccessPolicy[]` (where applicable)
11. **Disconnect**: `disconnect()` cleans up resources

### Registry Test Updates

```
// connector-registry.spec.ts — update expectedTypes
const expectedTypes = [
  // existing 9
  'postgresql', 'mysql', 'sqlserver', 'mongodb',
  'aws_s3', 'azure_blob', 'gcp_storage',
  'snowflake', 'bigquery',
  // Wave 1 (16 new)
  'aws_rds', 'redshift', 'databricks',
  'google_drive', 'onedrive', 'sharepoint',
  'salesforce', 'github', 'slack',
  'servicenow', 'okta', 'azure_ad',
  'teams', 'splunk', 'generic_rest',
  // Wave 2 (14 new)
  'oracle', 'cassandra', 'workday', 'hubspot', 'zendesk',
  'dropbox', 'ping_identity', 'gitlab', 'bitbucket', 'jenkins',
  'microsoft_sentinel', 'elastic_security', 'wiz', 'prisma_cloud',
  // Wave 3 (4 new)
  'm365', 'crowdstrike', 'palo_alto', 'circleci',
];
// Total: 43
```

---

## 13. Backward Compatibility Concerns

| Area | Risk | Mitigation |
|------|------|-----------|
| `DataSourceType` union expansion | Low — union types are additive | Existing code matching on specific types will still work. No `default` case removal needed. |
| `DataSourceTypeEnum` expansion | Low — enum values are additive | Frontend dropdown will show more options. No breaking changes. |
| Registry expansion | Low — existing 9 connectors unchanged | New `register()` calls are additive. `create()` for existing types returns same instances. |
| `BaseConnector` changes | None — no modifications to base class | Family base classes extend it, not modify. |
| Module providers | Low — adding providers, not removing | Existing DI resolution unchanged. |
| S3 connector rewrite | **Medium** — changing class hierarchy | `AwsS3Connector` will extend `BaseCloudStorageConnector` instead of implementing `IConnector` directly. The public API (interface methods) remains identical. Registry factory `() => new AwsS3Connector()` is unchanged. |
| Test count assertions | Low — update expected counts | `connector-registry.spec.ts` has `expect(types).toHaveLength(9)` — must update to 43. |
| Package.json additions | Low — additive | No existing dependency versions changed. |
| `connectors.module.ts` providers | Low — additive | Only 2 connectors currently listed as DI providers. Adding more won't conflict. |

---

## 14. Risks / Assumptions

### Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | **Third-party API rate limits** — Salesforce, Okta, and Google have strict rate limits | Medium | BaseRestApiConnector enforces rate limiting. Per-connector overrides for vendor-specific limits. |
| R2 | **OAuth2 auth code flow requires redirect URI** — Google Drive, OneDrive, Slack require user-facing OAuth consent | High | Platform must implement an OAuth callback endpoint. The connector SDK handles token storage/refresh. This is a platform-level feature, not just a connector concern. |
| R3 | **Oracle requires native binaries** — `oracledb` "Thick" mode needs Oracle Instant Client installed on the container | Medium | Use `oracledb` in "Thin" mode (pure JS, no native deps). Supports Oracle 12c+. |
| R4 | **Workday API complexity** — Workday uses SOAP/XML for some APIs and has complex auth (ISU) | High | Implement with REST-only endpoints (Workday REST API v1). Some functionality may be limited. Document gaps. |
| R5 | **Wiz uses GraphQL, not REST** — Wiz API is GraphQL-only | Low | `BaseSecurityConnector` already uses `makeRequest()` which can send POST with GraphQL body. Add `graphqlQuery()` helper. |
| R6 | **Parquet file parsing** — S3 fix wants Parquet support but no JS Parquet library is installed | Medium | Defer Parquet to Phase 2. Document as limitation. Focus on CSV/JSON/TSV for S3 fix. |
| R7 | **Microsoft Graph pagination** — MS Graph uses `@odata.nextLink` which differs from standard cursor/offset | Low | `BaseCollaborationConnector` implements MS Graph-specific pagination handler. |
| R8 | **Connector count bloats module providers** — 43 connector classes in providers[] array | Low | Use dynamic module registration: scan implementations directory and auto-register. Or keep manual list (manageable). |

### Assumptions

| # | Assumption | Impact if Wrong |
|---|-----------|----------------|
| A1 | All REST API connectors can use built-in `fetch` (Node 20 native) | If fetch is not available, add `node-fetch` as fallback |
| A2 | OAuth2 auth code flow tokens will be stored in the existing `connectionConfig` field (encrypted) | If separate token storage is needed, requires Prisma schema change |
| A3 | Identity connectors (Okta, Azure AD) yield users/groups as `DiscoveredAsset` type `user`/`group` | If the Asset table schema doesn't support these types, need Prisma enum extension |
| A4 | Security connectors yield findings as `DiscoveredAsset` type `finding`/`alert` | Same as A3 — may need `AssetType` extension |
| A5 | Service accounts / API keys for third-party services are provisioned by the customer | Connectors don't provision access — they use customer-provided credentials |
| A6 | The existing `ConnectorConfig.credentials: Record<string, any>` is flexible enough for all auth patterns | It is — no schema change needed |
| A7 | `oracledb` Thin mode supports required Oracle versions (12c+) for target customers | If customers use Oracle 11g, Thick mode required (native deps) |

---

## 15. Recommended Implementation Order

### Sprint-Level Breakdown

**Sprint 1 (Week 1–2): Foundation + S3 Fix + Database Connectors**
1. Create family base classes: `BaseRestApiConnector`, `BaseSqlConnector`, `BaseCloudStorageConnector`
2. Create auth modules: `oauth2-authcode.auth.ts`, `msgraph.auth.ts`
3. Fix AWS S3 `sampleContent()` and `getAssetSchema()`
4. Implement `aws_rds`, `redshift` (both reuse `pg` driver + `BaseSqlConnector`)
5. Implement `databricks` (SQL over HTTP/JDBC)
6. Update type unions, DTO enums, registry, module providers
7. Write tests for base classes + fixed S3 + new DB connectors

**Sprint 2 (Week 3–4): Collaboration + SaaS + Identity**
1. Create family base classes: `BaseCollaborationConnector`, `BaseIdentityConnector`
2. Implement `google_drive`, `onedrive`, `sharepoint`, `teams`, `slack`
3. Implement `salesforce`, `servicenow`
4. Implement `okta`, `azure_ad`
5. Implement `generic_rest`
6. Write tests

**Sprint 3 (Week 5–6): Security + DevOps + Wave 2 Start**
1. Create family base class: `BaseSecurityConnector`, `BaseDevOpsConnector`
2. Implement `github`, `splunk`
3. Start Wave 2: `oracle`, `cassandra`, `gitlab`, `bitbucket`
4. Write tests

**Sprint 4 (Week 7–8): Wave 2 Completion**
1. Implement remaining Wave 2: `workday`, `hubspot`, `zendesk`, `dropbox`
2. Implement `ping_identity`, `jenkins`
3. Implement `microsoft_sentinel`, `elastic_security`, `wiz`, `prisma_cloud`
4. Write tests

**Sprint 5 (Week 9): Wave 3 + Polish**
1. Implement `m365`, `crowdstrike`, `palo_alto`, `circleci`
2. Integration testing
3. Documentation updates
4. Final registry/test count verification

### Critical Path

```
Week 1:  Base classes + Auth modules ──────────────────►
Week 1:  S3 Fix ────────────────────────────────────────►
Week 2:  DB connectors (RDS, Redshift, Databricks) ────►
Week 3:  Collaboration (Drive, OneDrive, SharePoint) ──►
Week 3:  SaaS (Salesforce, ServiceNow) ────────────────►
Week 4:  Identity (Okta, Azure AD) + DevOps (GitHub) ──►
Week 4:  Security (Splunk) + Generic REST ─────────────►
Week 5+: Wave 2 (14 connectors) ──────────────────────►
Week 9:  Wave 3 (4 connectors) ───────────────────────►
```

### Definition of Done (per connector)

- [ ] Implements `IConnector` interface (via family base class)
- [ ] Registered in `ConnectorRegistry`
- [ ] Listed in `DataSourceType` + `DataSourceTypeEnum`
- [ ] Listed in `ConnectorsModule` providers
- [ ] Passes unit tests (mocked SDK/API)
- [ ] `getMetadata()` returns accurate capabilities
- [ ] Retry logic via `BaseConnector.withRetry()`
- [ ] Error handling: connection failures return `{ success: false }`, not thrown exceptions
- [ ] Documented third-party limitations (if any)
