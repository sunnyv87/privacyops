import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';
import { Classifier, ClassificationPattern } from './engine/classifier';
import { SchemaHeuristicsEngine } from './engine/schema-heuristics';
import {
  ClassifyAssetDto,
  CreateLabelDto,
  ClassificationFilterDto,
} from './dto/classification.dto';

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  private readonly classifier = new Classifier();
  private readonly heuristics = new SchemaHeuristicsEngine();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  async classifyAsset(tenantId: string, actorId: string, dto: ClassifyAssetDto) {
    // 1. Load asset with fields from DB
    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, tenantId, deletedAt: null },
      include: {
        fields: dto.fieldIds
          ? { where: { id: { in: dto.fieldIds } } }
          : true,
        dataSource: { select: { type: true } },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${dto.assetId} not found`);
    }

    // Load classification labels/patterns for the tenant + system labels
    const labels = await this.prisma.classificationLabel.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
    });

    // Convert labels to classifier patterns
    const patterns: ClassificationPattern[] = labels.map((label) => {
      const detectionPatterns = (label.detectionPatterns as any) || {};
      return {
        labelId: label.id,
        labelName: label.name,
        category: label.category,
        sensitivityLevel: label.sensitivityLevel,
        regexPatterns: (detectionPatterns.regex || []).map(
          (r: string) => new RegExp(r, 'i'),
        ),
        keywords: detectionPatterns.keywords || [],
      };
    });

    this.classifier.loadPatterns(patterns);

    // 2. For each field, run classifier
    const classifications: any[] = [];

    for (const field of asset.fields) {
      const sampleValues = (field.sampleValues as any[]) || [];

      const results = this.classifier.classify({
        fieldName: field.name,
        dataType: field.dataType || undefined,
        sampleValues,
        tableName: asset.name,
        sourceType: (asset as any).dataSource?.type,
      });

      // 3. Store results as Classification records
      for (const result of results) {
        // Skip low-confidence results
        if (result.confidence < 0.5) continue;

        const existing = await this.prisma.classification.findFirst({
          where: {
            tenantId,
            assetId: asset.id,
            assetFieldId: field.id,
            labelId: result.labelId,
          },
        });

        if (existing) {
          // Update confidence if higher
          if (result.confidence > Number(existing.confidence)) {
            await this.prisma.classification.update({
              where: { id: existing.id },
              data: {
                confidence: result.confidence,
                method: result.method,
              },
            });
          }
        } else {
          const classification = await this.prisma.classification.create({
            data: {
              tenantId,
              assetId: asset.id,
              assetFieldId: field.id,
              labelId: result.labelId,
              confidence: result.confidence,
              method: result.method,
              status: 'auto_applied',
            },
          });
          classifications.push({
            ...classification,
            labelName: result.labelName,
            fieldName: field.name,
          });
        }
      }

      // 3b. Schema heuristic fallback — classify by column name patterns
      // Runs if the main classifier found no results for this field
      if (results.length === 0 || results.every((r) => r.confidence < 0.5)) {
        const heuristicMatch = this.heuristics.classifyByColumnName(field.name);
        if (heuristicMatch) {
          // Find a matching label by name
          const matchingLabel = labels.find(
            (l) => l.name.toLowerCase() === heuristicMatch.labelName.toLowerCase(),
          );
          if (matchingLabel) {
            const existingHeuristic = await this.prisma.classification.findFirst({
              where: {
                tenantId,
                assetId: asset.id,
                assetFieldId: field.id,
                labelId: matchingLabel.id,
              },
            });
            if (!existingHeuristic) {
              const classification = await this.prisma.classification.create({
                data: {
                  tenantId,
                  assetId: asset.id,
                  assetFieldId: field.id,
                  labelId: matchingLabel.id,
                  confidence: heuristicMatch.confidence,
                  method: 'heuristic',
                  status: 'auto_applied',
                },
              });
              classifications.push({
                ...classification,
                labelName: heuristicMatch.labelName,
                fieldName: field.name,
              });
            }
          }
        }
      }
    }

    // 4. Detect toxic combinations
    const allClassifications = await this.prisma.classification.findMany({
      where: { tenantId, assetId: asset.id },
      include: { label: true },
    });

    const toxicWarnings = this.classifier.detectToxicCombinations(
      allClassifications.map((c) => ({
        labelName: c.label.name,
        category: c.label.category,
      })),
    );

    // 5. Publish classification events
    await this.events.publish({
      type: 'classification.completed',
      tenantId,
      data: {
        assetId: asset.id,
        classificationsCreated: classifications.length,
        totalClassifications: allClassifications.length,
        fieldsProcessed: asset.fields.length,
      },
      timestamp: new Date(),
    });

    if (toxicWarnings.length > 0) {
      await this.events.publish({
        type: 'toxic_combination.detected',
        tenantId,
        data: {
          assetId: asset.id,
          assetName: asset.name,
          warnings: toxicWarnings,
        },
        timestamp: new Date(),
      });

      this.logger.warn(
        `Toxic combinations detected in asset ${asset.id}: ${toxicWarnings.length} warning(s)`,
      );
    }

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'classification.completed',
      entityType: 'asset',
      entityId: asset.id,
      changes: {
        after: {
          classificationsCreated: classifications.length,
          fieldsProcessed: asset.fields.length,
          toxicWarnings: toxicWarnings.length,
        },
      },
    });

    this.logger.log(
      `Classified asset ${asset.id}: ${classifications.length} new classification(s), ${toxicWarnings.length} toxic warning(s)`,
    );

    return {
      assetId: asset.id,
      assetName: asset.name,
      classificationsCreated: classifications.length,
      totalClassifications: allClassifications.length,
      fieldsProcessed: asset.fields.length,
      classifications,
      toxicWarnings,
    };
  }

  async findAll(
    tenantId: string,
    filters?: ClassificationFilterDto & { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20, assetId, labelId, category, minConfidence } =
      filters || {};

    const where: any = {
      tenantId,
      ...(assetId && { assetId }),
      ...(labelId && { labelId }),
      ...(minConfidence !== undefined && { confidence: { gte: minConfidence } }),
    };

    if (category) {
      where.label = { category };
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.classification.findMany({
        where,
        include: {
          label: true,
          asset: {
            select: { id: true, name: true, type: true },
          },
          assetField: {
            select: { id: true, name: true, dataType: true },
          },
        },
        orderBy: { confidence: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.classification.count({ where }),
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

  async findByAsset(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    return this.prisma.classification.findMany({
      where: { tenantId, assetId },
      include: {
        label: true,
        assetField: {
          select: { id: true, name: true, dataType: true },
        },
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createLabel(tenantId: string, actorId: string, dto: CreateLabelDto) {
    const label = await this.prisma.classificationLabel.create({
      data: {
        tenantId,
        name: dto.name,
        category: dto.category,
        sensitivityLevel: dto.sensitivityLevel,
        description: dto.description,
        detectionPatterns: {
          regex: dto.patterns || [],
          keywords: dto.keywords || [],
        },
        isSystem: false,
      },
    });

    await this.audit.log({
      tenantId,
      actorId,
      actorType: 'user',
      action: 'label.created',
      entityType: 'classification_label',
      entityId: label.id,
      changes: {
        after: {
          name: dto.name,
          category: dto.category,
          sensitivityLevel: dto.sensitivityLevel,
        },
      },
    });

    this.logger.log(`Classification label ${label.id} created by ${actorId}`);

    return label;
  }

  async findAllLabels(tenantId: string) {
    return this.prisma.classificationLabel.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      orderBy: [{ category: 'asc' }, { sensitivityLevel: 'desc' }],
    });
  }

  async bulkClassify(tenantId: string, assetIds: string[], userId?: string) {
    let classified = 0;
    const errors: { assetId: string; error: string }[] = [];

    for (const assetId of assetIds) {
      try {
        await this.classifyAsset(tenantId, userId || 'system', {
          assetId,
        });
        classified++;
      } catch (error) {
        errors.push({
          assetId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.logger.warn(`Bulk classify failed for asset ${assetId}: ${error}`);
      }
    }

    this.logger.log(
      `Bulk classification for tenant ${tenantId}: ${classified}/${assetIds.length} classified, ${errors.length} error(s)`,
    );

    return {
      total: assetIds.length,
      classified,
      errors,
    };
  }

  async getClassificationCoverage(tenantId: string) {
    const [totalAssets, classifiedAssetGroups] = await Promise.all([
      this.prisma.asset.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.classification.groupBy({
        by: ['assetId'],
        where: { tenantId },
      }),
    ]);

    const classifiedAssets = classifiedAssetGroups.length;
    const coveragePercent =
      totalAssets > 0
        ? Math.round((classifiedAssets / totalAssets) * 10000) / 100
        : 0;

    // Coverage by category
    const categoryGroups = await this.prisma.classification.findMany({
      where: { tenantId },
      select: {
        assetId: true,
        label: { select: { category: true } },
      },
    });

    const byCategory: Record<string, { assetCount: number; classificationCount: number }> = {};
    const categoryAssetSets: Record<string, Set<string>> = {};

    for (const c of categoryGroups) {
      const cat = c.label.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { assetCount: 0, classificationCount: 0 };
        categoryAssetSets[cat] = new Set();
      }
      byCategory[cat].classificationCount++;
      categoryAssetSets[cat].add(c.assetId);
    }

    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].assetCount = categoryAssetSets[cat].size;
    }

    return {
      totalAssets,
      classifiedAssets,
      coveragePercent,
      byCategory,
    };
  }

  async getToxicCombinations(tenantId: string) {
    const classifications = await this.prisma.classification.findMany({
      where: { tenantId },
      include: {
        label: { select: { name: true, category: true } },
        asset: { select: { id: true, name: true } },
      },
    });

    // Group by asset
    const assetMap = new Map<
      string,
      {
        assetName: string;
        labels: { labelName: string; category: string }[];
      }
    >();

    for (const c of classifications) {
      const existing = assetMap.get(c.assetId) || {
        assetName: c.asset.name,
        labels: [],
      };
      existing.labels.push({
        labelName: c.label.name,
        category: c.label.category,
      });
      assetMap.set(c.assetId, existing);
    }

    // Detect toxic combinations per asset
    const results: {
      assetId: string;
      assetName: string;
      combinations: string[];
    }[] = [];

    for (const [assetId, data] of assetMap) {
      const combinations = this.classifier.detectToxicCombinations(data.labels);
      if (combinations.length > 0) {
        results.push({
          assetId,
          assetName: data.assetName,
          combinations,
        });
      }
    }

    return results;
  }

  async getStats(tenantId: string) {
    const [
      byCategory,
      byLabel,
      totalClassifications,
      totalAssets,
    ] = await Promise.all([
      this.prisma.classification.groupBy({
        by: ['labelId'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.classificationLabel.findMany({
        where: {
          OR: [{ tenantId }, { tenantId: null, isSystem: true }],
        },
        select: { id: true, name: true, category: true, sensitivityLevel: true },
      }),
      this.prisma.classification.count({ where: { tenantId } }),
      this.prisma.classification.groupBy({
        by: ['assetId'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    // Build label stats map
    const labelMap = new Map(byLabel.map((l) => [l.id, l]));
    const countMap = new Map(
      byCategory.map((c) => [c.labelId, c._count.id]),
    );

    // Group by category
    const categoryStats: Record<string, { count: number; labels: string[] }> = {};
    for (const label of byLabel) {
      if (!categoryStats[label.category]) {
        categoryStats[label.category] = { count: 0, labels: [] };
      }
      const count = countMap.get(label.id) || 0;
      categoryStats[label.category].count += count;
      if (count > 0) {
        categoryStats[label.category].labels.push(label.name);
      }
    }

    const topLabels = byCategory
      .map((c) => ({
        labelId: c.labelId,
        labelName: labelMap.get(c.labelId)?.name || 'Unknown',
        category: labelMap.get(c.labelId)?.category || 'unknown',
        count: c._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalClassifications,
      classifiedAssets: totalAssets.length,
      byCategory: Object.entries(categoryStats).map(([category, stats]) => ({
        category,
        count: stats.count,
        labels: stats.labels,
      })),
      topLabels,
    };
  }
}
