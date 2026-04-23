import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

export interface IdentityMatchQuery {
  email?: string;
  name?: string;
  phone?: string;
  externalId?: string;
}

export interface IdentityMatchCandidate {
  dataSubjectId: string;
  score: number; // 0.0 - 1.0
  factors: {
    emailExact?: boolean;
    emailLocal?: number;
    emailDomain?: boolean;
    nameTokenOverlap?: number;
    levenshteinName?: number;
    phoneExact?: boolean;
    externalIdExact?: boolean;
  };
  attributes: Record<string, unknown>;
}

/**
 * IdentityMatcherService — additive fuzzy match on top of the existing
 * exact-email-hash lookup used by `DsarService.findOrCreateDataSubject`.
 *
 * IMPORTANT: This service is NEW and PURELY ADDITIVE. The existing
 * DSAR create path still calls the deterministic `findOrCreateDataSubject`
 * exactly as before. This matcher surfaces *candidates* (e.g. for
 * a human reviewer or an automated linking step) — it never overrides
 * an existing exact match.
 */
@Injectable()
export class IdentityMatcherService {
  private readonly logger = new Logger(IdentityMatcherService.name);

  private static readonly MIN_SCORE_TO_RETURN = 0.35;
  private static readonly MAX_CANDIDATES_SCANNED = 5000;
  private static readonly DEFAULT_TOP_K = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search the tenant's DataSubject table for candidates matching the
   * supplied query attributes. Returns the top-K by score above
   * MIN_SCORE_TO_RETURN. Never throws — returns `[]` on error.
   */
  async findMatchingDataSubjects(
    tenantId: string,
    query: IdentityMatchQuery,
    options: { topK?: number; minScore?: number } = {},
  ): Promise<IdentityMatchCandidate[]> {
    const topK = options.topK ?? IdentityMatcherService.DEFAULT_TOP_K;
    const minScore = options.minScore ?? IdentityMatcherService.MIN_SCORE_TO_RETURN;

    try {
      // Pull a bounded set of subjects. For tenants with huge subject
      // tables this is scan-bounded; callers should supply an email
      // domain hint to narrow the set further in future iterations.
      const subjects = await this.prisma.dataSubject.findMany({
        where: { tenantId, status: 'active' },
        take: IdentityMatcherService.MAX_CANDIDATES_SCANNED,
        select: { id: true, identityAttributes: true, emailHash: true },
      });

      const results: IdentityMatchCandidate[] = [];
      for (const subject of subjects) {
        const attrs = (subject.identityAttributes as Record<string, unknown>) || {};
        const { score, factors } = this.scoreMatch(query, attrs);
        if (score >= minScore) {
          results.push({
            dataSubjectId: subject.id,
            score,
            factors,
            attributes: attrs,
          });
        }
      }
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    } catch (err) {
      this.logger.warn(
        `IdentityMatcher.findMatchingDataSubjects failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Score a candidate against a query. Weighted blend of:
   *   - email exact (0.50)
   *   - email local-part similarity (up to 0.30)
   *   - email domain equality (0.10)
   *   - phone exact (0.25)
   *   - externalId exact (0.40)
   *   - name token overlap + Levenshtein (up to 0.35)
   * The returned score is capped at 1.0.
   */
  scoreMatch(
    query: IdentityMatchQuery,
    candidate: Record<string, unknown>,
  ): { score: number; factors: IdentityMatchCandidate['factors'] } {
    const factors: IdentityMatchCandidate['factors'] = {};
    let score = 0;

    const qEmail = (query.email || '').toLowerCase().trim();
    const cEmail = (String(candidate.email || '') || '').toLowerCase().trim();
    if (qEmail && cEmail) {
      if (qEmail === cEmail) {
        factors.emailExact = true;
        score += 0.5;
      } else {
        const [qLocal, qDomain] = qEmail.split('@');
        const [cLocal, cDomain] = cEmail.split('@');
        if (qDomain && cDomain && qDomain === cDomain) {
          factors.emailDomain = true;
          score += 0.1;
        }
        if (qLocal && cLocal) {
          const localSim = 1 - this.normalizedLevenshtein(qLocal, cLocal);
          factors.emailLocal = +localSim.toFixed(3);
          score += Math.max(0, localSim) * 0.3;
        }
      }
    }

    const qPhone = this.normalizePhone(query.phone);
    const cPhone = this.normalizePhone(String(candidate.phone || ''));
    if (qPhone && cPhone && qPhone === cPhone) {
      factors.phoneExact = true;
      score += 0.25;
    }

    const qExt = (query.externalId || '').trim();
    const cExt = String(candidate.externalId || '').trim();
    if (qExt && cExt && qExt === cExt) {
      factors.externalIdExact = true;
      score += 0.4;
    }

    const qName = (query.name || '').toLowerCase().trim();
    const cName = String(candidate.name || '').toLowerCase().trim();
    if (qName && cName) {
      const tokenOverlap = this.tokenOverlap(qName, cName);
      factors.nameTokenOverlap = +tokenOverlap.toFixed(3);
      const lev = 1 - this.normalizedLevenshtein(qName, cName);
      factors.levenshteinName = +lev.toFixed(3);
      // Weighted blend: token overlap dominates for multi-word names,
      // levenshtein dominates for single-word or typo cases.
      score += Math.max(tokenOverlap, lev * 0.85) * 0.35;
    }

    return { score: Math.min(1, score), factors };
  }

  // ---------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------

  private normalizePhone(p?: string): string {
    if (!p) return '';
    return p.replace(/[^0-9]/g, '').replace(/^0+/, '');
  }

  private tokenOverlap(a: string, b: string): number {
    const aTok = new Set(a.split(/\s+/).filter((t) => t.length > 1));
    const bTok = new Set(b.split(/\s+/).filter((t) => t.length > 1));
    if (aTok.size === 0 || bTok.size === 0) return 0;
    let overlap = 0;
    for (const t of aTok) if (bTok.has(t)) overlap++;
    return overlap / Math.max(aTok.size, bTok.size);
  }

  /**
   * Levenshtein distance normalized to [0, 1]. 0 = identical, 1 = no
   * common characters. Capped iteration length to prevent CPU blow-up
   * on pathological input.
   */
  private normalizedLevenshtein(a: string, b: string): number {
    const MAX_LEN = 128;
    const s1 = a.slice(0, MAX_LEN);
    const s2 = b.slice(0, MAX_LEN);
    if (s1.length === 0 && s2.length === 0) return 0;
    if (s1.length === 0 || s2.length === 0) return 1;

    const prev = new Array<number>(s2.length + 1);
    const curr = new Array<number>(s2.length + 1);
    for (let j = 0; j <= s2.length; j++) prev[j] = j;

    for (let i = 1; i <= s1.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= s2.length; j++) prev[j] = curr[j];
    }
    const distance = prev[s2.length];
    return distance / Math.max(s1.length, s2.length);
  }
}
