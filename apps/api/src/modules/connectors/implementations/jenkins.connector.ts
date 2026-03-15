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
 * Jenkins connector using the Jenkins JSON API.
 * Discovers jobs, pipelines, and views. Retrieves build metadata.
 */
export class JenkinsConnector extends BaseRestApiConnector {
  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { username, apiToken, bearerToken } = config.credentials;

    if (bearerToken) {
      this.setupBearerAuth(bearerToken);
    } else if (username && apiToken) {
      this.setupBasicAuth(username, apiToken);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, port, protocol } = config.credentials;
    const proto = protocol || 'https';
    const portSuffix = port ? `:${port}` : '';
    this.baseUrl = `${proto}://${host}${portSuffix}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/api/json', {
        query: { tree: 'nodeDescription,numExecutors' },
      });
      return {
        success: true,
        message: `Connected to Jenkins: ${result.nodeDescription || 'controller'}`,
        metadata: { numExecutors: result.numExecutors },
      };
    } catch (error: any) {
      return { success: false, message: `Jenkins connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // List all jobs recursively
    yield* this.listJobsRecursive('/api/json', '');
  }

  private async *listJobsRecursive(
    apiPath: string,
    parentPath: string,
  ): AsyncGenerator<DiscoveredAsset> {
    try {
      const result = await this.request<any>('GET', apiPath, {
        query: { tree: 'jobs[name,url,_class,color,lastBuild[number,timestamp,result]]' },
      });

      for (const job of result.jobs || []) {
        const jobPath = parentPath ? `${parentPath}/${job.name}` : job.name;
        const isFolder = job._class?.includes('Folder') || job._class?.includes('OrganizationFolder');

        yield {
          externalId: `job:${jobPath}`,
          name: job.name,
          type: isFolder ? 'container' : 'pipeline',
          path: `jenkins/${jobPath}`,
          parentExternalId: parentPath ? `job:${parentPath}` : undefined,
          metadata: {
            class: job._class,
            color: job.color,
            lastBuildNumber: job.lastBuild?.number,
            lastBuildResult: job.lastBuild?.result,
            lastBuildTimestamp: job.lastBuild?.timestamp,
          },
        };

        // Recurse into folders
        if (isFolder) {
          const folderApi = `/job/${encodeURIComponent(job.name)}/api/json`;
          const fullApiPath = parentPath
            ? `${parentPath.split('/').map(p => `/job/${encodeURIComponent(p)}`).join('')}${folderApi}`
            : folderApi;
          yield* this.listJobsRecursive(fullApiPath, jobPath);
        }
      }
    } catch {}
  }

  async getAssetSchema(_assetExternalId: string): Promise<AssetSchema> {
    return { fields: [] };
  }

  // DevOps connectors: CI/CD jobs are not sampled for PII
  async *sampleContent(
    _assetExternalId: string,
    _options: SampleOptions,
  ): AsyncGenerator<ContentSample> {}

  getMetadata(): ConnectorMetadata {
    return {
      type: 'jenkins',
      displayName: 'Jenkins',
      description: 'Connect to Jenkins for job and pipeline discovery',
      authMethods: ['basic_auth', 'api_key'],
      requiredPermissions: [
        'Overall/Read',
        'Job/Read',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: false,
        supportsAccessAnalysis: false,
        supportsIncrementalScan: false,
        supportsEncryptionCheck: false,
      },
    };
  }
}
