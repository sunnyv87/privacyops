import { Injectable, Logger } from '@nestjs/common';

export interface MlClassificationResult {
  label: string;
  confidence: number;
}

@Injectable()
export class MlClassifierClient {
  private readonly logger = new Logger(MlClassifierClient.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ML_CLASSIFIER_URL || 'http://localhost:8501';
  }

  /**
   * Classify sample values using an external ML model service.
   * Falls back to empty results if the service is unavailable.
   */
  async classify(
    samples: string[],
    modelId: string,
  ): Promise<MlClassificationResult[]> {
    if (samples.length === 0) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples, modelId }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.warn(
          `ML classifier service returned ${response.status}: ${response.statusText}`,
        );
        return [];
      }

      const data = await response.json();

      if (!Array.isArray(data.results)) {
        this.logger.warn('ML classifier service returned unexpected response format');
        return [];
      }

      return data.results.map((r: any) => ({
        label: r.label,
        confidence: r.confidence,
      }));
    } catch (error) {
      this.logger.warn(
        `ML classifier service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to empty results.`,
      );
      return [];
    }
  }
}
