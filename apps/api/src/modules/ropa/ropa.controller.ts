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
import { RopaService } from './ropa.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { CreateRopaEntryDto, UpdateRopaEntryDto } from './dto/ropa.dto';

@ApiTags('ROPA')
@ApiBearerAuth()
@Controller('ropa')
export class RopaController {
  constructor(private readonly ropaService: RopaService) {}

  @Post()
  @RequirePermissions('ropa:entries:create')
  @ApiOperation({ summary: 'Create a new processing activity record' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRopaEntryDto,
  ) {
    const entry = await this.ropaService.create(tenantId, userId, dto);
    return { data: entry };
  }

  @Get()
  @RequirePermissions('ropa:entries:read')
  @ApiOperation({ summary: 'List processing activity records' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('lawful_basis') lawfulBasis?: string,
    @Query('dpia_required') dpiaRequired?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.ropaService.findAll(tenantId, {
      lawfulBasis,
      dpiaRequired: dpiaRequired !== undefined ? dpiaRequired === 'true' : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('export')
  @RequirePermissions('ropa:entries:export')
  @ApiOperation({ summary: 'Export all RoPA entries for regulatory submission' })
  async export(@CurrentUser('tenantId') tenantId: string) {
    const entries = await this.ropaService.export(tenantId);
    return { data: entries };
  }

  @Get(':id')
  @RequirePermissions('ropa:entries:read')
  @ApiOperation({ summary: 'Get processing activity details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const entry = await this.ropaService.findById(tenantId, id);
    return { data: entry };
  }

  @Put(':id')
  @RequirePermissions('ropa:entries:update')
  @ApiOperation({ summary: 'Update a processing activity record' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRopaEntryDto,
  ) {
    const entry = await this.ropaService.update(tenantId, id, userId, dto);
    return { data: entry };
  }

  @Delete(':id')
  @RequirePermissions('ropa:entries:delete')
  @ApiOperation({ summary: 'Soft delete a processing activity record' })
  async delete(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const entry = await this.ropaService.delete(tenantId, id, userId);
    return { data: entry };
  }
}
