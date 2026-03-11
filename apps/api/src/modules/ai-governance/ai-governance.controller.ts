import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiGovernanceService } from './ai-governance.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateAiSystemDto,
  UpdateAiSystemDto,
  RecordDatasetUsageDto,
} from './dto/ai-governance.dto';

@ApiTags('AI Governance')
@ApiBearerAuth()
@Controller('ai-governance')
export class AiGovernanceController {
  constructor(private readonly aiGovernanceService: AiGovernanceService) {}

  // ---------------------------------------------------------------------------
  // AI Systems
  // ---------------------------------------------------------------------------

  @Post('systems')
  @RequirePermissions('ai-governance:admin')
  @ApiOperation({ summary: 'Register a new AI system' })
  async createSystem(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAiSystemDto,
  ) {
    const system = await this.aiGovernanceService.createSystem(
      tenantId,
      userId,
      dto,
    );
    return { data: system };
  }

  @Get('systems')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'List AI systems' })
  async findSystems(
    @CurrentUser('tenantId') tenantId: string,
    @Query('risk_category') riskCategory?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.aiGovernanceService.findSystems(tenantId, {
      riskCategory,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('systems/:id')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'Get AI system details' })
  async findSystemById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const system = await this.aiGovernanceService.findSystemById(tenantId, id);
    return { data: system };
  }

  @Put('systems/:id')
  @RequirePermissions('ai-governance:admin')
  @ApiOperation({ summary: 'Update an AI system' })
  async updateSystem(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiSystemDto,
  ) {
    const system = await this.aiGovernanceService.updateSystem(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: system };
  }

  // ---------------------------------------------------------------------------
  // Dataset Usage
  // ---------------------------------------------------------------------------

  @Post('dataset-usage')
  @RequirePermissions('ai-governance:admin')
  @ApiOperation({ summary: 'Record dataset usage by an AI system' })
  async recordDatasetUsage(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: RecordDatasetUsageDto,
  ) {
    const usage = await this.aiGovernanceService.recordDatasetUsage(
      tenantId,
      dto,
    );
    return { data: usage };
  }

  @Get('dataset-usage')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'List dataset usages' })
  async findDatasetUsage(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ai_system_id') aiSystemId?: string,
    @Query('usage_type') usageType?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.aiGovernanceService.findDatasetUsage(tenantId, {
      aiSystemId,
      usageType,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // Compliance Report
  // ---------------------------------------------------------------------------

  @Get('compliance-report')
  @RequirePermissions('ai-governance:read')
  @ApiOperation({ summary: 'Get AI governance compliance report' })
  async getComplianceReport(@CurrentUser('tenantId') tenantId: string) {
    const report = await this.aiGovernanceService.getComplianceReport(tenantId);
    return { data: report };
  }
}
