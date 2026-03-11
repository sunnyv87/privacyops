import { Injectable, Logger } from '@nestjs/common';

interface InterpretedQuery {
  intent: string;
  entities: string[];
  filters: Record<string, any>;
  timeRange?: { start: string; end: string };
}

const INTENT_KEYWORDS: Record<string, string[]> = {
  risk_query: ['risk', 'exposure', 'score', 'threat', 'vulnerability'],
  data_location: ['where', 'located', 'stored', 'location', 'reside'],
  compliance_check: ['compliance', 'regulation', 'gdpr', 'ccpa', 'hipaa', 'compliant'],
  lineage_trace: ['lineage', 'flow', 'upstream', 'downstream', 'trace', 'origin'],
  access_audit: ['access', 'who', 'permission', 'permissions', 'identity', 'privilege'],
  remediation_advice: ['fix', 'remediate', 'resolve', 'mitigate', 'action', 'recommendation'],
  attack_path: ['attack', 'path', 'exploit', 'breach', 'lateral'],
  vendor_risk: ['vendor', 'third-party', 'supplier', 'partner', 'external'],
};

@Injectable()
export class QueryInterpreterService {
  private readonly logger = new Logger(QueryInterpreterService.name);

  async interpret(query: string): Promise<InterpretedQuery> {
    const lowerQuery = query.toLowerCase();

    // Detect intent via keyword matching
    let detectedIntent = 'general_summary';
    let maxMatches = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const matches = keywords.filter((kw) => lowerQuery.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedIntent = intent;
      }
    }

    // Extract entities (quoted strings or capitalized words that could be names)
    const entities: string[] = [];
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      entities.push(...quotedMatches.map((m) => m.replace(/"/g, '')));
    }

    // Extract filters from common patterns
    const filters: Record<string, any> = {};

    const severityMatch = lowerQuery.match(/\b(critical|high|medium|low)\b/);
    if (severityMatch) {
      filters.severity = severityMatch[1];
    }

    const statusMatch = lowerQuery.match(/\b(open|closed|resolved|active|inactive)\b/);
    if (statusMatch) {
      filters.status = statusMatch[1];
    }

    const limitMatch = lowerQuery.match(/\btop\s+(\d+)\b/);
    if (limitMatch) {
      filters.limit = parseInt(limitMatch[1], 10);
    }

    // Extract time range hints
    let timeRange: { start: string; end: string } | undefined;

    const daysMatch = lowerQuery.match(/last\s+(\d+)\s+days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      timeRange = { start: start.toISOString(), end: end.toISOString() };
    }

    const weeksMatch = lowerQuery.match(/last\s+(\d+)\s+weeks?/);
    if (!timeRange && weeksMatch) {
      const weeks = parseInt(weeksMatch[1], 10);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - weeks * 7);
      timeRange = { start: start.toISOString(), end: end.toISOString() };
    }

    this.logger.debug(
      `Interpreted query: intent=${detectedIntent}, entities=${entities.length}, filters=${JSON.stringify(filters)}`,
    );

    return {
      intent: detectedIntent,
      entities,
      filters,
      ...(timeRange && { timeRange }),
    };
  }
}
