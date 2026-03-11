import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { StartScanDto } from './dto/discovery.dto';

@ApiTags('Discovery')
@ApiBearerAuth()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('scans')
  @RequirePermissions('discovery:scans:create')
  @ApiOperation({ summary: 'Start a new discovery scan' })
  async startScan(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: StartScanDto,
  ) {
    const scan = await this.discoveryService.startScan(tenantId, userId, dto);
    return { data: scan };
  }

  @Get('scans')
  @RequirePermissions('discovery:scans:read')
  @ApiOperation({ summary: 'List discovery scans' })
  async findAllScans(
    @CurrentUser('tenantId') tenantId: string,
    @Query('data_source_id') dataSourceId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.discoveryService.findAllScans(tenantId, { dataSourceId, status, page, pageSize });
  }

  @Get('scans/:id')
  @RequirePermissions('discovery:scans:read')
  @ApiOperation({ summary: 'Get scan details' })
  async findScan(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const scan = await this.discoveryService.findScanById(tenantId, id);
    return { data: scan };
  }

  @Get('assets')
  @RequirePermissions('discovery:assets:read')
  @ApiOperation({ summary: 'List discovered assets (data catalog)' })
  async findAllAssets(
    @CurrentUser('tenantId') tenantId: string,
    @Query('data_source_id') dataSourceId?: string,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.discoveryService.findAllAssets(tenantId, { dataSourceId, type, page, pageSize });
  }

  @Get('assets/:id')
  @RequirePermissions('discovery:assets:read')
  @ApiOperation({ summary: 'Get asset details with classifications and findings' })
  async findAsset(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const asset = await this.discoveryService.findAssetById(tenantId, id);
    return { data: asset };
  }
}
