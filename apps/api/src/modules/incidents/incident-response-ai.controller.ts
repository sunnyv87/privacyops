import {
  Controller,
  Get,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentResponseAiService } from './incident-response-ai.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Incident Response AI')
@ApiBearerAuth()
@Controller('incidents/:incidentId/ai')
export class IncidentResponseAiController {
  constructor(
    private readonly aiService: IncidentResponseAiService,
  ) {}

  @Post('classify')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'AI-classify an incident' })
  async classifyIncident(
    @CurrentUser('tenantId') tenantId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.classifyIncident(tenantId, incidentId);
    return { data: result };
  }

  @Post('impact-analysis')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Run AI impact analysis on an incident' })
  async analyzeImpact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.analyzeImpact(tenantId, incidentId);
    return { data: result };
  }

  @Get('impact')
  @RequirePermissions('incidents:read')
  @ApiOperation({ summary: 'Get impact analysis for an incident' })
  async getImpactAnalysis(
    @CurrentUser('tenantId') tenantId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.getImpactAnalysis(tenantId, incidentId);
    return { data: result };
  }

  @Post('playbook')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Generate an AI response playbook for an incident' })
  async generatePlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.generatePlaybook(tenantId, incidentId);
    return { data: result };
  }

  @Get('playbook')
  @RequirePermissions('incidents:read')
  @ApiOperation({ summary: 'Get the playbook for an incident' })
  async getPlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.getPlaybook(tenantId, incidentId);
    return { data: result };
  }

  @Post('playbook/approve')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Approve an incident playbook' })
  async approvePlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('incidentId') incidentId: string,
    @Body('playbookId') playbookId: string,
  ) {
    const result = await this.aiService.approvePlaybook(
      tenantId,
      playbookId,
      userId,
    );
    return { data: result };
  }

  @Post('contain')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Execute containment for an incident' })
  async executeContainment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('incidentId') incidentId: string,
  ) {
    const result = await this.aiService.executeContainment(
      tenantId,
      incidentId,
      userId,
    );
    return { data: result };
  }
}
