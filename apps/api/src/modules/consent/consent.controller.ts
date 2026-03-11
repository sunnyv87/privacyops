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
import { ConsentService } from './consent.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Consent')
@ApiBearerAuth()
@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('records')
  @RequirePermissions('consent:records:create')
  @ApiOperation({ summary: 'Record a new consent entry' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const record = await this.consentService.create(tenantId, userId, dto);
    return { data: record };
  }

  @Get('records')
  @RequirePermissions('consent:records:read')
  @ApiOperation({ summary: 'List consent records' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.consentService.findAll(tenantId, { page, pageSize });
  }

  @Get('records/:id')
  @RequirePermissions('consent:records:read')
  @ApiOperation({ summary: 'Get consent record details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const record = await this.consentService.findById(tenantId, id);
    return { data: record };
  }

  @Put('records/:id')
  @RequirePermissions('consent:records:update')
  @ApiOperation({ summary: 'Update a consent record' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const record = await this.consentService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: record };
  }
}
