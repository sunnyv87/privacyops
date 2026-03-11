# Section 6 — DSPM Detailed Design

## Connector Framework Design

### Architecture
```
┌──────────────────────────────────────────────────┐
│                  Scan Orchestrator                │
│            (Temporal Workflow Engine)             │
└─────────────┬────────────────────────────────────┘
              │
┌─────────────┴────────────────────────────────────┐
│              Connector Manager                    │
│   - Registry of available connectors              │
│   - Credential management                         │
│   - Health checking                               │
│   - Rate limiting per connector                   │
└─────────────┬────────────────────────────────────┘
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    │         │         │         │         │
┌───┴──┐ ┌───┴──┐ ┌───┴──┐ ┌───┴──┐ ┌───┴──┐
│AWS S3│ │ RDS  │ │Azure │ │ GCP  │ │ ...  │
│ Conn │ │ Conn │ │ Conn │ │ Conn │ │      │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

### IConnector Interface
```typescript
interface IConnector {
  // Lifecycle
  initialize(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  disconnect(): Promise<void>;

  // Discovery
  listAssets(): AsyncGenerator<DiscoveredAsset>;
  getAssetSchema(assetId: string): Promise<AssetSchema>;

  // Content Sampling
  sampleContent(assetId: string, options: SampleOptions): AsyncGenerator<ContentSample>;

  // Access Analysis
  getAccessPolicies(assetId: string): Promise<AccessPolicy[]>;

  // Metadata
  getMetadata(): Promise<ConnectorMetadata>;
  getCapabilities(): ConnectorCapabilities;
}

interface ConnectorCapabilities {
  supportsDiscovery: boolean;
  supportsContentSampling: boolean;
  supportsAccessAnalysis: boolean;
  supportsIncrementalScan: boolean;
  supportsEncryptionCheck: boolean;
  supportsVersioning: boolean;
  maxConcurrentScans: number;
}

interface SampleOptions {
  maxRows: number;        // Default 1000
  maxColumns: number;     // Default 100
  sampleStrategy: 'first_n' | 'random' | 'stratified';
  excludePatterns: string[];  // Column name patterns to skip
}
```

## Scanning Pipeline

```
[Connector] → [Asset Discovery] → [Schema Extraction] → [Content Sampling]
                                                              │
                                                    [Classification Engine]
                                                              │
                                    ┌─────────────────────────┼──────────────────┐
                                    │                         │                  │
                            [Risk Scoring]          [Access Analysis]    [Exposure Check]
                                    │                         │                  │
                                    └─────────────────────────┼──────────────────┘
                                                              │
                                                    [Finding Generation]
                                                              │
                                                    [Data Map Update]
```

### Scan Temporal Workflow
```typescript
// Simplified workflow definition
async function scanWorkflow(input: ScanInput): Promise<ScanResult> {
  // Step 1: Initialize connector
  await activities.initializeConnector(input.dataSourceId);

  // Step 2: Discover assets
  const assets = await activities.discoverAssets(input.dataSourceId);

  // Step 3: For each asset, extract schema
  const schemas = await Promise.all(
    assets.map(a => activities.extractSchema(a.id))
  );

  // Step 4: Sample content (parallel, rate-limited)
  const samples = await activities.sampleContent(
    assets.map(a => a.id),
    input.sampleOptions
  );

  // Step 5: Classify sampled content
  const classifications = await activities.classifyContent(samples);

  // Step 6: Analyze access posture
  const accessAnalysis = await activities.analyzeAccess(assets);

  // Step 7: Check exposure
  const exposures = await activities.checkExposure(assets);

  // Step 8: Score risks
  const findings = await activities.scoreRisks({
    classifications,
    accessAnalysis,
    exposures
  });

  // Step 9: Update data map
  await activities.updateDataMap(assets, classifications, findings);

  return { findings, stats: { assetsScanned: assets.length, ... } };
}
```

## Content Sampling Strategy

- **Default**: First 1000 rows, all columns
- **Large tables (>1M rows)**: Random sample of 1000 rows using `TABLESAMPLE` or `ORDER BY RANDOM() LIMIT 1000`
- **Object storage**: Sample first 100 objects per prefix, read first 1MB of each
- **Incremental**: Only scan assets modified since last scan (using metadata timestamps)
- **Content is NEVER persisted** — classified in-memory, only labels/confidence stored
- **Sampling data auto-purged** from worker memory after classification

## Classification Pipeline

```
[Raw Content] → [PII Redaction for logs] → [Pattern Matching] → [Dictionary Lookup]
                                                                        │
                                                               [Confidence Merge]
                                                                        │
                                                     [Context Enhancement (column name, table name)]
                                                                        │
                                                            [Label Assignment]
```

### Built-in Classification Patterns (India-first)

| Label | Category | Detection Method | Pattern/Keywords |
|-------|----------|-----------------|-----------------|
| Aadhaar Number | PII | Regex | `\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b` + Verhoeff checksum |
| PAN Number | PII | Regex | `\b[A-Z]{5}\d{4}[A-Z]\b` |
| Indian Mobile | PII | Regex | `\b(?:\+91[\s-]?)?[6-9]\d{9}\b` |
| GSTIN | Business | Regex | `\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b` |
| Indian Passport | PII | Regex | `\b[A-Z]\d{7}\b` (context: passport column) |
| IFSC Code | PFI | Regex | `\b[A-Z]{4}0[A-Z\d]{6}\b` |
| UPI ID | PFI | Regex | `\b[\w.-]+@[a-z]{2,}\b` (context: UPI/payment) |
| Email Address | PII | Regex | Standard email regex |
| Credit Card | PFI | Regex + Luhn | `\b(?:\d{4}[\s-]?){3}\d{4}\b` |
| SSN (US) | PII | Regex | `\b\d{3}-\d{2}-\d{4}\b` |
| IBAN | PFI | Regex | `\b[A-Z]{2}\d{2}[A-Z\d]{4,}\b` |
| IP Address | PII | Regex | IPv4/IPv6 patterns |
| Date of Birth | PII | Regex + Context | Date patterns + column name "dob", "birth" |
| Health Record | PHI | Keywords + Context | Medical terminology + context |

## Risk Scoring Model

### Formula
```
Risk Score (0-100) = Data Sensitivity Score × Exposure Score × Access Score × Volume Modifier

Where:
- Data Sensitivity Score (0-1): Max sensitivity level of classifications in the asset
  - Level 5 (highly sensitive PII): 1.0
  - Level 4 (sensitive PII): 0.8
  - Level 3 (PII): 0.6
  - Level 2 (internal): 0.3
  - Level 1 (public): 0.1

- Exposure Score (0-1):
  - Publicly accessible: 1.0
  - Cross-account accessible: 0.7
  - Overly permissive (>10 principals): 0.5
  - Appropriately restricted: 0.1

- Access Score (0-1):
  - No access controls: 1.0
  - Weak access controls: 0.7
  - Standard access controls: 0.3
  - Strong access controls (MFA, encryption): 0.1

- Volume Modifier (1.0-1.5):
  - >1M records: 1.5
  - >100K records: 1.3
  - >10K records: 1.1
  - <10K records: 1.0

Final Score = min(100, base_score × 100)
```

### Severity Mapping
| Score | Severity |
|-------|----------|
| 80-100 | Critical |
| 60-79 | High |
| 40-59 | Medium |
| 20-39 | Low |
| 0-19 | Info |

## Toxic Combination Detection

Flag when multiple sensitive data types coexist in same asset:
- PII + Financial data in same table (identity theft risk)
- Health data + Employment data (discrimination risk)
- Aadhaar + Financial + Contact (comprehensive identity risk)
- Authentication credentials + PII (breach amplification risk)

Implementation: After classification, check combinations per asset against a rule set.

## Data Map Generation

Interactive visualization showing:
- Data sources as nodes (grouped by cloud/type)
- Assets as sub-nodes with sensitivity color coding
- Data flow edges (Phase 2, requires lineage)
- Risk indicators per node
- Drill-down to asset detail

## Connector Specifications

### AWS S3 Connector
- **Auth**: IAM Role (cross-account AssumeRole) or Access Key
- **Min Permissions**: `s3:ListAllMyBuckets`, `s3:ListBucket`, `s3:GetObject`, `s3:GetBucketAcl`, `s3:GetBucketPolicy`, `s3:GetBucketEncryption`, `s3:GetBucketPublicAccessBlock`
- **Metadata Pulled**: Bucket list, object inventory, ACLs, policies, encryption config, public access settings, versioning, lifecycle rules
- **Content Pulled**: First 1MB of sampled objects (CSV, JSON, Parquet headers, text files)
- **Scan Frequency**: Daily metadata, weekly content sampling
- **Security Risks**: Cross-account role permissions, object download in transit
- **Sample API**:
```json
POST /api/v1/connectors
{
  "name": "Production AWS Account",
  "type": "aws_s3",
  "auth_method": "iam_role",
  "config": {
    "role_arn": "arn:aws:iam::123456789:role/TechDDSPMRole",
    "external_id": "techd-abc123",
    "regions": ["ap-south-1", "us-east-1"]
  }
}
```

### AWS RDS Connector
- **Auth**: IAM DB Auth or username/password (via Secrets Manager)
- **Min Permissions**: `SELECT` on information_schema, `SELECT` on sampled tables (read-only user)
- **Metadata Pulled**: Databases, schemas, tables, columns, indexes, row counts, storage size
- **Content Pulled**: `SELECT * FROM <table> TABLESAMPLE SYSTEM(1) LIMIT 1000` or equivalent
- **Scan Frequency**: Weekly
- **Sample API**:
```json
POST /api/v1/connectors
{
  "name": "Production RDS",
  "type": "aws_rds",
  "auth_method": "connection_string",
  "config": {
    "engine": "postgresql",
    "host": "prod-db.xxx.ap-south-1.rds.amazonaws.com",
    "port": 5432,
    "database": "production",
    "ssl": true
  },
  "credential": {
    "username": "techd_readonly",
    "password": "<encrypted>"
  }
}
```

### Azure Blob Storage Connector
- **Auth**: Service Principal (client credentials) or Managed Identity
- **Min Permissions**: `Storage Blob Data Reader` role
- **Metadata Pulled**: Storage accounts, containers, blob inventory, access policies, encryption config
- **Content Pulled**: First 1MB of sampled blobs
- **Scan Frequency**: Daily metadata, weekly content

### GCP Cloud Storage Connector
- **Auth**: Service Account Key or Workload Identity Federation
- **Min Permissions**: `storage.objects.list`, `storage.objects.get`, `storage.buckets.get`, `storage.buckets.getIamPolicy`
- **Metadata Pulled**: Buckets, objects, IAM policies, encryption, lifecycle

### Snowflake Connector
- **Auth**: Username/password, OAuth, or Key Pair
- **Min Permissions**: `USAGE` on warehouse, `USAGE` on database/schema, `SELECT` on tables
- **Metadata Pulled**: Databases, schemas, tables, columns, row counts, clustering info
- **Content Pulled**: `SELECT * FROM <table> SAMPLE (1000 ROWS)`
- **Scan Frequency**: Weekly

### BigQuery Connector
- **Auth**: Service Account
- **Min Permissions**: `bigquery.datasets.get`, `bigquery.tables.list`, `bigquery.tables.get`, `bigquery.tables.getData`
- **Metadata Pulled**: Datasets, tables, columns, row counts, storage usage, access controls

### PostgreSQL / MySQL / SQL Server / MongoDB Connectors
- **Auth**: Username/password over TLS
- **Min Permissions**: Read-only user with SELECT on information_schema and target schemas
- **Metadata**: Standard schema introspection queries
- **Content**: SELECT with LIMIT/TABLESAMPLE

### Google Drive Connector
- **Auth**: OAuth 2.0 (Google Workspace Admin consent)
- **Min Permissions**: `drive.readonly` scope
- **Metadata Pulled**: File list, sharing settings, owners, last modified
- **Content Pulled**: Document text extraction (Google Docs API), first 1MB of files
- **Scan Frequency**: Weekly

### OneDrive / SharePoint Connector
- **Auth**: OAuth 2.0 (Microsoft Graph API, app-only auth)
- **Min Permissions**: `Sites.Read.All`, `Files.Read.All`
- **Metadata Pulled**: Site/drive inventory, file metadata, sharing/permissions
- **Content Pulled**: File download + text extraction

### Salesforce Connector
- **Auth**: OAuth 2.0 (Connected App)
- **Min Permissions**: API Enabled, View All Data (or object-specific)
- **Metadata Pulled**: Object list, field metadata, record counts
- **Content Pulled**: SOQL queries with LIMIT

### GitHub Connector
- **Auth**: GitHub App or Personal Access Token
- **Min Permissions**: `repo:read`, `org:read`
- **Metadata Pulled**: Repos, branches, file tree
- **Content Pulled**: File content for config files, env files, code scanning
- **Focus**: Secrets detection, PII in code/configs

### Slack Connector
- **Auth**: OAuth 2.0 (Slack App with Bot Token)
- **Min Permissions**: `channels:history`, `channels:read`, `files:read`
- **Metadata Pulled**: Channel list, file attachments
- **Content Pulled**: Message sampling, file metadata
- **Scan Frequency**: Daily (retention-focused)

### M365 Connector
- **Auth**: OAuth 2.0 (Microsoft Graph, app-only)
- **Min Permissions**: `Mail.Read`, `Files.Read.All`, `Sites.Read.All`
- **Metadata Pulled**: Mailbox metadata, file metadata, Teams channel metadata
- **Content Pulled**: Email subject/body sampling, file extraction

### Generic REST Connector
- **Auth**: API Key, OAuth 2.0, Basic Auth (configurable)
- **Config**: Custom endpoint definitions, response mapping
- **Metadata**: Configurable via JSONPath expressions
- **Content**: Configurable response field mapping
- **Sample Config**:
```json
{
  "base_url": "https://api.example.com/v1",
  "auth": { "type": "api_key", "header": "X-API-Key" },
  "endpoints": [
    {
      "name": "customers",
      "path": "/customers",
      "method": "GET",
      "pagination": { "type": "cursor", "param": "after" },
      "fields_mapping": {
        "id": "$.id",
        "name": "$.full_name",
        "email": "$.contact.email"
      }
    }
  ]
}
```

## Agentless vs Agent-Based

**Default: Agentless** — All connectors use API/SDK access. No agent installation required.

**Agent-based option (Phase 3)**: For on-premise file shares, endpoints, and air-gapped environments where API access isn't possible. Lightweight agent (Go binary) that runs discovery locally and pushes metadata to the platform.

## Integration Points

| System | Integration | Direction |
|--------|-------------|-----------|
| SIEM (Splunk, QRadar) | Push findings as security events | Outbound |
| CNAPP (Wiz, Prisma) | Correlate cloud posture with data risk | Bidirectional |
| DLP (Forcepoint, Symantec) | Share classification labels | Outbound |
| IAM (Okta, Azure AD) | Pull access policies for analysis | Inbound |
| Ticketing (Jira, ServiceNow) | Create remediation tickets | Outbound |
| SOAR | Trigger playbooks on critical findings | Outbound |

## DSPM Dashboard Widgets

1. **Data Risk Overview**: Donut chart of findings by severity
2. **Top Risky Data Stores**: Table with risk scores, sorted by severity
3. **Sensitive Data Distribution**: Bar chart by classification category
4. **Exposure Map**: Visual showing publicly exposed assets
5. **Access Anomalies**: Recent access posture changes
6. **Scan Coverage**: % of data sources scanned, last scan times
7. **Trend Lines**: Risk score trends over time
8. **Data Map**: Interactive graph of data sources → assets → classifications
