/**
 * AIProvider — optional enrichment layer for the Co-Pilot. Implementations
 * may back out to `null` at any time, in which case the Co-Pilot falls
 * back to its existing deterministic template responses.
 *
 * Contract:
 *   - `summarize()` is called AFTER the template response has been built;
 *     it may return a richer version or `null` (keep template).
 *   - `explain()` turns a structured record into a narrative paragraph.
 *
 * Zero side-effects allowed: providers may NOT write to the DB, emit
 * events, or persist conversation state.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Return true if the provider is actually wired up (e.g., API key set).
   * The Co-Pilot skips invocation when this is false to avoid latency.
   */
  isAvailable(): boolean;

  /**
   * Produce a narrative summary for a Co-Pilot response given the
   * interpreted intent and assembled context. Return `null` to defer
   * to the template fallback.
   */
  summarize(input: {
    intent: string;
    query: string;
    templateResponse: string;
    context: Record<string, unknown>;
  }): Promise<string | null>;

  /**
   * Turn an arbitrary structured record (finding, remediation plan,
   * attack path, etc.) into a short explanation. Return `null` on
   * failure or when the provider is not available.
   */
  explain(input: {
    kind: 'risk_finding' | 'remediation_plan' | 'attack_path' | 'generic';
    record: Record<string, unknown>;
    audience?: 'analyst' | 'executive' | 'subject';
  }): Promise<string | null>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
