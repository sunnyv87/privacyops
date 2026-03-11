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
import { AssessmentsService } from './assessments.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

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
    @Body() dto: CreateAssessmentDto,
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
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('owner_id') ownerId?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.assessmentsService.findAll(tenantId, {
      type,
      status,
      ownerId,
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
    @Body() dto: UpdateAssessmentDto,
  ) {
    const assessment = await this.assessmentsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: assessment };
  }

  @Delete(':id')
  @RequirePermissions('assessments:assessments:delete')
  @ApiOperation({ summary: 'Archive an assessment' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const assessment = await this.assessmentsService.delete(
      tenantId,
      id,
      userId,
    );
    return { data: assessment };
  }

  // ---------------------------------------------------------------------------
  // DPIA Triggers
  // ---------------------------------------------------------------------------

  @Post('check-triggers')
  @RequirePermissions('assessments:assessments:read')
  @ApiOperation({ summary: 'Check if DPIA triggers are matched' })
  async checkTriggers(
    @CurrentUser('tenantId') tenantId: string,
    @Body()
    context: {
      dataCategories?: string[];
      subjectCount?: number;
      crossBorder?: boolean;
      aiUsage?: boolean;
    },
  ) {
    const result = await this.assessmentsService.checkTriggers(
      tenantId,
      context,
    );
    return { data: result };
  }

  @Get(':id/privacy-risk')
  @RequirePermissions('assessments:assessments:read')
  @ApiOperation({ summary: 'Calculate privacy risk score for an assessment' })
  async calculatePrivacyRisk(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.assessmentsService.calculatePrivacyRisk(
      tenantId,
      id,
    );
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Trigger Rules CRUD
  // ---------------------------------------------------------------------------

  @Post('trigger-rules')
  @RequirePermissions('assessments:assessments:create')
  @ApiOperation({ summary: 'Create a DPIA trigger rule' })
  async createTriggerRule(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { name: string; condition: any; isActive?: boolean },
  ) {
    const rule = await this.assessmentsService.createTriggerRule(tenantId, dto);
    return { data: rule };
  }

  @Get('trigger-rules')
  @RequirePermissions('assessments:assessments:read')
  @ApiOperation({ summary: 'List DPIA trigger rules' })
  async findTriggerRules(@CurrentUser('tenantId') tenantId: string) {
    const rules = await this.assessmentsService.findTriggerRules(tenantId);
    return { data: rules };
  }

  @Put('trigger-rules/:id')
  @RequirePermissions('assessments:assessments:update')
  @ApiOperation({ summary: 'Update a DPIA trigger rule' })
  async updateTriggerRule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; condition?: any; isActive?: boolean },
  ) {
    const rule = await this.assessmentsService.updateTriggerRule(
      tenantId,
      id,
      dto,
    );
    return { data: rule };
  }

  @Delete('trigger-rules/:id')
  @RequirePermissions('assessments:assessments:delete')
  @ApiOperation({ summary: 'Delete a DPIA trigger rule' })
  async deleteTriggerRule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.assessmentsService.deleteTriggerRule(
      tenantId,
      id,
    );
    return { data: result };
  }
}
