import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class PostureScorer {
  private readonly logger = new Logger(PostureScorer.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Calculate Posture Score
  // ---------------------------------------------------------------------------

  calculatePosture(testResults: {
    passed: number;
    failed: number;
    skipped: number;
  }): number | null {
    const total = testResults.passed + testResults.failed;

    if (total === 0) {
      return null;
    }

    const score = (testResults.passed / total) * 100;
    return Math.min(Math.round(score * 100) / 100, 100);
  }

  // ---------------------------------------------------------------------------
  // Calculate Category Scores
  // ---------------------------------------------------------------------------

  async calculateCategoryScores(
    tenantId: string,
  ): Promise<Record<string, number>> {
    const tests = await this.prisma.validationTest.findMany({
      where: { tenantId },
      select: {
        testCategory: true,
        lastResult: true,
      },
    });

    const categories: Record<string, { passed: number; total: number }> = {};

    for (const test of tests) {
      const category = test.testCategory;
      if (!categories[category]) {
        categories[category] = { passed: 0, total: 0 };
      }

      categories[category].total += 1;
      if (test.lastResult === 'passed') {
        categories[category].passed += 1;
      }
    }

    const scores: Record<string, number> = {};
    for (const [category, counts] of Object.entries(categories)) {
      scores[category] =
        counts.total > 0
          ? Math.round((counts.passed / counts.total) * 100 * 100) / 100
          : 0;
    }

    return scores;
  }
}
