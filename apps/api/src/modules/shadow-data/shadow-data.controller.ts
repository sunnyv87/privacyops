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
import { ShadowDataService } from './shadow-data.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UpdateAlertStatusDto } from './dto/shadow-data.dto';

@ApiTags('Shadow Data')
@ApiBearerAuth()
@Controller('shadow-data')
export class ShadowDataController {
  constructor(private readonly shadowDataService: ShadowDataService) {}

  @Get('alerts')
  @RequirePermissions('dspm:shadow-data:read')
  @ApiOperation({ summary: 'List shadow data alerts with filters' })
  async getAlerts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('alert_type') alertType?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.shadowDataService.getAlerts(tenantId, {
      alertType,
      status,
      severity,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('alerts/:id')
  @RequirePermissions('dspm:shadow-data:read')
  @ApiOperation({ summary: 'Get shadow data alert details' })
  async getAlertById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const alert = await this.shadowDataService.getAlertById(tenantId, id);
    return { data: alert };
  }

  @Patch('alerts/:id/status')
  @RequirePermissions('dspm:shadow-data:admin')
  @ApiOperation({ summary: 'Update shadow data alert status' })
  async updateAlertStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
  ) {
    const alert = await this.shadowDataService.updateAlertStatus(
      tenantId,
      id,
      dto.status,
      userId,
    );
    return { data: alert };
  }

  @Get('stats')
  @RequirePermissions('dspm:shadow-data:read')
  @ApiOperation({ summary: 'Get shadow data statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.shadowDataService.getStats(tenantId);
    return { data: stats };
  }

  @Post('scan')
  @RequirePermissions('dspm:shadow-data:admin')
  @ApiOperation({ summary: 'Trigger shadow data detection scan' })
  async scan(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.shadowDataService.detectShadowData(tenantId);
    return { data: result };
  }
}
