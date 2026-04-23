import { Inject, Injectable, Optional } from '@nestjs/common';
import { AIProvider, AI_PROVIDER } from './ai-providers/ai-provider.interface';

/**
 * NarrativeService — generates human-readable explanations for risk
 * findings, remediation plans, and attack paths. Tries the configured
 * AIProvider first; falls back to deterministic templates so every
 * caller ALWAYS gets a non-empty string.
 *
 * Consumers inject this service optionally. Existing risk / remediation
 * outputs are unchanged — narrative is a separate field if/when called.
 */
@Injectable()
export class NarrativeService {
  constructor(
    @Optional() @Inject(AI_PROVIDER) private readonly ai?: AIProvider,
  ) {}

  async explainRisk(finding: {
    id?: string;
    title?: string;
    severity?: string;
    score?: number;
    category?: string;
    entityName?: string;
    factors?: Record<string, unknown>;
  }): Promise<string> {
    if (this.ai?.isAvailable()) {
      const aiText = await this.ai.explain({ kind: 'risk_finding', record: finding });
      if (aiText) return aiText;
    }
    return this.templateRisk(finding);
  }

  async explainRemediation(plan: {
    id?: string;
    title?: string;
    findingId?: string;
    actions?: Array<{ type?: string; description?: string }>;
    confidence?: number;
    requiresApproval?: boolean;
  }): Promise<string> {
    if (this.ai?.isAvailable()) {
      const aiText = await this.ai.explain({ kind: 'remediation_plan', record: plan });
      if (aiText) return aiText;
    }
    return this.templateRemediation(plan);
  }

  async explainAttackPath(path: {
    id?: string;
    severity?: string;
    riskScore?: number;
    entryPoint?: string;
    target?: string;
    steps?: Array<{ description?: string }>;
  }): Promise<string> {
    if (this.ai?.isAvailable()) {
      const aiText = await this.ai.explain({ kind: 'attack_path', record: path });
      if (aiText) return aiText;
    }
    return this.templateAttackPath(path);
  }

  // ---------------------------------------------------------------
  // Deterministic fallbacks (always available, zero dependencies)
  // ---------------------------------------------------------------

  private templateRisk(f: Record<string, any>): string {
    const parts: string[] = [];
    if (f.title) parts.push(`Finding "${f.title}"`);
    if (f.entityName) parts.push(`on ${f.entityName}`);
    if (f.severity) parts.push(`is ${f.severity} severity`);
    if (typeof f.score === 'number') parts.push(`(score ${f.score})`);
    if (f.category) parts.push(`in the ${f.category} category`);
    return parts.length > 0
      ? parts.join(' ') + '. Review factors for mitigation priority.'
      : 'Risk finding detected; review factors to determine next action.';
  }

  private templateRemediation(p: Record<string, any>): string {
    const n = Array.isArray(p.actions) ? p.actions.length : 0;
    const approval = p.requiresApproval ? 'Approval required before execution.' : 'Auto-executable.';
    const conf = typeof p.confidence === 'number' ? ` Confidence ${Math.round(p.confidence * 100)}%.` : '';
    return `Remediation plan with ${n} action${n === 1 ? '' : 's'}. ${approval}${conf}`;
  }

  private templateAttackPath(p: Record<string, any>): string {
    const n = Array.isArray(p.steps) ? p.steps.length : 0;
    return `Attack path (${p.severity || 'unknown'} severity, score ${p.riskScore ?? '?'}) from ${p.entryPoint || 'unknown entry'} to ${p.target || 'unknown target'} in ${n} step${n === 1 ? '' : 's'}.`;
  }
}
