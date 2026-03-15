import { Logger } from '@nestjs/common';
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
import { BaseRestApiConnector } from '../sdk/base-rest-api-connector';

/**
 * Wiz connector using the Wiz GraphQL API.
 * Discovers cloud resources, issues/findings, and security policies.
 */
export class WizConnector extends BaseRestApiConnector {
  private graphqlUrl: string = '';

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { clientId, clientSecret, accessToken, authUrl } = config.credentials;

    if (accessToken) {
      this.setupBearerAuth(accessToken);
    } else if (clientId && clientSecret) {
      const tokenUrl = authUrl || 'https://auth.app.wiz.io/oauth/token';
      const resp = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          audience: 'wiz-api',
        }),
      });
      const data = await resp.json();
      this.setupBearerAuth(data.access_token);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { apiEndpointUrl } = config.credentials;
    this.graphqlUrl = apiEndpointUrl || 'https://api.us20.app.wiz.io/graphql';
    this.baseUrl = this.graphqlUrl;
  }

  private async graphql<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const resp = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!resp.ok) throw new Error(`Wiz API error: ${resp.status}`);
    const result = await resp.json();
    if (result.errors?.length) throw new Error(result.errors[0].message);
    return result.data;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const data = await this.graphql<any>(`
        query { tenantDetails { id name } }
      `);
      return {
        success: true,
        message: `Connected to Wiz tenant: ${data.tenantDetails?.name}`,
        metadata: { tenantId: data.tenantDetails?.id },
      };
    } catch (error: any) {
      return { success: false, message: `Wiz connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover cloud resource types with counts
    try {
      const data = await this.graphql<any>(`
        query {
          graphSearch(query: { type: ["CLOUD_RESOURCE"], select: true }, groupBy: ["type"]) {
            groups { keys values { count } }
          }
        }
      `);

      for (const group of data.graphSearch?.groups || []) {
        const resourceType = group.keys?.[0] || 'unknown';
        yield {
          externalId: `resource_type:${resourceType}`,
          name: resourceType,
          type: 'container',
          path: `wiz/resources/${resourceType}`,
          metadata: { count: group.values?.count },
          rowCountEstimate: group.values?.count,
        };
      }
    } catch {}

    // Discover issues
    try {
      const data = await this.graphql<any>(`
        query {
          issueAnalytics {
            summaries { severity count }
          }
        }
      `);

      for (const summary of data.issueAnalytics?.summaries || []) {
        yield {
          externalId: `issues:${summary.severity}`,
          name: `Issues - ${summary.severity}`,
          type: 'finding',
          path: `wiz/issues/${summary.severity}`,
          metadata: { severity: summary.severity, count: summary.count },
          rowCountEstimate: summary.count,
        };
      }
    } catch {}

    // Discover security frameworks / policies
    try {
      const data = await this.graphql<any>(`
        query {
          securityFrameworks(first: 50) {
            nodes { id name enabled builtin }
          }
        }
      `);

      for (const fw of data.securityFrameworks?.nodes || []) {
        yield {
          externalId: `framework:${fw.id}`,
          name: fw.name,
          type: 'container',
          path: `wiz/frameworks/${fw.id}`,
          metadata: { enabled: fw.enabled, builtin: fw.builtin },
        };
      }
    } catch {}

    // Discover projects
    try {
      const data = await this.graphql<any>(`
        query {
          projects(first: 100) {
            nodes { id name riskProfile { businessImpact } }
          }
        }
      `);

      for (const project of data.projects?.nodes || []) {
        yield {
          externalId: `project:${project.id}`,
          name: project.name,
          type: 'container',
          path: `wiz/projects/${project.id}`,
          metadata: { businessImpact: project.riskProfile?.businessImpact },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'issues') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'severity', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'status', dataType: 'string', ordinalPosition: 2, nullable: false },
          { name: 'title', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'resourceType', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'resourceName', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'createdAt', dataType: 'datetime', ordinalPosition: 6, nullable: false },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [type, severity] = assetExternalId.split(':');
    if (type !== 'issues') return;

    try {
      const data = await this.graphql<any>(`
        query($severity: [IssueSeverity!], $first: Int) {
          issues(filterBy: { severity: $severity }, first: $first) {
            nodes {
              id severity status
              entity { name type }
              createdAt
              control { name }
            }
          }
        }
      `, {
        severity: [severity],
        first: Math.min(options.maxRows, 100),
      });

      const issues = data.issues?.nodes || [];
      if (issues.length === 0) return;

      const fieldExtractors: Record<string, (issue: any) => any> = {
        id: (i) => i.id,
        severity: (i) => i.severity,
        status: (i) => i.status,
        resourceName: (i) => i.entity?.name,
        resourceType: (i) => i.entity?.type,
        controlName: (i) => i.control?.name,
        createdAt: (i) => i.createdAt,
      };

      const fields = Object.keys(fieldExtractors)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const extractor = fieldExtractors[fieldName];
        const values = issues.map(extractor).filter((v: any) => v != null && v !== '');
        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Wiz sampling failed: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'wiz',
      displayName: 'Wiz',
      description: 'Connect to Wiz for cloud security posture and vulnerability discovery',
      authMethods: ['oauth2'],
      requiredPermissions: [
        'read:resources',
        'read:issues',
        'read:security_frameworks',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
