# TechD PrivacyOps — Connector Ecosystem Audit Report

> **Date:** 2026-03-15
> **Scope:** Complete connector inventory, capability analysis, and gap assessment
> **Auditor:** Platform Architecture Review

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| **Total connectors implemented** | 9 |
| **Fully implemented** | 8 |
| **Partially implemented** | 1 (AWS S3 — missing content sampling) |
| **Stub / placeholder** | 0 |
| **Types declared but not implemented** | 8 (in DTO/interface only) |
| **npm dependencies installed** | 9/9 (all present in package.json) |
| **Connector categories covered** | 3 of 10 target categories |
| **Overall coverage** | 9 of 47 target connectors listed in this audit (19%) |

**Key finding:** The connector framework is well-architected with a clean SDK, factory pattern, retry logic, and rate limiting. All 9 implemented connectors are **production-quality code** — not stubs. However, coverage is limited to cloud storage (3), databases (4), and data warehouses (2). High-value categories like SaaS apps, collaboration platforms, identity providers, and security platforms have **zero implementation**.

---

## 2. Connector Framework Architecture

### 2.1 SDK Location

```
apps/api/src/modules/connectors/
├── sdk/
│   ├── base-connector.ts              # Abstract base class (retry, rate limiting)
│   └── auth/
│       ├── api-key.auth.ts            # API Key / Bearer token auth
│       ├── iam-role.auth.ts           # AWS IAM STS AssumeRole auth
│       └── oauth2.auth.ts             # OAuth2 client credentials flow
├── interfaces/
│   └── connector.interface.ts         # IConnector interface + all types
├── implementations/
│   ├── aws-s3.connector.ts
│   ├── azure-blob.connector.ts
│   ├── gcp-storage.connector.ts
│   ├── postgres.connector.ts
│   ├── mysql.connector.ts
│   ├── mssql.connector.ts
│   ├── mongodb.connector.ts
│   ├── snowflake.connector.ts
│   └── bigquery.connector.ts
├── dto/
│   └── connector.dto.ts               # API DTOs + DataSourceTypeEnum
├── connector-registry.ts              # Factory pattern registry
├── connectors.service.ts              # Business logic layer
├── connectors.controller.ts           # REST API (9 endpoints)
└── connectors.module.ts               # NestJS module definition
```

### 2.2 Connector Interface (`IConnector`)

**File:** `apps/api/src/modules/connectors/interfaces/connector.interface.ts`

| Method | Return Type | Required? | Purpose |
|--------|------------|-----------|---------|
| `initialize(config)` | `Promise<void>` | Yes | Establish connection to data source |
| `testConnection()` | `Promise<ConnectionTestResult>` | Yes | Validate connectivity |
| `disconnect()` | `Promise<void>` | Yes | Clean up resources |
| `listAssets()` | `AsyncGenerator<DiscoveredAsset>` | Yes | Discover datasets, tables, buckets, etc. |
| `getAssetSchema(assetId)` | `Promise<AssetSchema>` | Yes | Retrieve column-level schema |
| `sampleContent(assetId, options)` | `AsyncGenerator<ContentSample>` | Yes | Sample data for classification |
| `getAccessPolicies(assetId)` | `Promise<AccessPolicy[]>` | Optional | Collect permission/access information |
| `getMetadata()` | `ConnectorMetadata` | Yes | Return connector capabilities and requirements |

### 2.3 Base Connector (`BaseConnector`)

**File:** `apps/api/src/modules/connectors/sdk/base-connector.ts`

Provides:
- **Retry with exponential backoff:** configurable `maxRetries` (default: 3), `backoffMs` (default: 1000), `backoffMultiplier` (default: 2)
- **Rate limiting:** `maxRequestsPerSecond` (default: 10), `burstLimit` (default: 20)
- **Schema normalization:** handles camelCase, snake_case, UPPER_CASE from different DB vendors

### 2.4 Connector Registry (Factory Pattern)

**File:** `apps/api/src/modules/connectors/connector-registry.ts`

- Registers all 9 connectors at construction time
- `create(type)` → instantiates connector by `DataSourceType`
- `getAvailableTypes()` → lists all registered types
- `getMetadata()` → returns capability metadata for all connectors

