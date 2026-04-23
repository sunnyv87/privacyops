import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider } from './ai-provider.interface';

/**
 * ClaudeAIProvider — Anthropic adapter. Activated when ANTHROPIC_API_KEY
 * is set. Uses dynamic import so the @anthropic-ai/sdk dependency is
 * optional: missing SDK or missing key both degrade to `null` and the
 * Co-Pilot template path runs as before.
 *
 * This provider is deliberately thin: no retries, no streaming, no tool
 * use. It is an additive enrichment layer — if it ever fails, the
 * existing template response is still served to the user.
 */
@Injectable()
export class ClaudeAIProvider implements AIProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(ClaudeAIProvider.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private sdk: any = null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001');
    this.maxTokens = Number(this.config.get<string>('ANTHROPIC_MAX_TOKENS', '512'));
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async summarize(input: {
    intent: string;
    query: string;
    templateResponse: string;
    context: Record<string, unknown>;
  }): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const systemPrompt =
      'You are a privacy and data-security analyst co-pilot. Given a user query, a deterministic template response, and the supporting context, produce a one-paragraph narrative (max 90 words) that preserves every numeric claim from the template and adds interpretation. Never invent numbers.';
    const userPrompt =
      `Query: ${input.query}\n` +
      `Intent: ${input.intent}\n` +
      `Template response: ${input.templateResponse}\n` +
      `Context summary: ${this.summariseContext(input.context)}`;
    return this.callClaude(systemPrompt, userPrompt);
  }

  async explain(input: {
    kind: 'risk_finding' | 'remediation_plan' | 'attack_path' | 'generic';
    record: Record<string, unknown>;
    audience?: 'analyst' | 'executive' | 'subject';
  }): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const audience = input.audience ?? 'analyst';
    const systemPrompt =
      `You explain privacy and DSPM records to a ${audience}. Output a single paragraph of 40-70 words. Cite specific field values from the record. Never speculate beyond the fields given.`;
    const userPrompt =
      `Record kind: ${input.kind}\n` +
      `Record: ${JSON.stringify(input.record).slice(0, 4000)}`;
    return this.callClaude(systemPrompt, userPrompt);
  }

  private async callClaude(systemPrompt: string, userPrompt: string): Promise<string | null> {
    try {
      if (!this.sdk) {
        const mod = await import('@anthropic-ai/sdk').catch(() => null);
        if (!mod) {
          this.logger.debug('@anthropic-ai/sdk not installed; ClaudeAIProvider inert');
          return null;
        }
        const Anthropic = (mod as any).default ?? (mod as any).Anthropic;
        this.sdk = new Anthropic({ apiKey: this.apiKey });
      }
      const response = await this.sdk.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = response?.content?.[0];
      if (block && block.type === 'text' && typeof block.text === 'string') {
        return block.text.trim();
      }
      return null;
    } catch (err) {
      this.logger.warn(`Claude provider call failed: ${(err as Error).message}`);
      return null;
    }
  }

  private summariseContext(ctx: Record<string, unknown>): string {
    try {
      return JSON.stringify(ctx).slice(0, 2000);
    } catch {
      return '(unserializable)';
    }
  }
}
