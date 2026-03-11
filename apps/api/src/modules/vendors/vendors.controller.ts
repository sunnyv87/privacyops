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
import {
  CreateVendorDto,
  UpdateVendorDto,
  CreateVendorAssessmentDto,
} from './dto/vendor.dto';

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
    @Body() dto: CreateVendorDto,
  ) {
    const vendor = await this.vendorsService.create(tenantId, userId, dto);
    return { data: vendor };
  }

  @Get('stats')
  @RequirePermissions('vendors:vendors:read')
  @ApiOperation({ summary: 'Get vendor statistics by risk tier' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.vendorsService.getStats(tenantId);
    return { data: stats };
  }

  @Get()
  @RequirePermissions('vendors:vendors:read')
  @ApiOperation({ summary: 'List vendors' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('risk_tier') riskTier?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.vendorsService.findAll(tenantId, {
      riskTier,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
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
    @Body() dto: UpdateVendorDto,
  ) {
    const vendor = await this.vendorsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: vendor };
  }

  @Post(':id/assessments')
  @RequirePermissions('vendors:assessments:create')
  @ApiOperation({ summary: 'Create a vendor assessment' })
  async createAssessment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') vendorId: string,
    @Body() dto: CreateVendorAssessmentDto,
  ) {
    // Override vendorId from the route parameter
    dto.vendorId = vendorId;
    const assessment = await this.vendorsService.createAssessment(
      tenantId,
      userId,
      dto,
    );
    return { data: assessment };
  }

  @Get(':id/assessments')
  @RequirePermissions('vendors:assessments:read')
  @ApiOperation({ summary: 'List assessments for a vendor' })
  async findAssessments(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') vendorId: string,
  ) {
    const assessments = await this.vendorsService.findAssessments(
      tenantId,
      vendorId,
    );
    return { data: assessments };
  }
}
