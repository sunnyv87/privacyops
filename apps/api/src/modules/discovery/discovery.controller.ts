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
import { DiscoveryService } from './discovery.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Discovery')
@ApiBearerAuth()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('scans')
  @RequirePermissions('discovery:scans:create')
  @ApiOperation({ summary: 'Initiate a new discovery scan' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const scan = await this.discoveryService.create(tenantId, userId, dto);
    return { data: scan };
  }

  @Get('scans')
  @RequirePermissions('discovery:scans:read')
  @ApiOperation({ summary: 'List discovery scans' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.discoveryService.findAll(tenantId, { page, pageSize });
  }

  @Get('scans/:id')
  @RequirePermissions('discovery:scans:read')
  @ApiOperation({ summary: 'Get discovery scan details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const scan = await this.discoveryService.findById(tenantId, id);
    return { data: scan };
  }

  @Put('scans/:id')
  @RequirePermissions('discovery:scans:update')
  @ApiOperation({ summary: 'Update a discovery scan' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const scan = await this.discoveryService.update(tenantId, id, userId, dto);
    return { data: scan };
  }
}
