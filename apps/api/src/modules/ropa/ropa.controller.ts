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

  @Get('completeness')
  @RequirePermissions('ropa:entries:read')
  @ApiOperation({ summary: 'Get completeness overview for all RoPA entries' })
  async getCompletenessOverview(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const overview = await this.ropaService.getCompletenessOverview(tenantId);
    return { data: overview };
  }

  @Get('report')
  @RequirePermissions('ropa:entries:read')
  @ApiOperation({ summary: 'Generate RoPA regulatory report' })
  async generateReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('format') format?: string,
  ) {
    const report = await this.ropaService.generateReport(
      tenantId,
      format || 'json',
    );
    return { data: report };
  }

  @Get('processing-map')
  @RequirePermissions('ropa:entries:read')
  @ApiOperation({ summary: 'Get processing map for visual mapping' })
  async getProcessingMap(@CurrentUser('tenantId') tenantId: string) {
    const map = await this.ropaService.getProcessingMap(tenantId);
    return { data: map };
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

  @Post(':id/link-vendors')
  @RequirePermissions('ropa:entries:update')
  @ApiOperation({ summary: 'Link vendors to a RoPA entry' })
  async linkVendors(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body('vendorIds') vendorIds: string[],
  ) {
    const entry = await this.ropaService.linkVendors(tenantId, id, vendorIds);
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
