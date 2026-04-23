import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RemediationService } from './remediation.service';
import { WorkflowService } from '@/core/workflow/workflow.service';
import { SIGNAL_NAMES } from '@/core/workflow/signals';
import { NarrativeService } from '@/modules/co-pilot/narrative.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { ProposeActionDto } from './dto/remediation.dto';

@ApiTags('Remediation')
@ApiBearerAuth()
@Controller('remediation')
export class RemediationController {
  constructor(
    private readonly remediationService: RemediationService,
    private readonly workflows: WorkflowService,
    private readonly narrative: NarrativeService,
  ) {}

  @Post('propose')
  @RequirePermissions('dspm:remediation:create')
  @ApiOperation({ summary: 'Propose a remediation action for a finding' })
  async proposeAction(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ProposeActionDto,
  ) {
    const action = await this.remediationService.proposeAction(
      tenantId,
      dto.findingId,
      dto.actionType,
      userId,
    );
    return { data: action };
  }

  @Post(':id/approve')
  @RequirePermissions('dspm:remediation:approve')
  @ApiOperation({ summary: 'Approve a proposed remediation action' })
  async approveAction(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const action = await this.remediationService.approveAction(tenantId, id, userId);
    return { data: action };
  }

  @Post(':id/execute')
  @RequirePermissions('dspm:remediation:execute')
  @ApiOperation({ summary: 'Execute an approved remediation action' })
  async executeAction(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const action = await this.remediationService.executeAction(tenantId, id, userId);
    return { data: action };
  }

  @Post(':id/rollback')
  @RequirePermissions('dspm:remediation:execute')
  @ApiOperation({ summary: 'Rollback a completed remediation action' })
  async rollbackAction(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const action = await this.remediationService.rollbackAction(tenantId, id, userId);
    return { data: action };
  }

  @Get()
  @RequirePermissions('dspm:remediation:read')
  @ApiOperation({ summary: 'List remediation actions with filters' })
  async findActions(
    @CurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('action_type') actionType?: string,
    @Query('finding_id') findingId?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.remediationService.findActions(tenantId, {
      status,
      actionType,
      findingId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('dspm:remediation:read')
  @ApiOperation({ summary: 'Get remediation action details' })
  async findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('withNarrative') withNarrative?: string,
  ) {
    const action = await this.remediationService.findById(tenantId, id);
    // Optional narrative enrichment — opt-in to preserve existing shape.
    let narrative: string | undefined;
    if (withNarrative === 'true' && action) {
      narrative = await this.narrative.explainRemediation(action as any);
    }
    return { data: narrative ? { ...(action as any), narrative } : action };
  }

  // ---------------------------------------------------------------------------
  // Temporal signal: submit approval decision to running remediation workflow
  // ---------------------------------------------------------------------------

  @Post(':findingId/signal-approval')
  @RequirePermissions('dspm:remediation:update')
  @ApiOperation({
    summary:
      'Signal approval/rejection to the running remediation workflow for this finding',
  })
  async signalRemediationApproval(
    @CurrentUser('tenantId') _tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('findingId') findingId: string,
    @Body() body: { decision: 'approved' | 'rejected'; comments?: string },
  ) {
    const workflowId = `remediation-${findingId}`;
    const sent = await this.workflows.signalWorkflow(
      workflowId,
      SIGNAL_NAMES.REMEDIATION_APPROVAL,
      {
        decision: body.decision,
        comments: body.comments,
        decidedBy: userId,
        decidedAt: new Date().toISOString(),
      },
    );
    return { data: { signaled: sent, workflowId } };
  }
}
