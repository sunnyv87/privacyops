/**
 * Schema Heuristics Engine — Classifies data by column/field name patterns.
 * Uses heuristic matching against known sensitive data naming conventions.
 */

export interface SchemaHeuristicResult {
  labelName: string;
  confidence: number;
}

const COLUMN_PATTERNS: {
  pattern: RegExp;
  labelName: string;
  confidence: number;
}[] = [
  { pattern: /^e[-_]?mail$/i, labelName: 'Email Address', confidence: 0.95 },
  { pattern: /email[-_]?addr/i, labelName: 'Email Address', confidence: 0.90 },
  { pattern: /\bemail\b/i, labelName: 'Email Address', confidence: 0.80 },
  { pattern: /^phone$/i, labelName: 'Phone Number', confidence: 0.95 },
  { pattern: /phone[-_]?num/i, labelName: 'Phone Number', confidence: 0.90 },
  { pattern: /\bmobile\b/i, labelName: 'Phone Number', confidence: 0.80 },
  { pattern: /\bcell[-_]?phone\b/i, labelName: 'Phone Number', confidence: 0.85 },
  { pattern: /^ssn$/i, labelName: 'SSN', confidence: 0.95 },
  { pattern: /social[-_]?security/i, labelName: 'SSN', confidence: 0.95 },
  { pattern: /^dob$/i, labelName: 'Date of Birth', confidence: 0.90 },
  { pattern: /date[-_]?of[-_]?birth/i, labelName: 'Date of Birth', confidence: 0.95 },
  { pattern: /birth[-_]?date/i, labelName: 'Date of Birth', confidence: 0.90 },
  { pattern: /\baddress\b/i, labelName: 'Address', confidence: 0.80 },
  { pattern: /^addr$/i, labelName: 'Address', confidence: 0.85 },
  { pattern: /street[-_]?addr/i, labelName: 'Address', confidence: 0.90 },
  { pattern: /\bsalary\b/i, labelName: 'Salary', confidence: 0.90 },
  { pattern: /\bcompensation\b/i, labelName: 'Salary', confidence: 0.85 },
  { pattern: /\bwage\b/i, labelName: 'Salary', confidence: 0.80 },
  { pattern: /credit[-_]?card/i, labelName: 'Credit Card Number', confidence: 0.95 },
  { pattern: /\bcc[-_]?num/i, labelName: 'Credit Card Number', confidence: 0.90 },
  { pattern: /card[-_]?number/i, labelName: 'Credit Card Number', confidence: 0.85 },
  { pattern: /^password$/i, labelName: 'Password / Secret', confidence: 0.95 },
  { pattern: /\bpasswd\b/i, labelName: 'Password / Secret', confidence: 0.90 },
  { pattern: /\bpwd\b/i, labelName: 'Password / Secret', confidence: 0.80 },
  { pattern: /\bsecret\b/i, labelName: 'Password / Secret', confidence: 0.80 },
  { pattern: /api[-_]?key/i, labelName: 'API Key', confidence: 0.95 },
  { pattern: /\btoken\b/i, labelName: 'API Key', confidence: 0.70 },
  { pattern: /\baccess[-_]?key\b/i, labelName: 'API Key', confidence: 0.90 },
  { pattern: /\baadhaar\b/i, labelName: 'Aadhaar Number', confidence: 0.95 },
  { pattern: /\bpan[-_]?num/i, labelName: 'PAN Number', confidence: 0.90 },
  { pattern: /\bpassport\b/i, labelName: 'Passport Number', confidence: 0.85 },
  { pattern: /\bfirst[-_]?name\b/i, labelName: 'Full Name', confidence: 0.75 },
  { pattern: /\blast[-_]?name\b/i, labelName: 'Full Name', confidence: 0.75 },
  { pattern: /\bfull[-_]?name\b/i, labelName: 'Full Name', confidence: 0.90 },
  { pattern: /\bip[-_]?addr/i, labelName: 'IP Address', confidence: 0.90 },
  { pattern: /\bgender\b/i, labelName: 'Gender', confidence: 0.85 },
  { pattern: /\bethnicity\b/i, labelName: 'Ethnicity', confidence: 0.90 },
  { pattern: /\brace\b/i, labelName: 'Ethnicity', confidence: 0.70 },
  { pattern: /\bdiagnos/i, labelName: 'Medical Diagnosis', confidence: 0.85 },
  { pattern: /\bmedical/i, labelName: 'Medical Record', confidence: 0.75 },
  { pattern: /\bbank[-_]?account/i, labelName: 'Bank Account', confidence: 0.90 },
  { pattern: /\baccount[-_]?num/i, labelName: 'Bank Account', confidence: 0.75 },
  { pattern: /\brouting[-_]?num/i, labelName: 'Bank Routing Number', confidence: 0.90 },
];

export class SchemaHeuristicsEngine {
  /**
   * Classify a column by its name using heuristic pattern matching.
   * Returns the best matching label and confidence, or null if no match.
   */
  classifyByColumnName(name: string): SchemaHeuristicResult | null {
    const normalized = name.trim();
    let bestMatch: SchemaHeuristicResult | null = null;

    for (const entry of COLUMN_PATTERNS) {
      if (entry.pattern.test(normalized)) {
        if (!bestMatch || entry.confidence > bestMatch.confidence) {
          bestMatch = {
            labelName: entry.labelName,
            confidence: entry.confidence,
          };
        }
      }
    }

    return bestMatch;
  }
}
