import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RemediationAgentService } from './remediation-agent.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Remediation Agent')
@ApiBearerAuth()
@Controller('remediation/agent')
export class RemediationAgentController {
  constructor(private readonly agentService: RemediationAgentService) {}

  @Post('analyze/:findingId')
  @RequirePermissions('remediation:create')
  @ApiOperation({ summary: 'Analyze a finding and generate a remediation plan' })
  async analyzeFinding(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('findingId') findingId: string,
  ) {
    const plan = await this.agentService.analyzeFinding(tenantId, findingId, userId);
    return { data: plan };
  }

  @Get('plans')
  @RequirePermissions('remediation:read')
  @ApiOperation({ summary: 'List remediation plans' })
  async getPlans(
    @CurrentUser('tenantId') tenantId: string,
    @Query('finding_id') findingId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.agentService.getPlans(tenantId, {
      findingId,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('plans/:id')
  @RequirePermissions('remediation:read')
  @ApiOperation({ summary: 'Get remediation plan details' })
  async getPlanById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const plan = await this.agentService.getPlanById(tenantId, id);
    return { data: plan };
  }

  @Post('plans/:id/approve')
  @RequirePermissions('remediation:create')
  @ApiOperation({ summary: 'Approve a remediation plan' })
  async approvePlan(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const plan = await this.agentService.approvePlan(tenantId, id, userId);
    return { data: plan };
  }

  @Post('plans/:id/execute')
  @RequirePermissions('remediation:create')
  @ApiOperation({ summary: 'Execute a remediation plan' })
  async executePlan(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const plan = await this.agentService.executePlan(tenantId, id, userId);
    return { data: plan };
  }

  @Post('bulk-analyze')
  @RequirePermissions('remediation:create')
  @ApiOperation({ summary: 'Bulk analyze findings and generate remediation plans' })
  async bulkAnalyze(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { findingIds: string[] },
  ) {
    const plans = await this.agentService.bulkAnalyze(tenantId, body.findingIds, userId);
    return { data: plans };
  }
}