### 2.5 Authentication Modules

| Module | File | Auth Method | Status |
|--------|------|------------|--------|
| API Key | `sdk/auth/api-key.auth.ts` | Bearer token / custom header | Implemented |
| IAM Role | `sdk/auth/iam-role.auth.ts` | AWS STS AssumeRole with token caching | Implemented (env-based fallback) |
| OAuth2 | `sdk/auth/oauth2.auth.ts` | Client credentials flow with token caching | Implemented |

### 2.6 REST API Endpoints

**Controller:** `apps/api/src/modules/connectors/connectors.controller.ts`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/connectors` | `dspm:connectors:create` | Register new data source |
| GET | `/connectors` | `dspm:connectors:read` | List all connectors |
| GET | `/connectors/available` | `dspm:connectors:read` | Get available connector types |
| GET | `/connectors/health` | `dspm:connectors:read` | Health summary dashboard |
| GET | `/connectors/:id` | `dspm:connectors:read` | Get connector details |
| PUT | `/connectors/:id` | `dspm:connectors:update` | Update connector config |
| POST | `/connectors/:id/test` | `dspm:connectors:update` | Test connection |
| POST | `/connectors/:id/health` | `dspm:connectors:update` | Run health check |
| DELETE | `/connectors/:id` | `dspm:connectors:delete` | Soft delete connector |

### 2.7 Test Coverage

**Location:** `apps/api/test/modules/connectors/`

| Test Suite | File | Covers |
|-----------|------|--------|
| Registry | `connector-registry.spec.ts` | Factory pattern, type registration, error handling |
| Auth | `connector-auth.spec.ts` | OAuth2 token flow, caching, expiry |
| SDK | `connector-sdk.spec.ts` | BaseConnector retry logic, schema normalization, async generators |

---

## 3. Connector Inventory — Detailed Analysis

### 3.1 Cloud Storage Connectors

#### AWS S3 — PARTIALLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/aws-s3.connector.ts`
**Class:** `AwsS3Connector` (implements `IConnector` directly, not via `BaseConnector`)
**npm Package:** `@aws-sdk/client-s3` ^3.500.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | IAM role (default credential chain) + Access Key |
| `initialize()` | ✅ Full | Creates S3Client with region + credentials |
| `testConnection()` | ✅ Full | `ListBucketsCommand` — returns bucket count |
| `disconnect()` | ✅ Full | `client.destroy()` |
| `listAssets()` | ✅ Full | Lists buckets + top-level prefixes as assets |
| `getAssetSchema()` | ⚠️ Minimal | Returns empty `{ fields: [] }` — no CSV/Parquet parsing |
| `sampleContent()` | ❌ Empty | Generator body is empty — contains only comments describing intended logic |
| `getAccessPolicies()` | ✅ Full | Checks public access block, bucket ACLs, identifies public access risks |
| `getMetadata()` | ✅ Full | Declares all 5 capabilities as supported |

**Assessment:** 7 of 8 methods implemented. `sampleContent()` is an empty generator — the most impactful gap since it blocks classification of S3 data. Schema inference for structured files (CSV, Parquet, JSON) is also missing.

**Classification: PARTIALLY IMPLEMENTED**

---

#### Azure Blob Storage — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/azure-blob.connector.ts`
**Class:** `AzureBlobConnector` (extends `BaseConnector`)
**npm Package:** `@azure/storage-blob` ^12.25.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Connection string + Shared Key credential |
| `initialize()` | ✅ Full | `BlobServiceClient.fromConnectionString()` or SharedKey |
| `testConnection()` | ✅ Full | `getProperties()` with retry |
| `disconnect()` | ✅ Full | Nullifies HTTP client |
| `listAssets()` | ✅ Full | Lists containers + all blobs with metadata (size, content type) |
| `getAssetSchema()` | ✅ Full | Parses CSV/TSV headers from first 4 KB download |
| `sampleContent()` | ✅ Full | Downloads up to 1 MB, parses CSV/TSV rows, yields per-column samples. Falls back to raw content for non-CSV blobs. |
| `getAccessPolicies()` | ✅ Full | Checks container access level (public/private) + stored access policies |
| `getMetadata()` | ✅ Full | Declares all 5 capabilities as supported |

