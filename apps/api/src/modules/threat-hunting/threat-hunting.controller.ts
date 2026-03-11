import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThreatHuntingService } from './threat-hunting.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Threat Hunting')
@ApiBearerAuth()
@Controller('threat-hunting')
export class ThreatHuntingController {
  constructor(
    private readonly threatHuntingService: ThreatHuntingService,
  ) {}

  @Post('hunts')
  @RequirePermissions('threat-hunting:admin')
  @ApiOperation({ summary: 'Start a new threat hunt' })
  async startHunt(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { huntType: string; query?: any },
  ) {
    const result = await this.threatHuntingService.startHunt(
      tenantId,
      body.huntType,
      body.query,
      userId,
    );
    return { data: result };
  }

  @Get('hunts')
  @RequirePermissions('threat-hunting:read')
  @ApiOperation({ summary: 'List threat hunts' })
  async getHunts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('huntType') huntType?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.threatHuntingService.getHunts(tenantId, {
      huntType,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('hunts/:id')
  @RequirePermissions('threat-hunting:read')
  @ApiOperation({ summary: 'Get threat hunt details' })
  async getHuntById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const hunt = await this.threatHuntingService.getHuntById(tenantId, id);
    return { data: hunt };
  }

  @Post('detect')
  @RequirePermissions('threat-hunting:admin')
  @ApiOperation({ summary: 'Run full threat detection across all hunt types' })
  async runFullDetection(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const result = await this.threatHuntingService.runFullDetection(tenantId);
    return { data: result };
  }

  @Get('indicators')
  @RequirePermissions('threat-hunting:read')
  @ApiOperation({ summary: 'List threat indicators' })
  async getIndicators(
    @CurrentUser('tenantId') tenantId: string,
    @Query('indicatorType') indicatorType?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.threatHuntingService.getIndicators(tenantId, {
      indicatorType,
      status,
      severity,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Patch('indicators/:id')
  @RequirePermissions('threat-hunting:admin')
  @ApiOperation({ summary: 'Update threat indicator status' })
  async updateIndicatorStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const result = await this.threatHuntingService.updateIndicatorStatus(
      tenantId,
      id,
      body.status,
      userId,
    );
    return { data: result };
  }

  @Get('baselines')
  @RequirePermissions('threat-hunting:read')
  @ApiOperation({ summary: 'List access baselines' })
  async getBaselines(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.threatHuntingService.getBaselines(
      tenantId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }
}
