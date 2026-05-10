# TechD PrivacyOps -- Connector Integration Guide

## Overview

The connector framework enables PrivacyOps to discover, classify, and manage data across 43 data source types. Every connector implements the `IConnector` interface defined in `apps/api/src/modules/connectors/interfaces/connector.interface.ts` and is registered in the `ConnectorRegistry` at `apps/api/src/modules/connectors/connector-registry.ts`.

---

## 1. IConnector Interface

```typescript
// apps/api/src/modules/connectors/interfaces/connector.interface.ts

export interface IConnector {
  /** Initialize with credentials and options. */
  initialize(config: ConnectorConfig): Promise<void>;

  /** Test connectivity. Returns success/failure with metadata. */
  testConnection(): Promise<ConnectionTestResult>;

  /** Clean up connections, handles, temp files. */
  disconnect(): Promise<void>;

  /** Async generator yielding discovered assets (tables, buckets, files). */
  listAssets(): AsyncGenerator<DiscoveredAsset>;

  /** Get schema (columns/fields) for a specific asset. */
  getAssetSchema(assetExternalId: string): Promise<AssetSchema>;

  /** Async generator yielding content samples for classification. */
  sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample>;

  /** OPTIONAL: Get access policies (IAM, ACLs, bucket policies). */
  getAccessPolicies?(assetExternalId: string): Promise<AccessPolicy[]>;

  /** OPTIONAL: Dispose asset (delete, anonymize, archive) for retention. */
  disposeAsset?(
    assetExternalId: string,
    action: 'delete' | 'anonymize' | 'archive',
  ): Promise<DisposalResult>;

  /** Return connector metadata (capabilities, auth methods, etc.). */
  getMetadata(): ConnectorMetadata;
}
```

### Key Types

```typescript
export interface ConnectorConfig {
  type: DataSourceType;
  credentials: Record<string, any>;
  options: Record<string, any>;
}

export interface DiscoveredAsset {
  externalId: string;      // Unique ID in the source system
  name: string;
  type: AssetType;         // 'table' | 'bucket' | 'collection' | 'file' | ...
  path: string;
  parentExternalId?: string;
  metadata: Record<string, any>;
  sizeBytes?: number;
  rowCountEstimate?: number;
}

export interface SampleOptions {
  maxRows: number;
  maxColumns: number;
  sampleStrategy: 'first_n' | 'random' | 'stratified';
  excludePatterns: string[];
}

export interface AccessPolicy {
  principal: string;
  principalType: 'user' | 'group' | 'role' | 'service' | 'public';
  permissions: string[];
  source: string;          // e.g., "bucket_policy", "iam_policy", "acl"
}

export interface DisposalResult {
  action: 'deleted' | 'anonymized' | 'archived' | 'unsupported' | 'skipped';
  nativeOperation?: string; // e.g., 'DeleteObject', 'TRUNCATE'
  details?: Record<string, unknown>;
}

export interface ConnectorCapabilities {
  supportsDiscovery: boolean;
  supportsContentSampling: boolean;
  supportsAccessAnalysis: boolean;
  supportsIncrementalScan: boolean;
  supportsEncryptionCheck: boolean;
}
```

---

## 2. Registered Connectors (43 Types)

### Existing (Core 9)
`aws_s3`, `postgresql`, `mysql`, `mongodb`, `azure_blob`, `gcp_storage`, `snowflake`, `sqlserver`, `bigquery`

### Wave 1 (15)
`aws_rds`, `redshift`, `databricks`, `salesforce`, `servicenow`, `google_drive`, `onedrive`, `sharepoint`, `slack`, `teams`, `okta`, `azure_ad`, `github`, `splunk`, `generic_rest`

### Wave 2 (14)
`oracle`, `cassandra`, `workday`, `hubspot`, `zendesk`, `dropbox`, `ping_identity`, `gitlab`, `bitbucket`, `jenkins`, `microsoft_sentinel`, `elastic_security`, `wiz`, `prisma_cloud`

### Wave 3 (5)
`sap_hana`, `jira`, `confluence`, `cyberark`, `sailpoint`

---

## 3. Implementing a New Connector