**Includes helper functions:** `streamToString()` for Node.js readable stream consumption, `parseBlobPath()` for URI parsing.

**Classification: FULLY IMPLEMENTED**

---

#### Google Cloud Storage — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/gcp-storage.connector.ts`
**Class:** `GcpStorageConnector` (extends `BaseConnector`)
**npm Package:** `@google-cloud/storage` ^7.14.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Service account key file, JSON credentials, or application default |
| `initialize()` | ✅ Full | Creates `Storage` client with projectId + credentials |
| `testConnection()` | ✅ Full | `getBuckets()` with retry |
| `disconnect()` | ✅ Full | Nullifies HTTP client |
| `listAssets()` | ✅ Full | Lists buckets (with location, storage class) + objects (with content type, size) |
| `getAssetSchema()` | ✅ Full | Downloads first 4 KB of CSV/TSV files, parses headers |
| `sampleContent()` | ✅ Full | Downloads up to 5 MB, parses CSV/TSV, yields per-column samples |
| `getAccessPolicies()` | ✅ Full | Retrieves IAM policy bindings, parses members into user/group/service/public |
| `getMetadata()` | ✅ Full | Declares all 5 capabilities as supported |

**Includes helper functions:** `parseGcsUri()` for `gs://` URI parsing, `parseMember()` for IAM binding member type detection.

**Classification: FULLY IMPLEMENTED**

---

### 3.2 Database Connectors

#### PostgreSQL — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/postgres.connector.ts`
**Class:** `PostgresConnector` (implements `IConnector` directly)
**npm Package:** `pg` ^8.13.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Host/port/user/password + SSL option |
| `initialize()` | ✅ Full | Creates `pg.Client`, calls `connect()` |
| `testConnection()` | ✅ Full | `SELECT version()` |
| `disconnect()` | ✅ Full | `client.end()` |
| `listAssets()` | ✅ Full | Lists schemas (excluding system schemas) + tables/views with size + row count estimates via `pg_stat_user_tables` |
| `getAssetSchema()` | ✅ Full | Queries `information_schema.columns` for column metadata |
| `sampleContent()` | ✅ Full | Selects rows with `LIMIT` or `ORDER BY RANDOM()`, yields per-column samples (max 100 values) |
| `getAccessPolicies()` | ✅ Full | Queries `information_schema.table_privileges` for grantee/privilege |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Classification: FULLY IMPLEMENTED**

---

#### MySQL — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/mysql.connector.ts`
**Class:** `MysqlConnector` (extends `BaseConnector`)
**npm Package:** `mysql2` ^3.11.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Host/port/user/password + SSL, connection pool (limit: 5) |
| `initialize()` | ✅ Full | `createPool()` with `mysql2/promise` |
| `testConnection()` | ✅ Full | `SELECT VERSION()` with retry |
| `disconnect()` | ✅ Full | `pool.end()` |
| `listAssets()` | ✅ Full | `SHOW DATABASES` + `information_schema.TABLES` (TABLE_NAME, TABLE_TYPE, TABLE_ROWS, DATA_LENGTH) |
| `getAssetSchema()` | ✅ Full | `information_schema.COLUMNS` |
| `sampleContent()` | ✅ Full | `SELECT ... LIMIT` or `ORDER BY RAND()`, per-column samples |
| `getAccessPolicies()` | ✅ Full | `SHOW GRANTS` for current user |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Classification: FULLY IMPLEMENTED**

---

#### SQL Server (MSSQL) — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/mssql.connector.ts`
**Class:** `MssqlConnector` (extends `BaseConnector`)
**npm Package:** `mssql` ^11.0.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | SQL auth (user/password), encrypt option, TLS config |
| `initialize()` | ✅ Full | `ConnectionPool` with `connect()` |
| `testConnection()` | ✅ Full | `SELECT @@VERSION` with retry |
| `disconnect()` | ✅ Full | `pool.close()` |
| `listAssets()` | ✅ Full | `INFORMATION_SCHEMA.SCHEMATA` + tables with size/row estimates via `sys.partitions` + `sys.allocation_units` |
| `getAssetSchema()` | ✅ Full | `INFORMATION_SCHEMA.COLUMNS` with parameterized queries |
| `sampleContent()` | ✅ Full | `SELECT TOP (N)` or `ORDER BY NEWID()`, per-column samples |
| `getAccessPolicies()` | ✅ Full | Queries `sys.database_permissions` + `sys.database_principals` + `sys.objects` with proper joins |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Classification: FULLY IMPLEMENTED**

