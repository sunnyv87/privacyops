import {
  IConnector,
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  burstLimit: number;
}

export abstract class BaseConnector implements IConnector {
  protected config: ConnectorConfig;
  protected retryConfig: RetryConfig = { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 };
  protected rateLimitConfig: RateLimitConfig = { maxRequestsPerSecond: 10, burstLimit: 20 };
  private requestTimestamps: number[] = [];

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    if (config.options?.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...config.options.retryConfig };
    }
    if (config.options?.rateLimitConfig) {
      this.rateLimitConfig = { ...this.rateLimitConfig, ...config.options.rateLimitConfig };
    }
    await this.doInitialize(config);
  }

  protected abstract doInitialize(config: ConnectorConfig): Promise<void>;
  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract disconnect(): Promise<void>;
  abstract getMetadata(): ConnectorMetadata;

  abstract listAssets(): AsyncGenerator<DiscoveredAsset>;
  abstract getAssetSchema(assetExternalId: string): Promise<AssetSchema>;
  abstract sampleContent(assetExternalId: string, options: SampleOptions): AsyncGenerator<ContentSample>;

  getAccessPolicies?(assetExternalId: string): Promise<AccessPolicy[]>;

  protected async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        return await operation();
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw new Error(`${context} failed after ${this.retryConfig.maxRetries + 1} attempts: ${lastError!.message}`);
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 1000);
    if (this.requestTimestamps.length >= this.rateLimitConfig.maxRequestsPerSecond) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = 1000 - (now - oldestInWindow);
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    }
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Sanitize a SQL identifier (schema, table, or column name) to prevent SQL injection.
   * Removes characters that are not alphanumeric, underscores, dots, or hyphens.
   * Throws if the result is empty or looks like a SQL keyword injection attempt.
   */
  protected sanitizeIdentifier(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('SQL identifier must be a non-empty string');
    }
    // Strip any characters that are not alphanumeric, underscore, hyphen, dot, or space
    const sanitized = identifier.replace(/[^a-zA-Z0-9_.\- ]/g, '');
    if (!sanitized || sanitized.length === 0) {
      throw new Error(`Invalid SQL identifier: "${identifier}"`);
    }
    return sanitized;
  }

  /**
   * Quote a SQL identifier for use in queries. Uses double-quote escaping by default.
   * Override in database-specific connectors if needed (e.g., backticks for MySQL).
   */
  protected quoteIdentifier(identifier: string, quoteChar = '"'): string {
    const sanitized = this.sanitizeIdentifier(identifier);
    // Escape any embedded quote characters by doubling them
    const escaped = sanitized.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar);
    return `${quoteChar}${escaped}${quoteChar}`;
  }

  /**
   * Sanitize and quote a list of column names for SELECT queries.
   */
  protected sanitizeColumnList(columns: string[]): string {
    return columns.map((col) => this.quoteIdentifier(col)).join(', ');
  }

  /**
   * Validate and coerce maxRows to a safe integer within bounds.
   */
  protected sanitizeMaxRows(maxRows: number | undefined, max = 1000): number {
    const n = Number(maxRows);
    if (!Number.isFinite(n) || n < 1) return Math.min(100, max);
    return Math.min(Math.floor(n), max);
  }

  protected normalizeSchema(raw: any[]): { name: string; dataType: string; ordinalPosition: number; nullable: boolean }[] {
    return raw.map((col, idx) => ({
      name: String(col.name || col.column_name || col.COLUMN_NAME || ''),
      dataType: String(col.dataType || col.data_type || col.DATA_TYPE || 'unknown'),
      ordinalPosition: col.ordinalPosition ?? col.ordinal_position ?? idx,
      nullable: col.nullable != null ? col.nullable : col.is_nullable != null ? col.is_nullable === 'YES' : true,
    }));
  }
}
