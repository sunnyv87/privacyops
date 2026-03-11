import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

@Injectable()
export class RiskIntelligenceService {
  private readonly logger = new Logger(RiskIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async generatePredictions(tenantId: string) {
    const profiles = await this.prisma.entityRiskProfile.findMany({
      where: { tenantId },
    });

    this.logger.log(
      `Generating predictions for ${profiles.length} entity risk profiles in tenant ${tenantId}`,
    );

    let created = 0;

    for (const profile of profiles) {
      const breakdown = profile.scoreBreakdown as Record<string, any>;
      const history = Array.isArray(breakdown?.history)
        ? (breakdown.history as number[])
        : [Number(profile.compositeScore)];

      // Compute linear trend from score history
      const n = history.length;
      const xMean = (n - 1) / 2;
      const yMean = history.reduce((sum, v) => sum + v, 0) / n;

      let slope = 0;
      if (n > 1) {
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
          numerator += (i - xMean) * (history[i] - yMean);
          denominator += (i - xMean) * (i - xMean);
        }
        slope = denominator !== 0 ? numerator / denominator : 0;
      }

      // Predict 30 days out (assuming each data point is ~1 day)
      const predictedScore = Math.max(
        0,
        Math.min(100, yMean + slope * 30),
      );

      // Confidence based on data points count (min 0.3, max 0.95)
      const confidence = Math.min(0.95, Math.max(0.3, 0.3 + (n / 50) * 0.65));

      const drivers: Record<string, unknown>[] = [];
      if (slope > 0.5) {
        drivers.push({ factor: 'increasing_trend', slope, impact: 'risk_growing' });
      } else if (slope < -0.5) {
        drivers.push({ factor: 'decreasing_trend', slope, impact: 'risk_declining' });
      } else {
        drivers.push({ factor: 'stable_trend', slope, impact: 'no_significant_change' });
      }

      // Supersede existing active predictions for this entity
      await this.prisma.riskPrediction.updateMany({
        where: {
          tenantId,
          entityType: profile.entityType,
          entityId: profile.entityId,
          status: 'active',
        },
        data: { status: 'superseded' },
      });

      await this.prisma.riskPrediction.create({
        data: {
          tenantId,
          entityType: profile.entityType,
          entityId: profile.entityId,
          currentScore: profile.compositeScore,
          predictedScore,
          predictedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          confidence,
          drivers,
          status: 'active',
        },
      });

      // Update profile with predicted score and trend direction
      const trendDirection =
        slope > 0.5 ? 'increasing' : slope < -0.5 ? 'decreasing' : 'stable';

      await this.prisma.entityRiskProfile.update({
        where: { id: profile.id },
        data: {
          predictedScore,
          predictionDrivers: drivers,
          trendDirection,
        },
      });

      created++;
    }

    this.logger.log(
      `Generated ${created} predictions for tenant ${tenantId}`,
    );

    return { created, total: profiles.length };
  }

