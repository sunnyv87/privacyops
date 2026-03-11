import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiRiskClassifierService } from './ai-risk-classifier.service';
import { AiLineageTrackerService } from './ai-lineage-tracker.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('AI Governance Intelligence')
@ApiBearerAuth()
@Controller('ai-governance')
export class AiGovernanceIntelligenceController {
  constructor(
    private readonly riskClassifier: AiRiskClassifierService,
    private readonly lineageTracker: AiLineageTrackerService,
  ) {}

  @Post('systems/:id/lineage')
  @RequirePermissions('ai-governance:create')
  @ApiOperation({ summary: 'Record model lineage for an AI system' })
  async recordLineage(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: {
      version: string;
      parentModelId?: string;
      trainingDatasets: string[];
      trainingConfig?: any;
      evaluationMetrics?: any;
      deploymentStatus?: string;
    },
  ) {
    const lineage = await this.lineageTracker.recordLineage(tenantId, id, dto);
    return { data: lineage };
  }

  @Get('systems/:id/lineage')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'Get model lineage for an AI system' })
  async getLineage(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const lineage = await this.lineageTracker.getLineage(tenantId, id);
    return { data: lineage };
  }

  @Post('systems/:id/risk-assessment')
  @RequirePermissions('ai-governance:create')
  @ApiOperation({ summary: 'Classify risk for an AI system' })
  async classifyRisk(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const assessment = await this.riskClassifier.classifyRisk(tenantId, id);
    return { data: assessment };
  }

  @Get('risk-assessments')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'List AI risk assessments' })
  async getRiskAssessments(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ai_system_id') aiSystemId?: string,
    @Query('risk_category') riskCategory?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.riskClassifier.getRiskAssessments(tenantId, {
      aiSystemId,
      riskCategory,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('regulatory-map')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'Get regulatory mapping for all AI systems' })
  async getRegulatoryMap(@CurrentUser('tenantId') tenantId: string) {
    const map = await this.riskClassifier.getRegulatoryMap(tenantId);
    return { data: map };
  }

  @Get('sensitive-data-usage')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'Get sensitive data usage across AI systems' })
  async getSensitiveDataUsage(@CurrentUser('tenantId') tenantId: string) {
    const usage = await this.lineageTracker.getSensitiveDataUsage(tenantId);
    return { data: usage };
  }
}
