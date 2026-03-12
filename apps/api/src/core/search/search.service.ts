import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      node: this.config.get('OPENSEARCH_URL', 'http://localhost:9200'),
    });
  }

  async onModuleInit() {
    try {
      const info = await this.client.info();
      this.logger.log(`OpenSearch connected: ${info.body.version.number}`);
    } catch (error) {
      this.logger.warn('OpenSearch connection failed:', error);
    }
  }

  async index(indexName: string, id: string, document: any): Promise<void> {
    await this.client.index({
      index: indexName,
      id,
      body: document,
      refresh: false,
    });
  }

  /**
   * Bulk index multiple documents in a single request.
   * Significantly faster than individual index() calls for batch operations.
   */
  async bulkIndex(
    indexName: string,
    documents: { id: string; body: any }[],
  ): Promise<{ indexed: number; errors: number }> {
    if (documents.length === 0) return { indexed: 0, errors: 0 };

    const bulkBody = documents.flatMap((doc) => [
      { index: { _index: indexName, _id: doc.id } },
      doc.body,
    ]);

    const result = await this.client.bulk({ body: bulkBody, refresh: false });

    let errors = 0;
    if (result.body.errors) {
      for (const item of result.body.items) {
        if (item.index?.error) {
          this.logger.warn(
            `Bulk index error for ${item.index._id}: ${item.index.error.reason}`,
          );
          errors++;
        }
      }
    }

    return { indexed: documents.length - errors, errors };
  }

  /**
   * Explicitly refresh an index to make recent writes searchable.
   * Call this after bulk operations instead of refreshing per-document.
   */
  async refresh(indexName: string): Promise<void> {
    await this.client.indices.refresh({ index: indexName });
  }

  async search(
    indexName: string,
    query: any,
    options?: { from?: number; size?: number; sort?: any },
  ) {
    const result = await this.client.search({
      index: indexName,
      body: {
        query,
        from: options?.from || 0,
        size: options?.size || 20,
        sort: options?.sort,
      },
    });

    return {
      hits: result.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
      total: result.body.hits.total.value,
    };
  }

  async delete(indexName: string, id: string): Promise<void> {
    await this.client.delete({ index: indexName, id });
  }
}
