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
import { RopaService } from './ropa.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('ROPA')
@ApiBearerAuth()
@Controller('ropa')
export class RopaController {
  constructor(private readonly ropaService: RopaService) {}

  @Post('activities')
  @RequirePermissions('ropa:activities:create')
  @ApiOperation({ summary: 'Create a new processing activity record' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const activity = await this.ropaService.create(tenantId, userId, dto);
    return { data: activity };
  }

  @Get('activities')
  @RequirePermissions('ropa:activities:read')
  @ApiOperation({ summary: 'List processing activity records' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.ropaService.findAll(tenantId, { page, pageSize });
  }

  @Get('activities/:id')
  @RequirePermissions('ropa:activities:read')
  @ApiOperation({ summary: 'Get processing activity details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const activity = await this.ropaService.findById(tenantId, id);
    return { data: activity };
  }

  @Put('activities/:id')
  @RequirePermissions('ropa:activities:update')
  @ApiOperation({ summary: 'Update a processing activity record' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const activity = await this.ropaService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: activity };
  }
}
