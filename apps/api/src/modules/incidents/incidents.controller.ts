import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
} from './dto/incident.dto';

@ApiTags('Incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @RequirePermissions('incidents:incidents:create')
  @ApiOperation({ summary: 'Report a new privacy incident' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    const incident = await this.incidentsService.create(
      tenantId,
      userId,
      dto,
    );
    return { data: incident };
  }

  // ---------------------------------------------------------------------------
  // Detection Rules
  // ---------------------------------------------------------------------------

  @Post('detection-rules')
  @RequirePermissions('incidents:incidents:create')
  @ApiOperation({ summary: 'Create a breach detection rule' })
  async createDetectionRule(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { name: string; condition: any; isActive?: boolean },
  ) {
    const rule = await this.incidentsService.createDetectionRule(tenantId, dto);
    return { data: rule };
  }

  @Get('detection-rules')
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'List breach detection rules' })
  async findDetectionRules(@CurrentUser('tenantId') tenantId: string) {
    const rules = await this.incidentsService.findDetectionRules(tenantId);
    return { data: rules };
  }

  @Put('detection-rules/:id')
  @RequirePermissions('incidents:incidents:update')
  @ApiOperation({ summary: 'Update a breach detection rule' })
  async updateDetectionRule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; condition?: any; isActive?: boolean },
  ) {
    const rule = await this.incidentsService.updateDetectionRule(
      tenantId,
      id,
      dto,
    );
    return { data: rule };
  }

  @Delete('detection-rules/:id')
  @RequirePermissions('incidents:incidents:delete')
  @ApiOperation({ summary: 'Delete a breach detection rule' })
  async deleteDetectionRule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.incidentsService.deleteDetectionRule(
      tenantId,
      id,
    );
    return { data: result };
  }

  @Get('stats')
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'Get incident statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.incidentsService.getStats(tenantId);
    return { data: stats };
  }

  @Get()
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'List privacy incidents' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('breach_only') breachOnly?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.incidentsService.findAll(tenantId, {
      severity,
      status,
      breachOnly: breachOnly === 'true',
      page,
      pageSize,
    });
  }

  @Get(':id')
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'Get incident details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const incident = await this.incidentsService.findById(tenantId, id);
    return { data: incident };
  }

  @Put(':id')
  @RequirePermissions('incidents:incidents:update')
  @ApiOperation({ summary: 'Update an incident' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    const incident = await this.incidentsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: incident };
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  @Get(':id/notifications')
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'Track notifications for an incident' })
  async trackNotifications(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.incidentsService.trackNotifications(tenantId, id);
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Impact
  // ---------------------------------------------------------------------------

  @Get(':id/impact')
  @RequirePermissions('incidents:incidents:read')
  @ApiOperation({ summary: 'Get incident impact data including linked lineage' })
  async getImpact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const incident = await this.incidentsService.findById(tenantId, id);
    return {
      data: {
        incidentId: incident.id,
        severity: incident.severity,
        isPersonalDataBreach: incident.isPersonalDataBreach,
        estimatedSubjectsAffected: incident.estimatedSubjectsAffected,
        affectedAssets: incident.affectedAssets,
        containedAt: incident.containedAt,
        resolvedAt: incident.resolvedAt,
      },
    };
  }
}
