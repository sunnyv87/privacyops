import { MongoClient, Db } from 'mongodb';
import {
  ConnectorConfig,
  ConnectionTestResult,
  DiscoveredAsset,
  AssetSchema,
  ContentSample,
  SampleOptions,
  AccessPolicy,
  ConnectorMetadata,
} from '../interfaces/connector.interface';
import { BaseConnector } from '../sdk/base-connector';
import {
  SsrfError,
  UrlGuardService,
} from '@/core/security/url-guard.service';

// Module-level singleton: connectors live outside the DI container and need
// a shared guard instance for URI validation.
const urlGuard = new UrlGuardService();

/**
 * Parse a MongoDB connection string and yield the (host, port) pairs it
 * contains. Supports both `mongodb://` (explicit hosts/ports) and
 * `mongodb+srv://` (single SRV hostname — port is implied 27017 and the
 * real nodes are discovered via DNS SRV records at connect time).
 *
 * We deliberately do NOT defer to mongodb's internal ConnectionString
 * parser here because we must reject the URI BEFORE constructing a client
 * that could initiate network I/O against an internal address.
 */
function parseMongoHosts(uri: string): { hosts: Array<{ host: string; port: number }>; isSrv: boolean } {
  const mongoPrefix = /^mongodb(\+srv)?:\/\//i;
  const match = uri.match(mongoPrefix);
  if (!match) {
    throw new SsrfError(
      `Unsupported MongoDB URI scheme; expected mongodb:// or mongodb+srv://`,
      'scheme',
    );
  }
  const isSrv = !!match[1];
  const afterScheme = uri.slice(match[0].length);

  // Strip optional userinfo (everything before the last `@` before the
  // first `/` or `?`).
  const pathStart = afterScheme.search(/[/?#]/);
  const authority = pathStart === -1 ? afterScheme : afterScheme.slice(0, pathStart);
  const atIdx = authority.lastIndexOf('@');
  const hostSection = atIdx === -1 ? authority : authority.slice(atIdx + 1);

  if (!hostSection) {
    throw new SsrfError('MongoDB URI missing host', 'host');
  }

  const hostEntries = hostSection.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (hostEntries.length === 0) {
    throw new SsrfError('MongoDB URI missing host', 'host');
  }

  if (isSrv && hostEntries.length > 1) {
    // per spec, mongodb+srv:// MUST have exactly one host
    throw new SsrfError(
      'mongodb+srv:// URIs must contain exactly one host',
      'host',
    );
  }

  const parsed = hostEntries.map((entry) => {
    // IPv6 literal form: [::1]:27017
    if (entry.startsWith('[')) {
      const closeIdx = entry.indexOf(']');
      if (closeIdx === -1) {
        throw new SsrfError(`Malformed IPv6 host in URI: ${entry}`, 'host');
      }
      const host = entry.slice(1, closeIdx);
      const rest = entry.slice(closeIdx + 1);
      const port = rest.startsWith(':') ? Number(rest.slice(1)) : 27017;
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new SsrfError(`Invalid port in URI: ${entry}`, 'port');
      }
      return { host, port };
    }
    const [host, portStr] = entry.split(':');
    const port = portStr ? Number(portStr) : 27017;
    if (!host) {
      throw new SsrfError(`Empty host in URI: ${entry}`, 'host');
    }
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new SsrfError(`Invalid port in URI: ${entry}`, 'port');
    }
    return { host, port };
  });

  return { hosts: parsed, isSrv };
}

export class MongodbConnector extends BaseConnector {
  private client: MongoClient;
  private db: Db;

