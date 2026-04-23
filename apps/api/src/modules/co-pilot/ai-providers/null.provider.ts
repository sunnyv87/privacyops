import { Injectable } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';

/**
 * NullAIProvider — the default binding. Always returns `null` so the
 * Co-Pilot uses its existing template-based response path. Present so
 * DI always resolves, and so tests don't need network access.
 */
@Injectable()
export class NullAIProvider implements AIProvider {
  readonly name = 'null';
  isAvailable(): boolean {
    return false;
  }
  async summarize(): Promise<string | null> {
    return null;
  }
  async explain(): Promise<string | null> {
    return null;
  }
}
