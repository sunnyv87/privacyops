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
import { DsarService } from './dsar.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('DSAR')
@ApiBearerAuth()
@Controller('dsar')
export class DsarController {
  constructor(private readonly dsarService: DsarService) {}

  @Post('requests')
  @RequirePermissions('dsar:requests:create')
  @ApiOperation({ summary: 'Submit a new data subject access request' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const request = await this.dsarService.create(tenantId, userId, dto);
    return { data: request };
  }

  @Get('requests')
  @RequirePermissions('dsar:requests:read')
  @ApiOperation({ summary: 'List DSAR requests' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dsarService.findAll(tenantId, { status, page, pageSize });
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

  @Put('requests/:id')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Update a DSAR request' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const request = await this.dsarService.update(tenantId, id, userId, dto);
    return { data: request };
  }
}
