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
@Controller('incidents')
export class IncidentResponseAiController {
  constructor(
    private readonly aiService: IncidentResponseAiService,
  ) {}

  @Post(':id/ai-classify')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'AI-classify an incident' })
  async classifyIncident(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.classifyIncident(tenantId, id);
    return { data: result };
  }

  @Post(':id/impact-analysis')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Run AI impact analysis on an incident' })
  async analyzeImpact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.analyzeImpact(tenantId, id);
    return { data: result };
  }

  @Get(':id/impact')
  @RequirePermissions('incidents:read')
  @ApiOperation({ summary: 'Get impact analysis for an incident' })
  async getImpactAnalysis(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.getImpactAnalysis(tenantId, id);
    return { data: result };
  }

  @Post(':id/playbook')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Generate an AI response playbook for an incident' })
  async generatePlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.generatePlaybook(tenantId, id);
    return { data: result };
  }

  @Get(':id/playbook')
  @RequirePermissions('incidents:read')
  @ApiOperation({ summary: 'Get the playbook for an incident' })
  async getPlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.getPlaybook(tenantId, id);
    return { data: result };
  }

  @Post(':id/playbook/approve')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Approve an incident playbook' })
  async approvePlaybook(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('playbookId') playbookId: string,
  ) {
    const result = await this.aiService.approvePlaybook(
      tenantId,
      playbookId,
      userId,
    );
    return { data: result };
  }

  @Post(':id/contain')
  @RequirePermissions('incidents:update')
  @ApiOperation({ summary: 'Execute containment for an incident' })
  async executeContainment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.aiService.executeContainment(
      tenantId,
      id,
      userId,
    );
    return { data: result };
  }
}
