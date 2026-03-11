/**
 * Classification Engine — Core classifier that applies regex, dictionary,
 * and context-based pattern matching to detect sensitive data.
 */

export interface ClassificationPattern {
  labelId: string;
  labelName: string;
  category: string;
  sensitivityLevel: number;
  regexPatterns: RegExp[];
  keywords: string[];
}

export interface ClassificationResult {
  labelId: string;
  labelName: string;
  confidence: number;
  method: 'regex' | 'dictionary' | 'context' | 'ml';
  matchedPattern?: string;
  sampleMatchCount: number;
}

export class Classifier {
  private patterns: ClassificationPattern[] = [];

  loadPatterns(patterns: ClassificationPattern[]): void {
    this.patterns = patterns;
  }

  /**
   * Classify a column/field based on its name, data type, and sample values.
   * Returns all matching classifications sorted by confidence (highest first).
   */
  classify(input: {
    fieldName: string;
    dataType?: string;
    sampleValues: any[];
    tableName?: string;
  }): ClassificationResult[] {
    const results: ClassificationResult[] = [];
    const normalizedFieldName = input.fieldName.toLowerCase().replace(/[_-]/g, '');

    for (const pattern of this.patterns) {
      let bestResult: ClassificationResult | null = null;

      // 1. Regex matching against sample values
      if (pattern.regexPatterns.length > 0 && input.sampleValues.length > 0) {
        let matchCount = 0;
        let matchedPattern = '';

        for (const regex of pattern.regexPatterns) {
          const matches = input.sampleValues.filter((v) =>
            v !== null && v !== undefined && regex.test(String(v)),
          );
          if (matches.length > matchCount) {
            matchCount = matches.length;
            matchedPattern = regex.source;
          }
        }

        if (matchCount > 0) {
          const confidence = Math.min(
            0.95,
            (matchCount / input.sampleValues.length) * 1.2,
          );
          bestResult = {
            labelId: pattern.labelId,
            labelName: pattern.labelName,
            confidence,
            method: 'regex',
            matchedPattern,
            sampleMatchCount: matchCount,
          };
        }
      }

      // 2. Keyword matching against field name
      if (pattern.keywords.length > 0) {
        const keywordMatch = pattern.keywords.some((kw) =>
          normalizedFieldName.includes(kw.toLowerCase().replace(/[_-]/g, '')),
        );

        if (keywordMatch) {
          const contextConfidence = 0.7; // Field name match alone = 70% confidence
          if (!bestResult || contextConfidence > bestResult.confidence) {
            bestResult = {
              labelId: pattern.labelId,
              labelName: pattern.labelName,
              confidence: contextConfidence,
              method: 'dictionary',
              matchedPattern: `keyword:${pattern.keywords.find((kw) =>
                normalizedFieldName.includes(kw.toLowerCase().replace(/[_-]/g, '')),
              )}`,
              sampleMatchCount: 0,
            };
          }

          // Boost confidence if both keyword AND regex match
          if (bestResult && bestResult.method === 'regex') {
            bestResult.confidence = Math.min(0.99, bestResult.confidence + 0.15);
            bestResult.method = 'context' as any;
          }
        }
      }

      if (bestResult) {
        results.push(bestResult);
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect toxic combinations in a set of classification results for an asset.
   * Returns warnings when dangerous data combinations are found.
   */
  detectToxicCombinations(
    assetClassifications: { labelName: string; category: string }[],
  ): string[] {
    const warnings: string[] = [];
    const categories = new Set(assetClassifications.map((c) => c.category));
    const labels = new Set(assetClassifications.map((c) => c.labelName));

    // PII + Financial = Identity theft risk
    if (categories.has('pii') && categories.has('pfi')) {
      warnings.push(
        'TOXIC_COMBINATION: PII and Financial data coexist in the same asset. ' +
        'This creates identity theft risk. Consider data segregation.',
      );
    }

    // Health + Employment = Discrimination risk
    if (categories.has('phi') && labels.has('Full Name')) {
      warnings.push(
        'TOXIC_COMBINATION: Health data with identifiable information. ' +
        'Consider pseudonymization or data segregation.',
      );
    }

    // Aadhaar + Financial + Contact = Comprehensive identity risk
    if (labels.has('Aadhaar Number') && categories.has('pfi')) {
      warnings.push(
        'TOXIC_COMBINATION: Aadhaar Number with Financial data. ' +
        'High identity fraud risk. Requires strict access controls and encryption.',
      );
    }

    // Credentials + PII = Breach amplification
    if (labels.has('Password / Secret') && categories.has('pii')) {
      warnings.push(
        'TOXIC_COMBINATION: Credentials stored alongside PII. ' +
        'Credential compromise leads to PII exposure. Separate storage required.',
      );
    }

    return warnings;
  }
}
