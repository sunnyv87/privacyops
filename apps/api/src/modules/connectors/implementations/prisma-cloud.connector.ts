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
 * Prisma Cloud connector using the Prisma Cloud CSPM REST API v2/v3.
 * Discovers cloud accounts, alert rules, policies, and compliance standards.
 * Samples alerts and findings.
 */
export class PrismaCloudConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { accessKeyId, secretKey, apiUrl } = config.credentials;

    if (accessKeyId && secretKey) {
      // Prisma Cloud uses a login endpoint that returns a JWT
      const resp = await fetch(`${apiUrl || this.baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: accessKeyId,
          password: secretKey,
        }),
      });
      const data = await resp.json();
      this.setupBearerAuth(data.token);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { apiUrl } = config.credentials;
    // Prisma Cloud API URLs vary by stack: api.prismacloud.io, api2.prismacloud.io, etc.
    this.baseUrl = apiUrl || 'https://api.prismacloud.io';
    this.defaultPageSize = 100;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/check');
      return {
        success: true,
        message: 'Connected to Prisma Cloud',
        metadata: { status: result.status || 'ok' },
      };
    } catch (error: any) {
      // Prisma Cloud /check may return 200 with no body
      if (error.message?.includes('200')) {
        return { success: true, message: 'Connected to Prisma Cloud', metadata: {} };
      }
      return { success: false, message: `Prisma Cloud connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Cloud accounts
    try {
      const accounts = await this.request<any[]>('GET', '/cloud');
      for (const account of accounts || []) {
        yield {
          externalId: `account:${account.accountId}`,
          name: account.name || account.accountId,
          type: 'container',
          path: `prismacloud/accounts/${account.accountId}`,
          metadata: {
            cloudType: account.cloudType,
            enabled: account.enabled,
            status: account.status,
          },
        };
      }
    } catch {}

    // Alert rules
    try {
      const rules = await this.request<any[]>('GET', '/v2/alert/rule');
      for (const rule of rules || []) {
        yield {
          externalId: `alertRule:${rule.policyScanConfigId}`,
          name: rule.name,
          type: 'alert',
          path: `prismacloud/alertRules/${rule.policyScanConfigId}`,
          metadata: {
            enabled: rule.enabled,
            scanAll: rule.scanAll,
          },
        };
      }
    } catch {}

    // Policies
    try {
      const policies = await this.request<any[]>('GET', '/v2/policy');
      for (const policy of policies || []) {
        yield {
          externalId: `policy:${policy.policyId}`,
          name: policy.name,
          type: 'finding',
          path: `prismacloud/policies/${policy.policyId}`,
          metadata: {
            severity: policy.severity,
            policyType: policy.policyType,
            enabled: policy.enabled,
            cloudType: policy.cloudType,
          },
        };
      }
    } catch {}

    // Compliance standards
    try {
      const standards = await this.request<any[]>('GET', '/compliance');
      for (const std of standards || []) {
        yield {
          externalId: `compliance:${std.id}`,
          name: std.name,
          type: 'container',
          path: `prismacloud/compliance/${std.id}`,
          metadata: {
            systemDefault: std.systemDefault,
            policiesAssignedCount: std.policiesAssignedCount,
          },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'alertRule' || type === 'policy') {
      return {
        fields: [
          { name: 'id', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'status', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'severity', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'policyName', dataType: 'string', ordinalPosition: 3, nullable: true },
          { name: 'resourceName', dataType: 'string', ordinalPosition: 4, nullable: true },
          { name: 'resourceType', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'cloudType', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'accountName', dataType: 'string', ordinalPosition: 7, nullable: true },
          { name: 'alertTime', dataType: 'datetime', ordinalPosition: 8, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [type] = assetExternalId.split(':');

    // Sample alerts for alert rules or policies
    if (type !== 'alertRule' && type !== 'policy') return;

    try {
      const filters: any = { timeRange: { type: 'relative', value: { amount: 30, unit: 'day' } } };
      if (type === 'policy') {
        filters['policy.name'] = assetExternalId.replace('policy:', '');
      }

      const result = await this.request<any>('POST', '/v2/alert', {
        body: {
          ...filters,
          limit: Math.min(options.maxRows, 100),
          detailed: true,
        },
      });

      const alerts = result.items || [];
      if (alerts.length === 0) return;

      const fieldExtractors: Record<string, (a: any) => any> = {
        id: (a) => a.id,
        status: (a) => a.status,
        severity: (a) => a.policy?.severity,
        policyName: (a) => a.policy?.name,
        resourceName: (a) => a.resource?.name,
        resourceType: (a) => a.resource?.resourceType,
        cloudType: (a) => a.resource?.cloudType,
        accountName: (a) => a.resource?.accountName,
        alertTime: (a) => a.alertTime,
      };

      const fields = Object.keys(fieldExtractors)
        .slice(0, options.maxColumns)
        .filter(f => !options.excludePatterns.some(p => f.toLowerCase().includes(p.toLowerCase())));

      for (const fieldName of fields) {
        const extractor = fieldExtractors[fieldName];
        const values = alerts.map(extractor).filter((v: any) => v != null && v !== '');
        yield { assetExternalId, fieldName, values: values.slice(0, 100), totalSampled: values.length };
      }
    } catch (error: any) {
      this.logger.warn(`Prisma Cloud sampling failed: ${error.message}`);
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'prisma_cloud',
      displayName: 'Prisma Cloud',
      description: 'Connect to Prisma Cloud for cloud security posture and compliance discovery',
      authMethods: ['api_key'],
      requiredPermissions: [
        'Account Group Read Only',
        'Alert Read Only',
        'Policy Read Only',
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
