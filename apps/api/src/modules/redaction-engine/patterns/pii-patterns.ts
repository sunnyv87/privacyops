/**
 * PII pattern library — additive, deterministic, no external dependencies.
 * Each entry has a type tag so the caller can decide per-category redaction.
 *
 * Regexes are crafted to avoid catastrophic backtracking and bounded in
 * length. Patterns are conservative — higher precision than recall — so
 * the engine does not over-redact the requesting subject's own data.
 */

export interface PiiPattern {
  type:
    | 'email'
    | 'phone'
    | 'ssn'
    | 'credit_card'
    | 'ipv4'
    | 'ipv6'
    | 'iban'
    | 'aadhaar'
    | 'pan'
    | 'passport'
    | 'national_id'
    | 'date_of_birth'
    | 'mac_address';
  regex: RegExp;
}

export const PII_PATTERNS: PiiPattern[] = [
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}\b/g },
  { type: 'phone', regex: /(?<!\d)(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g },
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', regex: /\b(?:\d[ -]?){13,19}\b/g },
  { type: 'ipv4', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'ipv6', regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
  { type: 'iban', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },
  { type: 'aadhaar', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { type: 'pan', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { type: 'passport', regex: /\b[A-PR-WY][0-9]{7}\b/g },
  { type: 'mac_address', regex: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
  { type: 'date_of_birth', regex: /\b(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/g },
];

/**
 * Luhn check — used to reduce false positives on credit_card matches.
 * Returns true if the digit string passes the Luhn algorithm.
 */
export function luhnCheck(digits: string): boolean {
  const cleaned = digits.replace(/[\s-]/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let d = parseInt(cleaned[i], 10);
    if (isNaN(d)) return false;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}