  /**
   * Validate every host referenced by the MongoDB URI against the SSRF
   * guard. For mongodb+srv:// URIs, we can only validate the SRV record
   * hostname itself — the actual node list is discovered later by the
   * driver via DNS SRV, which bypasses this check. We therefore restrict
   * SRV URIs by requiring the initial SRV hostname to itself be a public
   * target; callers that need stricter controls should disable SRV in
   * connector config.
   */
  private async validateMongoUri(uri: string): Promise<void> {
    const { hosts } = parseMongoHosts(uri);

    // The UrlGuardService is URL-shaped, so we synthesize `http://host:port`
    // per target purely to reuse its DNS resolution + IP policy enforcement.
    // The scheme check is satisfied by `http:`; the port list is whatever
    // the URI declared (we don't want to second-guess MongoDB deployments
    // that use non-default routing ports).
    for (const { host, port } of hosts) {
      // IPv6 literals must be bracketed inside a URL authority.
      const hostPart = host.includes(':') ? `[${host}]` : host;
      await urlGuard.assertSafe(`http://${hostPart}:${port}`, {
        allowedSchemes: ['http:'],
        allowedPorts: [port],
      });
    }
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const {
      host,
      port,
      database,
      username,
      password,
      authSource,
      connectionString,
    } = config.credentials;

    const uri =
      connectionString ||
      `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port || 27017}/${database}?authSource=${authSource || 'admin'}`;

    // SSRF defense: refuse to connect to private, loopback, link-local,
    // or cloud-metadata endpoints. This runs BEFORE MongoClient is
    // constructed so no network I/O has been initiated against an
    // attacker-controlled internal address.
    await this.validateMongoUri(uri);

    this.client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    await this.withRetry(() => this.client.connect(), 'connect');
    this.db = this.client.db(database);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.withRetry(() => this.db.command({ ping: 1 }), 'testConnection');

      const buildInfo = await this.withRetry(
        () => this.db.admin().command({ buildInfo: 1 }),
        'buildInfo',
      );

      return {
        success: true,
        message: 'Connected successfully',
        metadata: { serverVersion: buildInfo.version },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    const collections = await this.withRetry(
      () => this.db.listCollections().toArray(),
      'listCollections',
    );

    for (const collection of collections) {
      const collName = collection.name;

      let docCount: number | undefined;
      try {
        docCount = await this.withRetry(
          () => this.db.collection(collName).estimatedDocumentCount(),
          'estimatedDocumentCount',
        );
      } catch {
        // Count may not be available for all collections
      }

      let sizeBytes: number | undefined;
      try {
        const statsResult = await this.withRetry(
          () =>
            this.db
              .command({ collStats: collName })
              .then((r: any) => r as { size?: number }),
          'collectionStats',
        );
        sizeBytes = statsResult.size;
      } catch {
        // Stats may not be available for all collections
      }

      yield {
        externalId: `collection:${collName}`,
        name: collName,
        type: 'collection',
        path: collName,
        metadata: {
          collectionType: collection.type,
        },
        sizeBytes,
        rowCountEstimate: docCount,
      };
    }
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const collectionName = assetExternalId.replace('collection:', '');

    const sampleDoc = await this.withRetry(
      () => this.db.collection(collectionName).findOne(),
      'getAssetSchema',
    );

    if (!sampleDoc) {
      return { fields: [] };
    }

    const fields = Object.entries(sampleDoc).map(([key, value], idx) => ({
      name: key,
      dataType: this.inferMongoType(value),
      ordinalPosition: idx,
      nullable: true, // MongoDB fields are always optional
      description: undefined,
    }));

    return { fields };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const collectionName = assetExternalId.replace('collection:', '');

    const docs = await this.withRetry(async () => {
      if (options.sampleStrategy === 'random') {
        return await this.db
          .collection(collectionName)
          .aggregate([{ $sample: { size: options.maxRows } }])
          .toArray();
      }
      return await this.db
        .collection(collectionName)
        .find()
        .limit(options.maxRows)
        .toArray();
    }, 'sampleContent');

    if (docs.length === 0) return;

    // Gather all field names from sampled documents
    const fieldNames = new Set<string>();
    for (const doc of docs) {
      Object.keys(doc).forEach((k) => fieldNames.add(k));
    }

    const filteredFields = Array.from(fieldNames)
      .filter(
        (f) =>
          !options.excludePatterns.some((p) =>
            f.toLowerCase().includes(p.toLowerCase()),
          ),
      )
      .slice(0, options.maxColumns);

    for (const fieldName of filteredFields) {
      const values = docs
        .map((doc: any) => doc[fieldName])
        .filter((v: any) => v !== null && v !== undefined);

      yield {
        assetExternalId,
        fieldName,
        values: values.slice(0, 100),
        totalSampled: values.length,
      };
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    try {
      const usersInfo = await this.withRetry(
        () => this.db.command({ usersInfo: 1 }),
        'getAccessPolicies',
      );

      const policies: AccessPolicy[] = [];

      for (const user of usersInfo.users || []) {
        const roles = (user.roles || []).map(
          (r: any) => `${r.role}@${r.db}`,
        );

        policies.push({
          principal: user.user,
          principalType: 'user',
          permissions: roles,
          source: 'mongodb_users',
        });
      }

      return policies;
    } catch {
      return [];
    }
  }

  private inferMongoType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object' && value._bsontype === 'ObjectId')
      return 'objectId';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'mongodb',
      displayName: 'MongoDB',
      description:
        'Connect to MongoDB databases for data discovery and classification',
      authMethods: ['connection_string', 'credentials'],
      requiredPermissions: [
        'find on target collections',
        'listCollections on target database',
      ],
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
