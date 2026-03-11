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
import { VendorsService } from './vendors.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @RequirePermissions('vendors:vendors:create')
  @ApiOperation({ summary: 'Register a new vendor' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const vendor = await this.vendorsService.create(tenantId, userId, dto);
    return { data: vendor };
  }

  @Get()
  @RequirePermissions('vendors:vendors:read')
  @ApiOperation({ summary: 'List vendors' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('risk_level') riskLevel?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.vendorsService.findAll(tenantId, {
      riskLevel,
      page,
      pageSize,
    });
  }

  @Get(':id')
  @RequirePermissions('vendors:vendors:read')
  @ApiOperation({ summary: 'Get vendor details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const vendor = await this.vendorsService.findById(tenantId, id);
    return { data: vendor };
  }

  @Put(':id')
  @RequirePermissions('vendors:vendors:update')
  @ApiOperation({ summary: 'Update vendor information' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const vendor = await this.vendorsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: vendor };
  }
}
