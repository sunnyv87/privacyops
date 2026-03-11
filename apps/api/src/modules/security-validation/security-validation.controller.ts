import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityValidationService } from './security-validation.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Security Validation')
@ApiBearerAuth()
@Controller('security-validation')
export class SecurityValidationController {
  constructor(
    private readonly validationService: SecurityValidationService,
  ) {}

  @Post('run')
  @RequirePermissions('validation:admin')
  @ApiOperation({ summary: 'Start a new validation run' })
  async startValidationRun(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body('runType') runType: string,
  ) {
    const run = await this.validationService.startValidationRun(
      tenantId,
      runType,
      userId,
    );
    return { data: run };
  }

  @Get('runs')
  @RequirePermissions('validation:read')
  @ApiOperation({ summary: 'List validation runs' })
  async getValidationRuns(
    @CurrentUser('tenantId') tenantId: string,
    @Query('run_type') runType?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.validationService.getValidationRuns(tenantId, {
      runType,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('runs/:id')
  @RequirePermissions('validation:read')
  @ApiOperation({ summary: 'Get a validation run by ID' })
  async getValidationRunById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const run = await this.validationService.getValidationRunById(
      tenantId,
      id,
    );
    return { data: run };
  }

  @Get('posture')
  @RequirePermissions('validation:read')
  @ApiOperation({ summary: 'Get current security posture' })
  async getCurrentPosture(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const posture = await this.validationService.getCurrentPosture(tenantId);
    return { data: posture };
  }

  @Get('tests')
  @RequirePermissions('validation:read')
  @ApiOperation({ summary: 'List validation tests' })
  async getTests(
    @CurrentUser('tenantId') tenantId: string,
    @Query('test_category') testCategory?: string,
    @Query('is_enabled') isEnabled?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.validationService.getTests(tenantId, {
      testCategory,
      isEnabled: isEnabled !== undefined ? isEnabled === 'true' : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('tests')
  @RequirePermissions('validation:admin')
  @ApiOperation({ summary: 'Create a validation test' })
  async createTest(
    @CurrentUser('tenantId') tenantId: string,
    @Body()
    dto: {
      testName: string;
      testCategory: string;
      testLogic: any;
      isEnabled?: boolean;
    },
  ) {
    const test = await this.validationService.createTest(tenantId, dto);
    return { data: test };
  }

  @Patch('tests/:id')
  @RequirePermissions('validation:admin')
  @ApiOperation({ summary: 'Update a validation test' })
  async updateTest(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<{ testLogic: any; isEnabled: boolean }>,
  ) {
    const test = await this.validationService.updateTest(tenantId, id, dto);
    return { data: test };
  }

  @Post('verify-remediation/:actionId')
  @RequirePermissions('validation:admin')
  @ApiOperation({ summary: 'Verify a remediation action' })
  async verifyRemediation(
    @CurrentUser('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
  ) {
    const result = await this.validationService.verifyRemediation(
      tenantId,
      actionId,
    );
    return { data: result };
  }
}
