import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { DsarService } from './dsar.service';
import { IdentityMatcherService, IdentityMatchQuery } from './identity-matcher.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateDsarDto,
  UpdateDsarStatusDto,
} from './dto/dsar.dto';

@ApiTags('DSAR')
@ApiBearerAuth()
@Controller('dsar')
export class DsarController {
  constructor(
    private readonly dsarService: DsarService,
    private readonly identityMatcher: IdentityMatcherService,
  ) {}

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  @Post('requests')
  @RequirePermissions('dsar:requests:create')
  @ApiOperation({ summary: 'Submit a new data subject access request' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDsarDto,
  ) {
    const request = await this.dsarService.create(tenantId, userId, dto);
    return { data: request };
  }

  @Get('requests')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'List DSAR requests' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('assignee_id') assigneeId?: string,
    @Query('overdue_only') overdueOnly?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.dsarService.findAll(tenantId, {
      type,
      status,
      assigneeId,
      overdueOnly: overdueOnly === 'true',
      page,
      pageSize,
    });
  }

  @Get('requests/:id')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'Get DSAR request details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const request = await this.dsarService.findById(tenantId, id);
    return { data: request };
  }

  @Patch('requests/:id/status')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Update DSAR request status' })
  async updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDsarStatusDto,
  ) {
    const request = await this.dsarService.updateStatus(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: request };
  }

  @Patch('requests/:id/assign')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Assign DSAR request to a user' })
  async assign(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
  ) {
    const request = await this.dsarService.assign(
      tenantId,
      id,
      userId,
      assigneeId,
    );
    return { data: request };
  }

  @Get('requests/:id/timeline')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'Get DSAR request status timeline' })
  async getTimeline(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const timeline = await this.dsarService.getTimeline(tenantId, id);
    return { data: timeline };
  }

  // ---------------------------------------------------------------------------
  // Data Discovery
  // ---------------------------------------------------------------------------

  @Post('requests/:id/discover')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Discover subject data across data sources' })
  async discoverSubjectData(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.dsarService.discoverSubjectData(tenantId, id);
    return { data: result };
  }

  @Get('requests/:id/discovered-data')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'Get discovered data sources for a DSAR request' })
  async getDiscoveredData(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const request = await this.dsarService.findById(tenantId, id);
    return { data: request.discoveredDataSources || [] };
  }

  // ---------------------------------------------------------------------------
  // Response Package
  // ---------------------------------------------------------------------------

  @Post('requests/:id/generate-response')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Generate response package for a DSAR request' })
  async generateResponsePackage(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.dsarService.generateResponsePackage(tenantId, id);
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Download Response Package (redacted JSON artifact)
  // ---------------------------------------------------------------------------

  @Get('requests/:id/download')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'Download the redacted DSAR response package' })
  async downloadResponse(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const artifact = await this.dsarService.getDownload(tenantId, id);
    res.setHeader('Content-Type', artifact.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${artifact.filename}"`,
    );
    res.send(JSON.stringify(artifact.body, null, 2));
  }

  // ---------------------------------------------------------------------------
  // Verify Deletion
  // ---------------------------------------------------------------------------

  @Post('requests/:id/verify-deletion')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Verify deletion of subject data' })
  async verifyDeletion(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.dsarService.verifyDeletion(tenantId, id, userId);
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  @Get('stats')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'Get DSAR statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.dsarService.getStats(tenantId);
    return { data: stats };
  }

  // ---------------------------------------------------------------------------
  // Fuzzy Identity Match (additive)
  // ---------------------------------------------------------------------------

  @Post('identity-match')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({
    summary:
      'Fuzzy-match a prospective data subject against the tenant\'s existing data subjects',
  })
  async identityMatch(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: IdentityMatchQuery & { topK?: number; minScore?: number },
  ) {
    const { topK, minScore, ...query } = body;
    const candidates = await this.identityMatcher.findMatchingDataSubjects(
      tenantId,
      query,
      { topK, minScore },
    );
    return { data: { candidates, count: candidates.length } };
  }
}