  async detectAnomalies(tenantId: string) {
    const profiles = await this.prisma.entityRiskProfile.findMany({
      where: { tenantId },
    });

    let detected = 0;

    for (const profile of profiles) {
      // Get the last 10 predictions for this entity
      const predictions = await this.prisma.riskPrediction.findMany({
        where: {
          tenantId,
          entityType: profile.entityType,
          entityId: profile.entityId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (predictions.length === 0) continue;

      const meanPredicted =
        predictions.reduce((sum, p) => sum + Number(p.predictedScore), 0) /
        predictions.length;

      const currentScore = Number(profile.compositeScore);
      const deviation =
        meanPredicted !== 0
          ? Math.abs(currentScore - meanPredicted) / meanPredicted
          : 0;

      // If deviation > 20%, create anomaly
      if (deviation > 0.2) {
        const severity =
          deviation > 0.5
            ? 'critical'
            : deviation > 0.35
              ? 'high'
              : 'medium';

        const anomalyType =
          currentScore > meanPredicted ? 'score_spike' : 'pattern_shift';

        await this.prisma.riskAnomaly.create({
          data: {
            tenantId,
            entityType: profile.entityType,
            entityId: profile.entityId,
            anomalyType,
            severity,
            description: `Risk score deviation of ${(deviation * 100).toFixed(1)}% detected. Current score: ${currentScore.toFixed(2)}, expected: ${meanPredicted.toFixed(2)}.`,
            baselineValue: meanPredicted,
            observedValue: currentScore,
            deviation: deviation * 100,
            status: 'open',
          },
        });

        // Update anomaly count on profile
        await this.prisma.entityRiskProfile.update({
          where: { id: profile.id },
          data: { anomalyCount: { increment: 1 } },
        });

        await this.events.publish({
          type: 'risk.anomaly.detected',
          tenantId,
          data: {
            entityType: profile.entityType,
            entityId: profile.entityId,
            anomalyType,
            severity,
            deviation: deviation * 100,
            currentScore,
            expectedScore: meanPredicted,
          },
          timestamp: new Date(),
        });

        detected++;
      }
    }

    this.logger.log(
      `Anomaly detection complete for tenant ${tenantId}: ${detected} anomalies found`,
    );

    return { detected, profilesAnalyzed: profiles.length };
  }

  async getAnomalies(
    tenantId: string,
    filters: {
      status?: string;
      entityType?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, status, entityType } = filters;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(entityType && { entityType }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.riskAnomaly.findMany({
        where,
        orderBy: [{ deviation: 'desc' }, { detectedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.riskAnomaly.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getPredictions(
    tenantId: string,
    filters: {
      entityType?: string;
      entityId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { page = 1, pageSize = 20, entityType, entityId, status } = filters;

    const where: any = {
      tenantId,
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(status && { status }),
    };

    const [data, totalItems] = await Promise.all([
      this.prisma.riskPrediction.findMany({
        where,
        orderBy: [{ predictedScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.riskPrediction.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async analyzeTrends(tenantId: string, entityType?: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = {
      tenantId,
      createdAt: { gte: since },
      ...(entityType && { entityType }),
    };

    const predictions = await this.prisma.riskPrediction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Group by entityType
    const grouped: Record<
      string,
      { predictedScores: number[]; currentScores: number[] }
    > = {};

    for (const p of predictions) {
      if (!grouped[p.entityType]) {
        grouped[p.entityType] = { predictedScores: [], currentScores: [] };
      }
      grouped[p.entityType].predictedScores.push(Number(p.predictedScore));
      grouped[p.entityType].currentScores.push(Number(p.currentScore));
    }

    const trends = Object.entries(grouped).map(([type, data]) => {
      const avgPredicted =
        data.predictedScores.reduce((s, v) => s + v, 0) /
        data.predictedScores.length;
      const avgCurrent =
        data.currentScores.reduce((s, v) => s + v, 0) /
        data.currentScores.length;
      const avgChange = avgPredicted - avgCurrent;

      return {
        entityType: type,
        predictionCount: data.predictedScores.length,
        avgPredictedScore: Number(avgPredicted.toFixed(2)),
        avgCurrentScore: Number(avgCurrent.toFixed(2)),
        avgPredictedChange: Number(avgChange.toFixed(2)),
        direction:
          avgChange > 1 ? 'increasing' : avgChange < -1 ? 'decreasing' : 'stable',
      };
    });

    return { data: trends, period: { days, since } };
  }

  async assessBusinessImpact(tenantId: string, entityId: string) {
    // Find edges connected to the entity's graph node
    const graphNode = await this.prisma.dataGraphNode.findFirst({
      where: { tenantId, entityId },
    });

    if (!graphNode) {
      return {
        entityId,
        impactLevel: 'unknown',
        downstreamDependencies: 0,
        connectedNodes: [],
        assessment: 'No graph node found for this entity.',
      };
    }

    // Get all edges connected to this node
    const edges = await this.prisma.dataGraphEdge.findMany({
      where: {
        tenantId,
        OR: [{ sourceNodeId: graphNode.id }, { targetNodeId: graphNode.id }],
      },
      include: {
        sourceNode: true,
        targetNode: true,
      },
    });

    // Count downstream dependencies (nodes this entity feeds into)
    const downstreamEdges = edges.filter(
      (e) => e.sourceNodeId === graphNode.id,
    );
    const upstreamEdges = edges.filter(
      (e) => e.targetNodeId === graphNode.id,
    );

    const connectedNodes = edges.map((e) => {
      const isSource = e.sourceNodeId === graphNode.id;
      const connectedNode = isSource ? e.targetNode : e.sourceNode;
      return {
        nodeId: connectedNode.id,
        nodeType: connectedNode.nodeType,
        label: connectedNode.label,
        relationship: e.relationshipType,
        direction: isSource ? 'downstream' : 'upstream',
      };
    });

    const totalConnections = edges.length;
    const impactLevel =
      totalConnections >= 10
        ? 'critical'
        : totalConnections >= 5
          ? 'high'
          : totalConnections >= 2
            ? 'medium'
            : 'low';

    return {
      entityId,
      graphNodeId: graphNode.id,
      impactLevel,
      downstreamDependencies: downstreamEdges.length,
      upstreamDependencies: upstreamEdges.length,
      totalConnections,
      connectedNodes,
      assessment: `Entity has ${downstreamEdges.length} downstream and ${upstreamEdges.length} upstream dependencies. Impact level: ${impactLevel}.`,
    };
  }
}
