import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceAdvisorService } from './compliance-advisor.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Compliance Advisor')
@ApiBearerAuth()
@Controller('compliance/advisor')
export class ComplianceAdvisorController {
  constructor(
    private readonly advisorService: ComplianceAdvisorService,
  ) {}

  @Post('ask')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Ask a compliance question' })
  async askComplianceQuestion(
    @CurrentUser('tenantId') tenantId: string,
    @Body('question') question: string,
  ) {
    const advice = await this.advisorService.askComplianceQuestion(
      tenantId,
      question,
    );
    return { data: advice };
  }

  @Get('gap-remediation/:gapId')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Get AI remediation advice for a compliance gap' })
  async adviseGapRemediation(
    @CurrentUser('tenantId') tenantId: string,
    @Param('gapId') gapId: string,
  ) {
    const advice = await this.advisorService.adviseGapRemediation(
      tenantId,
      gapId,
    );
    return { data: advice };
  }

  @Post('map-controls')
  @RequirePermissions('compliance:create')
  @ApiOperation({ summary: 'Generate control mappings between frameworks' })
  async generateControlMappings(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { sourceFramework: string; targetFramework: string },
  ) {
    const result = await this.advisorService.generateControlMappings(
      tenantId,
      body.sourceFramework,
      body.targetFramework,
    );
    return { data: result };
  }

  @Get('control-mappings')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Get control mappings' })
  async getControlMappings(
    @CurrentUser('tenantId') tenantId: string,
    @Query('source_framework') sourceFramework?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.advisorService.getControlMappings(tenantId, {
      sourceFramework,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('assess-dataset/:assetId')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Assess dataset compliance for an asset' })
  async assessDatasetCompliance(
    @CurrentUser('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    const assessment = await this.advisorService.assessDatasetCompliance(
      tenantId,
      assetId,
    );
    return { data: assessment };
  }

  @Get('history')
  @RequirePermissions('compliance:read')
  @ApiOperation({ summary: 'Get compliance advice history' })
  async getAdviceHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query('advice_type') adviceType?: string,
    @Query('regulation_id') regulationId?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.advisorService.getAdviceHistory(tenantId, {
      adviceType,
      regulationId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
