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
import { DspmService } from './dspm.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('DSPM')
@ApiBearerAuth()
@Controller('dspm')
export class DspmController {
  constructor(private readonly dspmService: DspmService) {}

  @Post('policies')
  @RequirePermissions('dspm:policies:create')
  @ApiOperation({ summary: 'Create a new data security policy' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const policy = await this.dspmService.create(tenantId, userId, dto);
    return { data: policy };
  }

  @Get('policies')
  @RequirePermissions('dspm:policies:read')
  @ApiOperation({ summary: 'List data security policies' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.dspmService.findAll(tenantId, { page, pageSize });
  }

  @Get('policies/:id')
  @RequirePermissions('dspm:policies:read')
  @ApiOperation({ summary: 'Get data security policy details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.dspmService.findById(tenantId, id);
    return { data: policy };
  }

  @Put('policies/:id')
  @RequirePermissions('dspm:policies:update')
  @ApiOperation({ summary: 'Update a data security policy' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const policy = await this.dspmService.update(tenantId, id, userId, dto);
    return { data: policy };
  }
}
