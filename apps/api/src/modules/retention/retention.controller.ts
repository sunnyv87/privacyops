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
import { RetentionService } from './retention.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateRetentionPolicyDto,
  UpdateRetentionPolicyDto,
} from './dto/retention.dto';

@ApiTags('Retention')
@ApiBearerAuth()
@Controller('retention')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Post('policies')
  @RequirePermissions('retention:policies:create')
  @ApiOperation({ summary: 'Create a new data retention policy' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRetentionPolicyDto,
  ) {
    const policy = await this.retentionService.create(tenantId, userId, dto);
    return { data: policy };
  }

  @Get('policies')
  @RequirePermissions('retention:policies:read')
  @ApiOperation({ summary: 'List data retention policies' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('record_category') recordCategory?: string,
    @Query('active_only') activeOnly?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.retentionService.findAll(tenantId, {
      recordCategory,
      activeOnly: activeOnly === 'true' ? true : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('policies/:id')
  @RequirePermissions('retention:policies:read')
  @ApiOperation({ summary: 'Get retention policy details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.retentionService.findById(tenantId, id);
    return { data: policy };
  }

  @Put('policies/:id')
  @RequirePermissions('retention:policies:update')
  @ApiOperation({ summary: 'Update a retention policy' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRetentionPolicyDto,
  ) {
    const policy = await this.retentionService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: policy };
  }

  @Delete('policies/:id')
  @RequirePermissions('retention:policies:delete')
  @ApiOperation({ summary: 'Deactivate a retention policy' })
  async delete(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.retentionService.delete(tenantId, id, userId);
    return { data: policy };
  }

  @Post('policies/:id/dispose')
  @RequirePermissions('retention:policies:execute')
  @ApiOperation({ summary: 'Trigger disposal workflow for expired data' })
  async triggerDisposal(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.retentionService.triggerDisposal(
      tenantId,
      id,
      userId,
    );
    return { data: result };
  }
}