### Step 1: Create the Connector File

Create a new file at `apps/api/src/modules/connectors/implementations/<type>.connector.ts`:

```typescript
import {
  IConnector,
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  DisposalResult,
  ConnectorMetadata,
} from '../interfaces/connector.interface';

export class MyCustomConnector implements IConnector {
  private client: any;
  private config!: ConnectorConfig;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    // Initialize SDK client with config.credentials
    this.client = new MySDKClient({
      apiKey: config.credentials.apiKey,
      region: config.options.region,
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const info = await this.client.getAccountInfo();
      return {
        success: true,
        message: 'Connected successfully',
        metadata: { accountId: info.id, region: info.region },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    let cursor: string | undefined;
    do {
      const page = await this.client.listResources({ cursor, limit: 100 });
      for (const resource of page.items) {
        yield {
          externalId: resource.id,
          name: resource.name,
          type: 'table',
          path: `/${resource.schema}/${resource.name}`,
          metadata: { schema: resource.schema },
          sizeBytes: resource.sizeBytes,
          rowCountEstimate: resource.rowCount,
        };
      }
      cursor = page.nextCursor;
    } while (cursor);
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const columns = await this.client.describeTable(assetExternalId);
    return {
      fields: columns.map((col: any, i: number) => ({
        name: col.name,
        dataType: col.type,
        ordinalPosition: i,
        nullable: col.nullable,
        description: col.description,
      })),
    };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const rows = await this.client.queryPreview(assetExternalId, {
      limit: options.maxRows,
    });
    const columns = Object.keys(rows[0] || {}).slice(0, options.maxColumns);
    for (const col of columns) {
      yield {
        assetExternalId,
        fieldName: col,
        values: rows.map((r: any) => r[col]),
        totalSampled: rows.length,
      };
    }
  }

  // OPTIONAL: implement for DSPM access analysis
  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const policies = await this.client.getPermissions(assetExternalId);
    return policies.map((p: any) => ({
      principal: p.identity,
      principalType: p.type,
      permissions: p.grants,
      source: 'api',
    }));
  }

  // OPTIONAL: implement for data retention disposal
  async disposeAsset(
    assetExternalId: string,
    action: 'delete' | 'anonymize' | 'archive',
  ): Promise<DisposalResult> {
    if (action === 'delete') {
      await this.client.deleteResource(assetExternalId);
      return { action: 'deleted', nativeOperation: 'DeleteResource' };
    }
    return { action: 'unsupported' };
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'my_custom' as any,
      displayName: 'My Custom Source',
      description: 'Connects to My Custom data platform',
      authMethods: ['api_key', 'oauth2'],
      requiredPermissions: ['read:data', 'list:schemas'],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
```

### Step 2: Register in ConnectorRegistry

Add the import and registration in `apps/api/src/modules/connectors/connector-registry.ts`:

```typescript
import { MyCustomConnector } from './implementations/my-custom.connector';

// In the constructor:
this.register('my_custom', () => new MyCustomConnector());
```

### Step 3: Add the DataSourceType

Add the new type to the `DataSourceType` union in `apps/api/src/modules/connectors/interfaces/connector.interface.ts`:

```typescript
export type DataSourceType =
  | 'aws_s3'
  // ... existing types ...
  | 'my_custom';
```

### Step 4: Add the AssetType (if needed)

If the source introduces a new asset type, add it to the `AssetType` union:

```typescript
export type AssetType =
  | 'table'
  // ... existing types ...
  | 'my_new_type';
```

---

## 4. Base Connector Classes

The framework provides two base classes to reduce boilerplate:

### BaseConnector

```
apps/api/src/modules/connectors/sdk/base-connector.ts
```

Provides common logging, error handling, and lifecycle management. Extend this for SDK-based connectors.

### BaseRestApiConnector

```
apps/api/src/modules/connectors/sdk/base-rest-api-connector.ts
```

Adds HTTP client with retry logic, pagination helpers, and rate limiting. Use this for REST API connectors (Salesforce, ServiceNow, Jira, etc.).

---

## 5. Capability Matrix

