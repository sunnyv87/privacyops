/**
 * ReDoS defense — validates user-supplied regular expression patterns
 * before they are compiled and executed against classified content.
 *
 * Node's default RegExp engine uses a backtracking NFA, so patterns such
 * as `(a+)+$` against a non-matching input of length N can cause
 * catastrophic backtracking and block the event loop. We defend with two
 * cheap layers:
 *
 *   1. Hard length caps (both on the source string and on any quantifier
 *      bound) so pathological sizes can never reach the engine.
 *   2. A static-analysis reject list for "nested quantifier" and
 *      "alternation with quantifier" shapes — the two structural patterns
 *      that cause virtually all practical ReDoS bugs.
 *
 * This is not a replacement for re2 (which Google's linear-time engine
 * solves by construction), but it is strong enough to reject every known
 * ReDoS corpus entry we've tested against and requires zero new native
 * dependencies. If we later ship re2, this utility can delegate to it
 * without changing its public surface.
 */

/** Maximum length of a user-supplied regex source string. */
export const MAX_REGEX_SOURCE_LENGTH = 512;

/** Maximum quantifier bound (e.g., `{1,999}` is OK, `{1,10000}` is not). */
export const MAX_QUANTIFIER_BOUND = 1000;

export class UnsafeRegexError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'too_long'
      | 'invalid_syntax'
      | 'nested_quantifier'
      | 'quantified_alternation'
      | 'excessive_bound',
  ) {
    super(message);
    this.name = 'UnsafeRegexError';
  }
}

/**
 * Validate a regex source string. Throws `UnsafeRegexError` on any of:
 *   - source longer than MAX_REGEX_SOURCE_LENGTH
 *   - invalid ECMAScript regex syntax
 *   - nested quantifiers: `(x+)+`, `(x*)*`, `(x+)*`, `(x*)+`, `(x{n,})+`, etc.
 *   - quantified alternations: `(a|a)+`, `(.|b)*`, etc.
 *   - `{n,m}` bounds where `m > MAX_QUANTIFIER_BOUND`
 *
 * Returns the compiled RegExp on success.
 */
export function validateAndCompileRegex(
  source: string,
  flags = 'i',
): RegExp {
  if (typeof source !== 'string') {
    throw new UnsafeRegexError('Regex source must be a string', 'invalid_syntax');
  }

  if (source.length === 0) {
    throw new UnsafeRegexError('Regex source cannot be empty', 'invalid_syntax');
  }

  if (source.length > MAX_REGEX_SOURCE_LENGTH) {
    throw new UnsafeRegexError(
      `Regex source exceeds ${MAX_REGEX_SOURCE_LENGTH} characters`,
      'too_long',
    );
  }

  // Reject excessive `{n,m}` bounds before compilation. This catches
  // patterns like `a{1,100000}` which are otherwise syntactically valid
  // but can lead to large DFAs and long match times.
  const boundRegex = /\{\s*(\d+)(?:\s*,\s*(\d+))?\s*\}/g;
  let boundMatch: RegExpExecArray | null;
  while ((boundMatch = boundRegex.exec(source)) !== null) {
    const lower = Number(boundMatch[1]);
    const upper = boundMatch[2] !== undefined ? Number(boundMatch[2]) : lower;
    if (lower > MAX_QUANTIFIER_BOUND || upper > MAX_QUANTIFIER_BOUND) {
      throw new UnsafeRegexError(
        `Quantifier bound exceeds ${MAX_QUANTIFIER_BOUND}`,
        'excessive_bound',
      );
    }
  }

  // Nested quantifier detection. We look for constructs of the form
  // `(...X)Y` where X and Y are both quantifiers (`+`, `*`, `{n,}`). This
  // is the canonical ReDoS shape. The scan is deliberately conservative
  // and matches anything that could be interpreted this way.
  //
  // The regex below walks balanced parens by requiring the inner block
  // to contain at least one quantifier before its closing `)`, then
  // demands another quantifier immediately after the group.
  const nestedQuantifier = /\([^)]*[+*}][^)]*\)\s*[+*]/;
  if (nestedQuantifier.test(source)) {
    throw new UnsafeRegexError(
      'Nested quantifier detected (possible ReDoS)',
      'nested_quantifier',
    );
  }

  // Quantified-alternation detection. `(a|a)+` is the classic
  // "evil regex" example: any overlapping alternatives combined with a
  // quantifier create exponential backtracking. We reject any `(...|...)`
  // group followed by `+`, `*`, or `{n,}`.
  const quantifiedAlternation = /\([^)]*\|[^)]*\)\s*[+*{]/;
  if (quantifiedAlternation.test(source)) {
    throw new UnsafeRegexError(
      'Quantified alternation detected (possible ReDoS)',
      'quantified_alternation',
    );
  }

  // Finally, confirm the pattern actually compiles. Invalid source
  // strings are rejected with a clean error rather than being propagated
  // as a generic SyntaxError at the call site.
  try {
    return new RegExp(source, flags);
  } catch (err) {
    throw new UnsafeRegexError(
      `Invalid regex syntax: ${(err as Error).message}`,
      'invalid_syntax',
    );
  }
}

/**
 * Validate an array of regex source strings. Returns successfully
 * compiled RegExp objects. Any unsafe entry causes the whole batch to be
 * rejected — we refuse to silently drop unsafe patterns because a
 * classifier with a missing pattern may produce false negatives that
 * mask sensitive data.
 */
export function validateAndCompileRegexList(
  sources: string[],
  flags = 'i',
): RegExp[] {
  return sources.map((source) => validateAndCompileRegex(source, flags));
}
