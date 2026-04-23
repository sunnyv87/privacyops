import { Injectable, Logger } from '@nestjs/common';
import {
  PII_PATTERNS,
  luhnCheck,
  PiiPattern,
} from './patterns/pii-patterns';
import { RedactionMatch, RedactionResult } from './dto/redaction.dto';

/**
 * Deterministic PII redaction engine. Used for DSAR response packages
 * to remove third-party personal data before the package is delivered
 * to the requesting subject.
 *
 * Non-destructive: never mutates the input; returns a new string.
 * Preservation list allows the DSAR caller to pass the subject's OWN
 * identifiers so they are not masked in their own data export.
 */
@Injectable()
export class RedactionService {
  private readonly logger = new Logger(RedactionService.name);

  private static readonly MAX_INPUT_LENGTH = 5_000_000; // 5 MB text cap

  redactText(
    text: string,
    options: { preserve?: string[]; categories?: string[] } = {},
  ): RedactionResult {
    if (typeof text !== 'string') {
      return { redactedText: '', matches: [], categoriesFound: {} };
    }
    if (text.length > RedactionService.MAX_INPUT_LENGTH) {
      this.logger.warn(
        `RedactionService input truncated from ${text.length} to ${RedactionService.MAX_INPUT_LENGTH}`,
      );
      text = text.slice(0, RedactionService.MAX_INPUT_LENGTH);
    }

    const preserveSet = new Set((options.preserve || []).map((s) => s.toLowerCase()));
    const categoryFilter =
      options.categories && options.categories.length > 0
        ? new Set(options.categories)
        : null;

    const matches: RedactionMatch[] = [];
    const categoriesFound: Record<string, number> = {};

    for (const pattern of PII_PATTERNS) {
      if (categoryFilter && !categoryFilter.has(pattern.type)) continue;
      this.collectMatches(text, pattern, preserveSet, matches, categoriesFound);
    }

    // Apply replacements from right-to-left so indices remain valid.
    matches.sort((a, b) => b.start - a.start);
    let redactedText = text;
    for (const m of matches) {
      redactedText =
        redactedText.slice(0, m.start) + m.replacement + redactedText.slice(m.end);
    }

    return { redactedText, matches, categoriesFound };
  }

  /**
   * Recursively redact PII inside an arbitrary JSON-serializable structure.
   * Strings are redacted in-place; numbers / booleans / null passed through.
   * Keys are NOT redacted — only values.
   */
  redactJson(
    data: unknown,
    options: { preserve?: string[]; categories?: string[] } = {},
  ): { data: unknown; totalMatches: number } {
    let totalMatches = 0;
    const walk = (value: unknown): unknown => {
      if (value === null || value === undefined) return value;
      if (typeof value === 'string') {
        const result = this.redactText(value, options);
        totalMatches += result.matches.length;
        return result.redactedText;
      }
      if (Array.isArray(value)) return value.map(walk);
      if (typeof value === 'object') {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          clean[k] = walk(v);
        }
        return clean;
      }
      return value;
    };
    return { data: walk(data), totalMatches };
  }

  private collectMatches(
    text: string,
    pattern: PiiPattern,
    preserveSet: Set<string>,
    matches: RedactionMatch[],
    categoriesFound: Record<string, number>,
  ): void {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const original = m[0];
      const lower = original.toLowerCase();
      if (preserveSet.has(lower)) continue;

      // Extra validation for credit_card: require Luhn
      if (pattern.type === 'credit_card' && !luhnCheck(original)) continue;

      const start = m.index;
      const end = m.index + original.length;
      const overlapping = matches.some(
        (existing) => !(end <= existing.start || start >= existing.end),
      );
      if (overlapping) continue;

      matches.push({
        type: pattern.type,
        start,
        end,
        original,
        replacement: this.replacementFor(pattern.type),
      });
      categoriesFound[pattern.type] = (categoriesFound[pattern.type] || 0) + 1;
    }
  }

  private replacementFor(type: string): string {
    return `[REDACTED:${type.toUpperCase()}]`;
  }
}