---

#### MongoDB — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/mongodb.connector.ts`
**Class:** `MongodbConnector` (extends `BaseConnector`)
**npm Package:** `mongodb` ^6.10.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Connection string or host/port/user/password with authSource |
| `initialize()` | ✅ Full | `MongoClient` with pool (maxPoolSize: 5), `connect()` with retry |
| `testConnection()` | ✅ Full | `db.command({ ping: 1 })` + `buildInfo` for version |
| `disconnect()` | ✅ Full | `client.close()` |
| `listAssets()` | ✅ Full | `listCollections()` + `estimatedDocumentCount()` + `collStats` for size |
| `getAssetSchema()` | ✅ Full | `findOne()` to infer schema from sample document, `inferMongoType()` helper |
| `sampleContent()` | ✅ Full | `$sample` aggregation for random, `find().limit()` for first_n, per-field samples |
| `getAccessPolicies()` | ✅ Full | `usersInfo` command to list users and roles |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Classification: FULLY IMPLEMENTED**

---

### 3.3 Data Warehouse Connectors

#### Snowflake — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/snowflake.connector.ts`
**Class:** `SnowflakeConnector` (extends `BaseConnector`)
**npm Package:** `snowflake-sdk` ^1.14.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Account/username/password/warehouse/database/schema/role |
| `initialize()` | ✅ Full | `snowflake.createConnection()` + `connect()` with retry |
| `testConnection()` | ✅ Full | `SELECT CURRENT_VERSION()` |
| `disconnect()` | ✅ Full | `connection.destroy()` |
| `listAssets()` | ✅ Full | `SHOW SCHEMAS` + `SHOW TABLES` + `SHOW VIEWS` per schema (with owner, bytes, rows) |
| `getAssetSchema()` | ✅ Full | `DESCRIBE TABLE` for column metadata |
| `sampleContent()` | ✅ Full | `SELECT ... SAMPLE (N ROWS)` for random, `LIMIT` for first_n |
| `getAccessPolicies()` | ✅ Full | `SHOW GRANTS ON TABLE` for grantee/privilege |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Includes private helper:** `executeQuery()` wraps callback-based Snowflake SDK into Promise.

**Classification: FULLY IMPLEMENTED**

---

#### Google BigQuery — FULLY IMPLEMENTED

**File:** `apps/api/src/modules/connectors/implementations/bigquery.connector.ts`
**Class:** `BigQueryConnector` (extends `BaseConnector`)
**npm Package:** `@google-cloud/bigquery` ^7.9.0 ✓ installed

| Capability | Status | Implementation Detail |
|-----------|--------|----------------------|
| Authentication | ✅ Full | Service account key file, JSON credentials, or application default |
| `initialize()` | ✅ Full | `new BigQuery({ projectId, credentials })` |
| `testConnection()` | ✅ Full | `getDatasets({ maxResults: 1 })` with retry |
| `disconnect()` | ✅ Full | Nullifies client |
| `listAssets()` | ✅ Full | Lists datasets + tables per dataset (with type, creation time, row count, size) |
| `getAssetSchema()` | ✅ Full | `table.getMetadata()` for schema fields + numRows/numBytes |
| `sampleContent()` | ✅ Full | `ORDER BY RAND() LIMIT N` via BigQuery SQL, per-column samples |
| `getAccessPolicies()` | ✅ Full | `dataset.getMetadata()` for access entries (userByEmail, groupByEmail, specialGroup) |
| `getMetadata()` | ✅ Full | Discovery + sampling + access analysis |

**Classification: FULLY IMPLEMENTED**

---

## 4. Implementation Status Summary

### 4.1 Classification Matrix

