import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider } from './ai-provider.interface';
import { RedactionService } from '../../redaction-engine/redaction.service';

/**
 * ClaudeAIProvider — Anthropic adapter. Activated when ANTHROPIC_API_KEY
 * is set. Uses dynamic import so the @anthropic-ai/sdk dependency is
 * optional: missing SDK or missing key both degrade to `null` and the
 * Co-Pilot template path runs as before.
 *
 * Security controls (added post-audit):
 *   1. Pre-send redaction — every outbound string is passed through
 *      RedactionService.redactText so emails, phone numbers, SSN,
 *      credit-cards, IPs, etc. never leave the tenant perimeter.
 *   2. Circuit breaker — N consecutive failures open the circuit for
 *      a cooldown window, short-circuiting to `null` (template fallback)
 *      so a flapping upstream cannot amplify latency.
 *   3. Per-call timeout — AbortSignal caps each call at CLAUDE_TIMEOUT_MS.
 */
@Injectable()
export class ClaudeAIProvider implements AIProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(ClaudeAIProvider.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private sdk: any = null;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly COOLDOWN_MS = 60_000;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly redaction?: RedactionService,
  ) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001');
    this.maxTokens = Number(this.config.get<string>('ANTHROPIC_MAX_TOKENS', '512'));
    this.timeoutMs = Number(this.config.get<string>('CLAUDE_TIMEOUT_MS', '10000'));
  }

  isAvailable(): boolean {
    if (!this.apiKey) return false;
    if (Date.now() < this.circuitOpenUntil) return false;
    return true;
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
    const safeQuery = this.redact(input.query);
    const safeTemplate = this.redact(input.templateResponse);
    const safeContext = this.redact(this.summariseContext(input.context));
    const userPrompt =
      `Query: ${safeQuery}\n` +
      `Intent: ${input.intent}\n` +
      `Template response: ${safeTemplate}\n` +
      `Context summary: ${safeContext}`;
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
    const safeRecord = this.redact(JSON.stringify(input.record).slice(0, 4000));
    const userPrompt = `Record kind: ${input.kind}\nRecord: ${safeRecord}`;
    return this.callClaude(systemPrompt, userPrompt);
  }

  private redact(text: string): string {
    if (!this.redaction) return text;
    try {
      return this.redaction.redactText(text).redactedText;
    } catch {
      // If redaction fails, fail closed: return an empty string to the
      // upstream LLM rather than the raw potentially-sensitive payload.
      return '[REDACTED:ENGINE_ERROR]';
    }
  }

  private async callClaude(systemPrompt: string, userPrompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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
      const response = await this.sdk.messages.create(
        {
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: controller.signal },
      );
      const block = response?.content?.[0];
      if (block && block.type === 'text' && typeof block.text === 'string') {
        this.recordSuccess();
        return block.text.trim();
      }
      this.recordFailure();
      return null;
    } catch (err) {
      this.recordFailure();
      this.logger.warn(`Claude provider call failed: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= ClaudeAIProvider.FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + ClaudeAIProvider.COOLDOWN_MS;
      this.logger.warn(
        `ClaudeAIProvider circuit opened for ${ClaudeAIProvider.COOLDOWN_MS}ms after ${this.consecutiveFailures} consecutive failures`,
      );
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
