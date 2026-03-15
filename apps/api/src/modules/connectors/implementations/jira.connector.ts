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
 * Jira connector using the Jira Cloud REST API v3 / Jira Server REST API v2.
 * Discovers projects, issue types, custom fields, and boards.
 * Samples issue data via JQL search.
 */
export class JiraConnector extends BaseRestApiConnector {
  private isCloud: boolean = true;

  protected async setupAuth(config: ConnectorConfig): Promise<void> {
    const { email, apiToken, personalAccessToken, oauthToken } = config.credentials;

    if (oauthToken) {
      this.setupBearerAuth(oauthToken);
    } else if (personalAccessToken) {
      this.setupBearerAuth(personalAccessToken);
    } else if (email && apiToken) {
      // Jira Cloud: basic auth with email + API token
      this.setupBasicAuth(email, apiToken);
    }
  }

  protected async setupClient(config: ConnectorConfig): Promise<void> {
    const { host, isCloud } = config.credentials;
    this.isCloud = isCloud !== false;
    const apiVersion = this.isCloud ? '3' : '2';
    this.baseUrl = `https://${host}/rest/api/${apiVersion}`;
    this.paginationStyle = 'offset';
    this.defaultPageSize = 50;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const result = await this.request<any>('GET', '/myself');
      return {
        success: true,
        message: `Connected as ${result.displayName || result.name}`,
        metadata: {
          accountId: result.accountId,
          emailAddress: result.emailAddress,
        },
      };
    } catch (error: any) {
      return { success: false, message: `Jira connection failed: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {}

  async *listAssets(): AsyncGenerator<DiscoveredAsset> {
    // Discover projects
    let startAt = 0;
    while (true) {
      try {
        const result = await this.request<any>('GET', '/project/search', {
          query: { startAt, maxResults: 50 },
        });

        const projects = result.values || [];
        if (projects.length === 0) break;

        for (const project of projects) {
          yield {
            externalId: `project:${project.key}`,
            name: project.name,
            type: 'project',
            path: `jira/projects/${project.key}`,
            metadata: {
              key: project.key,
              projectTypeKey: project.projectTypeKey,
              style: project.style,
              isPrivate: project.isPrivate,
            },
          };
        }

        if (result.isLast || projects.length < 50) break;
        startAt += projects.length;
      } catch {
        break;
      }
    }

    // Discover custom fields (potential PII containers)
    try {
      const fields = await this.request<any[]>('GET', '/field');
      for (const field of fields || []) {
        if (field.custom) {
          yield {
            externalId: `field:${field.id}`,
            name: field.name,
            type: 'api_endpoint',
            path: `jira/fields/${field.id}`,
            metadata: {
              type: field.schema?.type,
              custom: true,
              customType: field.schema?.custom,
            },
          };
        }
      }
    } catch {}

    // Discover issue types
    try {
      const issueTypes = await this.request<any[]>('GET', '/issuetype');
      for (const it of issueTypes || []) {
        yield {
          externalId: `issuetype:${it.id}`,
          name: it.name,
          type: 'container',
          path: `jira/issuetypes/${it.id}`,
          metadata: {
            subtask: it.subtask,
            description: it.description,
          },
        };
      }
    } catch {}
  }

  async getAssetSchema(assetExternalId: string): Promise<AssetSchema> {
    const [type] = assetExternalId.split(':');

    if (type === 'project') {
      return {
        fields: [
          { name: 'key', dataType: 'string', ordinalPosition: 0, nullable: false },
          { name: 'summary', dataType: 'string', ordinalPosition: 1, nullable: false },
          { name: 'description', dataType: 'string', ordinalPosition: 2, nullable: true },
          { name: 'issuetype.name', dataType: 'string', ordinalPosition: 3, nullable: false },
          { name: 'status.name', dataType: 'string', ordinalPosition: 4, nullable: false },
          { name: 'priority.name', dataType: 'string', ordinalPosition: 5, nullable: true },
          { name: 'assignee.displayName', dataType: 'string', ordinalPosition: 6, nullable: true },
          { name: 'assignee.emailAddress', dataType: 'string', ordinalPosition: 7, nullable: true },
          { name: 'reporter.displayName', dataType: 'string', ordinalPosition: 8, nullable: true },
          { name: 'reporter.emailAddress', dataType: 'string', ordinalPosition: 9, nullable: true },
          { name: 'created', dataType: 'datetime', ordinalPosition: 10, nullable: false },
          { name: 'updated', dataType: 'datetime', ordinalPosition: 11, nullable: false },
          { name: 'labels', dataType: 'array', ordinalPosition: 12, nullable: true },
        ],
      };
    }

    return { fields: [] };
  }

  async *sampleContent(
    assetExternalId: string,
    options: SampleOptions,
  ): AsyncGenerator<ContentSample> {
    const [type, projectKey] = assetExternalId.split(':');
    if (type !== 'project') return;

    try {
      const jql = `project = "${projectKey}" ORDER BY updated DESC`;
      const result = await this.request<any>('POST', '/search', {
        body: {
          jql,
          maxResults: Math.min(options.maxRows, 100),
          fields: [
            'summary', 'description', 'issuetype', 'status',
            'priority', 'assignee', 'reporter', 'created', 'updated', 'labels',
          ],
        },
      });

      const issues = result.issues || [];
      if (issues.length === 0) return;

      const fieldExtractors: Record<string, (issue: any) => any> = {
        key: (i) => i.key,
        summary: (i) => i.fields?.summary,
        description: (i) => typeof i.fields?.description === 'string'
          ? i.fields.description.substring(0, 200)
          : i.fields?.description?.content?.[0]?.content?.[0]?.text?.substring(0, 200),
        'issuetype.name': (i) => i.fields?.issuetype?.name,
        'status.name': (i) => i.fields?.status?.name,
        'priority.name': (i) => i.fields?.priority?.name,
        'assignee.displayName': (i) => i.fields?.assignee?.displayName,
        'assignee.emailAddress': (i) => i.fields?.assignee?.emailAddress,
        'reporter.displayName': (i) => i.fields?.reporter?.displayName,
        'reporter.emailAddress': (i) => i.fields?.reporter?.emailAddress,
        created: (i) => i.fields?.created,
        updated: (i) => i.fields?.updated,
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
      this.logger.warn(`Jira sampling failed for ${projectKey}: ${error.message}`);
    }
  }

  async getAccessPolicies(assetExternalId: string): Promise<AccessPolicy[]> {
    const [type, projectKey] = assetExternalId.split(':');
    if (type !== 'project') return [];

    const policies: AccessPolicy[] = [];

    try {
      const roles = await this.request<any>('GET', `/project/${projectKey}/role`);
      for (const [roleName, roleUrl] of Object.entries(roles || {})) {
        try {
          // Fetch role details to get actors
          const roleId = (roleUrl as string).split('/').pop();
          const roleData = await this.request<any>('GET', `/project/${projectKey}/role/${roleId}`);

          for (const actor of roleData.actors || []) {
            policies.push({
              principal: actor.displayName || actor.name || 'unknown',
              principalType: actor.type === 'atlassian-group-role-actor' ? 'group' : 'user',
              permissions: [roleName],
              source: 'jira_project_roles',
            });
          }
        } catch {}
      }
    } catch {}

    return policies;
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'jira',
      displayName: 'Jira',
      description: 'Connect to Jira Cloud/Server for project, issue, and field discovery',
      authMethods: ['api_key', 'pat', 'oauth2'],
      requiredPermissions: [
        'Browse projects',
        'read:jira-work',
        'read:jira-user',
      ],
      capabilities: {
        supportsDiscovery: true,
        supportsContentSampling: true,
        supportsAccessAnalysis: true,
        supportsIncrementalScan: true,
        supportsEncryptionCheck: false,
      },
    };
  }
}