| # | Connector | Category | Status | Auth | Discovery | Schema | Sampling | Access Policies | File |
|---|-----------|----------|--------|------|-----------|--------|----------|----------------|------|
| 1 | AWS S3 | Cloud Storage | **PARTIAL** | ✅ | ✅ | ⚠️ | ❌ | ✅ | `implementations/aws-s3.connector.ts` |
| 2 | Azure Blob Storage | Cloud Storage | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/azure-blob.connector.ts` |
| 3 | Google Cloud Storage | Cloud Storage | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/gcp-storage.connector.ts` |
| 4 | PostgreSQL | Database | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/postgres.connector.ts` |
| 5 | MySQL | Database | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/mysql.connector.ts` |
| 6 | SQL Server | Database | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/mssql.connector.ts` |
| 7 | MongoDB | Database | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/mongodb.connector.ts` |
| 8 | Snowflake | Data Warehouse | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/snowflake.connector.ts` |
| 9 | BigQuery | Data Warehouse | **FULL** | ✅ | ✅ | ✅ | ✅ | ✅ | `implementations/bigquery.connector.ts` |

### 4.2 Counts

| Status | Count | Connectors |
|--------|-------|------------|
| **Fully Implemented** | 8 | Azure Blob, GCS, PostgreSQL, MySQL, SQL Server, MongoDB, Snowflake, BigQuery |
| **Partially Implemented** | 1 | AWS S3 (missing content sampling + schema inference) |
| **Stub / Placeholder** | 0 | — |
| **Not Implemented** | 38 | See Section 6 |

---

## 5. Technology Mapping

| # | Connector | Data Source Type | API Method | Auth Method | SDK/Driver | Declared Capabilities |
|---|-----------|----------------|-----------|-------------|-----------|----------------------|
| 1 | AWS S3 | Object Storage | AWS SDK v3 (REST) | IAM Role, Access Key | `@aws-sdk/client-s3` | Discovery ✓, Sampling ✓*, Access ✓, Incremental ✓, Encryption ✓ |
| 2 | Azure Blob | Object Storage | Azure REST SDK | Connection String, Shared Key | `@azure/storage-blob` | Discovery ✓, Sampling ✓, Access ✓, Incremental ✓, Encryption ✓ |
| 3 | GCS | Object Storage | Google REST SDK | Service Account, ADC | `@google-cloud/storage` | Discovery ✓, Sampling ✓, Access ✓, Incremental ✓, Encryption ✓ |
| 4 | PostgreSQL | Relational DB | SQL (pg wire protocol) | Connection String | `pg` | Discovery ✓, Sampling ✓, Access ✓ |
| 5 | MySQL | Relational DB | SQL (MySQL protocol) | Connection String | `mysql2` | Discovery ✓, Sampling ✓, Access ✓ |
| 6 | SQL Server | Relational DB | SQL (TDS protocol) | SQL Auth | `mssql` | Discovery ✓, Sampling ✓, Access ✓ |
| 7 | MongoDB | Document DB | MongoDB Wire Protocol | Connection String, Credentials | `mongodb` | Discovery ✓, Sampling ✓, Access ✓ |
| 8 | Snowflake | Data Warehouse | SQL (Snowflake protocol) | Username/Password | `snowflake-sdk` | Discovery ✓, Sampling ✓, Access ✓ |
| 9 | BigQuery | Data Warehouse | Google REST SDK | Service Account, ADC | `@google-cloud/bigquery` | Discovery ✓, Sampling ✓, Access ✓ |

> *S3 declares `supportsContentSampling: true` in metadata but `sampleContent()` is an empty generator.

---

## 6. Missing Connectors — Gap Analysis

### 6.1 Types Declared in DTO but Not Implemented

The `DataSourceTypeEnum` and `DataSourceType` type union declare these additional types with **no connector implementation:**

| Type Key | Category | Priority | Rationale |
|----------|----------|----------|-----------|
| `aws_rds` | Database | Low | RDS is accessed via PostgreSQL/MySQL connectors — separate connector unnecessary |
| `google_drive` | Collaboration | **High** | Common SaaS data source with PII exposure |
| `onedrive` | Collaboration | **High** | Enterprise M365 data source |
| `sharepoint` | Collaboration | **High** | Enterprise document management — PII hotspot |
| `salesforce` | SaaS Business App | **High** | Major CRM with customer PII |
| `github` | DevOps | Medium | Code repositories may contain secrets/PII |
| `slack` | Collaboration | Medium | Chat data with PII/compliance risk |
| `m365` | Collaboration | **High** | Umbrella for Microsoft 365 services |
| `generic_rest` | Generic | Low | Catch-all for REST API data sources |

### 6.2 High-Value Connectors Not in Codebase

These connectors are commonly expected in enterprise DSPM/privacy platforms:

| Category | Connector | Priority | Notes |
|----------|-----------|----------|-------|
| **Data Warehouse** | Amazon Redshift | High | Major AWS data warehouse; similar SQL interface to PostgreSQL |
| **Data Warehouse** | Databricks / Delta Lake | High | Lakehouse pattern; increasingly common in enterprise |
| **SaaS Business** | Salesforce | **Critical** | #1 CRM; massive PII repository |
| **SaaS Business** | ServiceNow | High | IT service management with employee/customer data |
| **SaaS Business** | Workday | High | HR/people data — highest sensitivity |
| **SaaS Business** | HubSpot | Medium | Marketing CRM with contact PII |
| **Collaboration** | Google Workspace (Drive) | **Critical** | Unstructured data; PII in documents |
| **Collaboration** | Microsoft 365 (OneDrive/SharePoint) | **Critical** | Enterprise document stores with PII |
| **Collaboration** | Slack | Medium | Chat messages with PII/compliance risk |
| **Collaboration** | Microsoft Teams | Medium | Enterprise chat/files |
| **Collaboration** | Dropbox | Low | File sharing with potential PII |
| **Identity Provider** | Okta | High | Identity-to-data access mapping |
| **Identity Provider** | Azure AD / Entra ID | High | Enterprise identity provider |
| **Identity Provider** | Ping Identity | Low | Less common; niche enterprise |
| **Database** | Oracle | Medium | Enterprise legacy databases |
| **Database** | Cassandra | Low | NoSQL; less common for PII |
| **DevOps** | GitHub | Medium | Code/config scanning for secrets |
| **DevOps** | GitLab | Low | Similar to GitHub |
| **Security** | CrowdStrike | Low | Security telemetry, not PII storage |
| **Security** | Splunk | Medium | Log data may contain PII |
| **Security** | Wiz / Prisma Cloud | Low | CSPM integration, not data scanning |
| **Cloud Platform** | AWS (IAM/Config) | Medium | Identity-to-data access mapping |
| **Cloud Platform** | Azure (ARM/Entra) | Medium | Identity-to-data access mapping |
| **Cloud Platform** | GCP (IAM/Resource Manager) | Low | Identity-to-data access mapping |

---

## 7. Connector Capability Heatmap

| Capability | S3 | Azure Blob | GCS | PostgreSQL | MySQL | MSSQL | MongoDB | Snowflake | BigQuery |
|-----------|-----|-----------|-----|-----------|-------|-------|---------|-----------|---------|
| **Authentication** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Asset Discovery** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Schema/Metadata** | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Content Sampling** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Access/Permission** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Owner Mapping** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅* | ❌ |
| **Event Ingestion** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Incremental Scan** | ✅† | ✅† | ✅† | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Encryption Check** | ✅† | ✅† | ✅† | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

- ✅* Snowflake `listAssets()` includes `owner` in metadata from `SHOW TABLES/VIEWS` output.
- ✅† Declared in metadata but actual incremental/encryption logic not visible in the implementation — likely deferred.
- **Owner Mapping:** No connector systematically maps data asset owners. The `AccessPolicy` interface captures `principal` + `principalType` but doesn't resolve to organization-level owner identity.
- **Event Ingestion:** No connector supports real-time change detection or event streaming from data sources.

---

## 8. Category Coverage Analysis

| # | Category | Target Connectors | Implemented | Coverage |
|---|----------|------------------|-------------|---------|
| 1 | **Cloud Storage** | S3, Azure Blob, GCS | 3 | **100%** |
| 2 | **Databases** | PostgreSQL, MySQL, MSSQL, MongoDB, Oracle, Cassandra | 4 of 6 | **67%** |
| 3 | **Data Warehouses** | Snowflake, BigQuery, Redshift, Databricks | 2 of 4 | **50%** |
| 4 | **SaaS Business Apps** | Salesforce, ServiceNow, Workday, HubSpot, Zendesk | 0 of 5 | **0%** |
| 5 | **Collaboration** | Google Drive, OneDrive, SharePoint, Slack, Teams, Dropbox | 0 of 6 | **0%** |
| 6 | **Identity Providers** | Okta, Azure AD, Ping Identity | 0 of 3 | **0%** |
| 7 | **DevOps Platforms** | GitHub, GitLab, Bitbucket, Jenkins, CircleCI | 0 of 5 | **0%** |
| 8 | **Security Platforms** | CrowdStrike, Palo Alto, Sentinel, Splunk, Elastic, Wiz, Prisma | 0 of 7 | **0%** |
| 9 | **Cloud Platforms (IAM)** | AWS IAM, Azure AD/ARM, GCP IAM | 0 of 3 | **0%** |
| 10 | **Generic** | REST API | 0 of 1 | **0%** |
| | **Total** | **47** | **9** | **19%** |

---

## 9. Recommended Next Connectors to Implement

### Priority Tier 1 — Critical (implement before enterprise sales)

| # | Connector | Category | Rationale | Complexity | Auth Method |
|---|-----------|----------|-----------|-----------|-------------|
| 1 | **AWS S3 sampling fix** | Cloud Storage | S3 is the #1 data source. Empty `sampleContent()` blocks classification entirely. | Low | Already done |
| 2 | **Salesforce** | SaaS Business | #1 CRM; every enterprise has it; massive PII | High | OAuth2 (already in SDK) |
| 3 | **Google Drive** | Collaboration | Unstructured PII in documents; common ask from customers | Medium | OAuth2 + service account |
| 4 | **OneDrive / SharePoint** | Collaboration | Microsoft 365 is ubiquitous in enterprise; PII in documents | High | OAuth2 (Microsoft Graph API) |

### Priority Tier 2 — High (implement for growth phase)

| # | Connector | Category | Rationale | Complexity | Auth Method |
|---|-----------|----------|-----------|-----------|-------------|
| 5 | **Amazon Redshift** | Data Warehouse | Second most popular cloud DWH; PostgreSQL-compatible driver | Low | Connection string (pg driver) |
| 6 | **Okta** | Identity | Maps identities to data access; critical for DSPM identity intelligence | Medium | API key / OAuth2 |
| 7 | **Azure AD / Entra ID** | Identity | Enterprise identity → access mapping | Medium | OAuth2 (Microsoft Graph) |
| 8 | **Databricks** | Data Warehouse | Growing lakehouse adoption; Delta Lake scanning | Medium | PAT / OAuth2 |
| 9 | **Slack** | Collaboration | Chat data with PII/compliance exposure | Medium | OAuth2 (Slack API) |

### Priority Tier 3 — Medium (implement for enterprise scale)

| # | Connector | Category | Rationale | Complexity | Auth Method |
|---|-----------|----------|-----------|-----------|-------------|
| 10 | **Oracle** | Database | Legacy enterprise; still dominant in finance/healthcare | Medium | Connection string |
| 11 | **ServiceNow** | SaaS | IT service management with employee/customer records | Medium | OAuth2 |
| 12 | **Workday** | SaaS | HR/people data — highest data sensitivity | High | OAuth2 / SAML |
| 13 | **GitHub** | DevOps | Code scanning for secrets/PII in repos | Medium | PAT / OAuth2 |
| 14 | **Microsoft Teams** | Collaboration | Chat + file sharing in enterprise | High | Microsoft Graph OAuth2 |
| 15 | **Splunk** | Security | Log analytics may contain PII | Medium | API key / OAuth2 |

---

## 10. Files Associated with Each Connector

### Framework Files (shared)

| File | Purpose |
|------|---------|
| `apps/api/src/modules/connectors/interfaces/connector.interface.ts` | Core IConnector interface, all types |
| `apps/api/src/modules/connectors/sdk/base-connector.ts` | BaseConnector abstract class |
| `apps/api/src/modules/connectors/sdk/auth/api-key.auth.ts` | API Key auth module |
| `apps/api/src/modules/connectors/sdk/auth/iam-role.auth.ts` | AWS IAM Role auth module |
| `apps/api/src/modules/connectors/sdk/auth/oauth2.auth.ts` | OAuth2 client credentials auth |
| `apps/api/src/modules/connectors/connector-registry.ts` | Factory pattern connector registry |
| `apps/api/src/modules/connectors/connectors.service.ts` | Business logic service |
| `apps/api/src/modules/connectors/connectors.controller.ts` | REST API controller |
| `apps/api/src/modules/connectors/connectors.module.ts` | NestJS module definition |
| `apps/api/src/modules/connectors/dto/connector.dto.ts` | API DTOs and enums |

### Connector Implementation Files

| Connector | File | Lines |
|-----------|------|-------|
| AWS S3 | `apps/api/src/modules/connectors/implementations/aws-s3.connector.ts` | 213 |
| Azure Blob Storage | `apps/api/src/modules/connectors/implementations/azure-blob.connector.ts` | 334 |
| Google Cloud Storage | `apps/api/src/modules/connectors/implementations/gcp-storage.connector.ts` | 327 |
| PostgreSQL | `apps/api/src/modules/connectors/implementations/postgres.connector.ts` | 228 |
| MySQL | `apps/api/src/modules/connectors/implementations/mysql.connector.ts` | 222 |
| SQL Server (MSSQL) | `apps/api/src/modules/connectors/implementations/mssql.connector.ts` | 237 |
| MongoDB | `apps/api/src/modules/connectors/implementations/mongodb.connector.ts` | 251 |
| Snowflake | `apps/api/src/modules/connectors/implementations/snowflake.connector.ts` | 285 |
| BigQuery | `apps/api/src/modules/connectors/implementations/bigquery.connector.ts` | 234 |

### Test Files

| Test | File |
|------|------|
| Registry tests | `apps/api/test/modules/connectors/connector-registry.spec.ts` |
| Auth tests | `apps/api/test/modules/connectors/connector-auth.spec.ts` |
| SDK tests | `apps/api/test/modules/connectors/connector-sdk.spec.ts` |

---

## 11. Architecture Quality Assessment

### Strengths

1. **Clean SDK pattern** — `IConnector` interface + `BaseConnector` abstract class provides a clear contract for new connectors.
2. **Factory pattern** — `ConnectorRegistry` enables runtime connector selection and easy extensibility.
3. **Retry + rate limiting** — Built into `BaseConnector`, all connectors benefit automatically.
4. **Async generators** — Memory-efficient streaming for `listAssets()` and `sampleContent()`.
5. **All npm dependencies installed** — Unlike earlier readiness reports, all 9 connector packages are present in `package.json`.
6. **Comprehensive access analysis** — All 9 connectors implement `getAccessPolicies()` with source-specific permission queries.
7. **Auth module library** — API Key, IAM Role, and OAuth2 auth modules are reusable for future connectors.

### Gaps

1. **S3 content sampling** — The most important connector has an empty `sampleContent()`.
2. **No event/change detection** — None of the connectors support real-time change events.
3. **No owner mapping** — The interface doesn't model data ownership beyond access principals.
4. **Only 2 connectors use `BaseConnector`'s retry/rate-limiting** directly — PostgreSQL and S3 implement `IConnector` directly, bypassing the SDK's retry logic.
5. **No integration tests** — Test files cover registry, auth, and SDK in isolation; no end-to-end connector tests.
6. **Module only registers 2 connectors for DI** — `connectors.module.ts` lists only `AwsS3Connector` and `PostgresConnector` as providers, though the registry creates all 9 via factory.

### Consistency Notes

| Pattern | Connectors Using It |
|---------|-------------------|
| Extends `BaseConnector` | Azure Blob, GCS, MySQL, MSSQL, MongoDB, Snowflake, BigQuery (7) |
| Implements `IConnector` directly | AWS S3, PostgreSQL (2) |

> The 2 connectors implementing `IConnector` directly miss retry/rate-limiting from `BaseConnector`. Consider migrating them for consistency.