| Connector | Discovery | Sampling | Access Analysis | Incremental | Disposal |
|-----------|:---------:|:--------:|:---------------:|:-----------:|:--------:|
| aws_s3 | Y | Y | Y | Y | Y |
| postgresql | Y | Y | Y | Y | Y |
| mysql | Y | Y | Y | Y | Y |
| mongodb | Y | Y | N | N | Y |
| snowflake | Y | Y | Y | Y | Y |
| bigquery | Y | Y | Y | N | Y |
| azure_blob | Y | Y | Y | Y | Y |
| gcp_storage | Y | Y | Y | Y | Y |
| salesforce | Y | Y | N | Y | N |
| okta | Y | N | Y | N | N |
| azure_ad | Y | N | Y | N | N |
| slack | Y | Y | N | N | N |
| github | Y | Y | Y | N | N |
| generic_rest | Y | Y | N | N | N |

---

## 6. Connector Testing

### Unit Test Template

Create tests at `apps/api/test/modules/connectors/<type>.connector.spec.ts`:

```typescript
import { MyCustomConnector } from '@/modules/connectors/implementations/my-custom.connector';

describe('MyCustomConnector', () => {
  let connector: MyCustomConnector;

  beforeEach(() => {
    connector = new MyCustomConnector();
  });

  afterEach(async () => {
    await connector.disconnect();
  });

  describe('getMetadata', () => {
    it('should return correct capabilities', () => {
      const meta = connector.getMetadata();
      expect(meta.type).toBe('my_custom');
      expect(meta.capabilities.supportsDiscovery).toBe(true);
    });
  });

  describe('listAssets', () => {
    it('should yield discovered assets', async () => {
      await connector.initialize({
        type: 'my_custom' as any,
        credentials: { apiKey: 'test-key' },
        options: {},
      });

      const assets: any[] = [];
      for await (const asset of connector.listAssets()) {
        assets.push(asset);
        if (assets.length >= 5) break;
      }
      expect(assets.length).toBeGreaterThan(0);
      expect(assets[0]).toHaveProperty('externalId');
      expect(assets[0]).toHaveProperty('name');
      expect(assets[0]).toHaveProperty('type');
    });
  });

  describe('disposeAsset', () => {
    it('should return unsupported for unimplemented actions', async () => {
      await connector.initialize({
        type: 'my_custom' as any,
        credentials: { apiKey: 'test-key' },
        options: {},
      });

      const result = await connector.disposeAsset!('asset-1', 'archive');
      expect(result.action).toBe('unsupported');
    });
  });
});
```

### Integration Test

```bash
# Run connector tests
npx jest --testPathPattern=connectors --runInBand

# Run with real credentials (CI)
CONNECTOR_TEST_CREDENTIALS=$(cat test-creds.json) \
  npx jest --testPathPattern=connectors --runInBand
```

---

## 7. Workflow Integration

Connectors are invoked by the scan workflow (`apps/api/src/core/workflow/workflows/scan.workflow.ts`):

1. `DiscoveryService.executeScan()` calls `ConnectorRegistry.create(type)` to instantiate the connector
2. `connector.initialize(config)` is called with decrypted credentials
3. `connector.listAssets()` yields assets stored in the `assets` table
4. `ClassificationService.classifyAsset()` calls `connector.sampleContent()` for PII detection
5. `DspmService.recalculateRisk()` computes risk scores
6. `connector.disconnect()` is called in the `finally` block

The Temporal `scan-queue` worker runs this with a 30-minute activity timeout and 3 retry attempts with backoff coefficient 2.

---

## 8. Connector Health Monitoring

Connector health is tracked by `apps/api/src/modules/observability/connector-health.service.ts` and exposed via Prometheus metrics:

```
connector_health_status{connector_type="aws_s3", data_source_id="uuid"} 1
connector_sync_duration_seconds{connector_type="postgresql"} 12.5
connector_sync_errors_total{connector_type="mongodb"} 0
```

Health states: `1` = healthy, `0.5` = degraded, `0` = unhealthy. Alerts fire after 5 minutes of unhealthy state (see `infra/helm/privacyops/templates/prometheus-rules.yaml`).
