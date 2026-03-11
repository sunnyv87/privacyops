import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdaptivePolicyService } from './adaptive-policy.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Adaptive Policies')
@ApiBearerAuth()
@Controller('adaptive-policies')
export class AdaptivePoliciesController {
  constructor(
    private readonly adaptivePolicyService: AdaptivePolicyService,
  ) {}

  @Post()
  @RequirePermissions('policies:admin')
  @ApiOperation({ summary: 'Create a new adaptive policy' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      name: string;
      policyType: string;
      triggerConditions: any[];
      actions: any[];
      cooldownMinutes?: number;
      requiresApproval?: boolean;
    },
  ) {
    const result = await this.adaptivePolicyService.create(
      tenantId,
      userId,
      body,
    );
    return { data: result };
  }

  @Get()
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'List adaptive policies' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('policyType') policyType?: string,
    @Query('isEnabled') isEnabled?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.adaptivePolicyService.findAll(tenantId, {
      policyType,
      isEnabled: isEnabled !== undefined ? isEnabled === 'true' : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'Get adaptive policy details' })
  async findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.adaptivePolicyService.findById(tenantId, id);
    return { data: policy };
  }

  @Patch(':id')
  @RequirePermissions('policies:admin')
  @ApiOperation({ summary: 'Update an adaptive policy' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      triggerConditions: any[];
      actions: any[];
      isEnabled: boolean;
      cooldownMinutes: number;
      requiresApproval: boolean;
    }>,
  ) {
    const result = await this.adaptivePolicyService.update(
      tenantId,
      id,
      body,
    );
    return { data: result };
  }

  @Delete(':id')
  @RequirePermissions('policies:admin')
  @ApiOperation({ summary: 'Delete an adaptive policy' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.adaptivePolicyService.remove(tenantId, id);
  }

  @Post(':id/evaluate')
  @RequirePermissions('policies:admin')
  @ApiOperation({ summary: 'Evaluate an adaptive policy against current signals' })
  async evaluatePolicy(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.adaptivePolicyService.evaluatePolicy(
      tenantId,
      id,
    );
    return { data: result };
  }

  @Get(':id/executions')
  @RequirePermissions('policies:read')
  @ApiOperation({ summary: 'List policy executions' })
  async getExecutions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.adaptivePolicyService.getExecutions(tenantId, id, {
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('executions/:id/approve')
  @RequirePermissions('policies:admin')
  @ApiOperation({ summary: 'Approve a pending policy execution' })
  async approveExecution(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const result = await this.adaptivePolicyService.approveExecution(
      tenantId,
      id,
      userId,
    );
    return { data: result };
  }
}
