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
import { AssessmentsService } from './assessments.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Assessments')
@ApiBearerAuth()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @RequirePermissions('assessments:assessments:create')
  @ApiOperation({ summary: 'Create a new privacy impact assessment' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const assessment = await this.assessmentsService.create(
      tenantId,
      userId,
      dto,
    );
    return { data: assessment };
  }

  @Get()
  @RequirePermissions('assessments:assessments:read')
  @ApiOperation({ summary: 'List privacy impact assessments' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.assessmentsService.findAll(tenantId, {
      status,
      page,
      pageSize,
    });
  }

  @Get(':id')
  @RequirePermissions('assessments:assessments:read')
  @ApiOperation({ summary: 'Get assessment details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const assessment = await this.assessmentsService.findById(tenantId, id);
    return { data: assessment };
  }

  @Put(':id')
  @RequirePermissions('assessments:assessments:update')
  @ApiOperation({ summary: 'Update an assessment' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const assessment = await this.assessmentsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: assessment };
  }
}
