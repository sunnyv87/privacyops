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
}
