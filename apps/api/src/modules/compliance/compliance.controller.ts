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
import { ComplianceService } from './compliance.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('frameworks')
  @RequirePermissions('compliance:frameworks:create')
  @ApiOperation({ summary: 'Add a compliance framework' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const framework = await this.complianceService.create(
      tenantId,
      userId,
      dto,
    );
    return { data: framework };
  }

  @Get('frameworks')
  @RequirePermissions('compliance:frameworks:read')
  @ApiOperation({ summary: 'List compliance frameworks' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.complianceService.findAll(tenantId, { page, pageSize });
  }

  @Get('frameworks/:id')
  @RequirePermissions('compliance:frameworks:read')
  @ApiOperation({ summary: 'Get compliance framework details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const framework = await this.complianceService.findById(tenantId, id);
    return { data: framework };
  }

  @Put('frameworks/:id')
  @RequirePermissions('compliance:frameworks:update')
  @ApiOperation({ summary: 'Update a compliance framework' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const framework = await this.complianceService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: framework };
  }
}
