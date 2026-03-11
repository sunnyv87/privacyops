import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      node: this.config.get('OPENSEARCH_URL', 'http://localhost:9200'),
    });
  }

  async onModuleInit() {
    try {
      const info = await this.client.info();
      console.log('OpenSearch connected:', info.body.version.number);
    } catch (error) {
      console.warn('OpenSearch connection failed:', error);
    }
  }

  async index(indexName: string, id: string, document: any): Promise<void> {
    await this.client.index({
      index: indexName,
      id,
      body: document,
      refresh: true,
    });
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
