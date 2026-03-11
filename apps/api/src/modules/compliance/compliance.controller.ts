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
import {
  CreateControlDto,
  UpdateControlDto,
  AddEvidenceDto,
} from './dto/compliance.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('regulations')
  @RequirePermissions('compliance:regulations:read')
  @ApiOperation({ summary: 'List all regulations with compliance scores' })
  async findAllRegulations(@CurrentUser('tenantId') tenantId: string) {
    const regulations = await this.complianceService.findAllRegulations(tenantId);
    return { data: regulations };
  }

  @Get('regulations/:id')
  @RequirePermissions('compliance:regulations:read')
  @ApiOperation({ summary: 'Get regulation with obligations' })
  async findRegulationById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const regulation = await this.complianceService.findRegulationById(
      tenantId,
      id,
    );
    return { data: regulation };
  }

  @Get('controls')
  @RequirePermissions('compliance:controls:read')
  @ApiOperation({ summary: 'List controls with obligation mapping' })
  async findAllControls(
    @CurrentUser('tenantId') tenantId: string,
    @Query('regulation_id') regulationId?: string,
    @Query('status') controlStatus?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.complianceService.findAllControls(tenantId, {
      regulationId,
      controlStatus,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('controls')
  @RequirePermissions('compliance:controls:create')
  @ApiOperation({ summary: 'Create a control mapped to obligations' })
  async createControl(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateControlDto,
  ) {
    const control = await this.complianceService.createControl(
      tenantId,
      userId,
      dto,
    );
    return { data: control };
  }

  @Put('controls/:id')
  @RequirePermissions('compliance:controls:update')
  @ApiOperation({ summary: 'Update a control status' })
  async updateControl(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateControlDto,
  ) {
    const control = await this.complianceService.updateControl(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: control };
  }

  @Post('evidence')
  @RequirePermissions('compliance:evidence:create')
  @ApiOperation({ summary: 'Add evidence artifact to a control' })
  async addEvidence(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddEvidenceDto,
  ) {
    const evidence = await this.complianceService.addEvidence(
      tenantId,
      userId,
      dto,
    );
    return { data: evidence };
  }

  @Get('scorecard')
  @RequirePermissions('compliance:scorecard:read')
  @ApiOperation({ summary: 'Get compliance scorecard' })
  async getScorecard(@CurrentUser('tenantId') tenantId: string) {
    const scorecard = await this.complianceService.getScorecard(tenantId);
    return { data: scorecard };
  }

  // ---------------------------------------------------------------------------
  // Gaps
  // ---------------------------------------------------------------------------

  @Get('gaps')
  @RequirePermissions('compliance:controls:read')
  @ApiOperation({ summary: 'List compliance gaps' })
  async findGaps(
    @CurrentUser('tenantId') tenantId: string,
    @Query('regulation_id') regulationId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.complianceService.findGaps(tenantId, {
      regulationId,
      severity,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // Auto Evidence Collection
  // ---------------------------------------------------------------------------

  @Post('auto-evidence')
  @RequirePermissions('compliance:evidence:create')
  @ApiOperation({ summary: 'Auto-collect evidence for a control' })
  async autoCollectEvidence(
    @CurrentUser('tenantId') tenantId: string,
    @Body('controlId') controlId: string,
  ) {
    const result = await this.complianceService.autoCollectEvidence(
      tenantId,
      controlId,
    );
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Cross-Regulation Map
  // ---------------------------------------------------------------------------

  @Get('cross-map')
  @RequirePermissions('compliance:controls:read')
  @ApiOperation({ summary: 'Get cross-regulation control mapping' })
  async mapCrossRegulation(@CurrentUser('tenantId') tenantId: string) {
    const map = await this.complianceService.mapCrossRegulation(tenantId);
    return { data: map };
  }

  // ---------------------------------------------------------------------------
  // Frameworks
  // ---------------------------------------------------------------------------

  @Post('frameworks/import')
  @RequirePermissions('compliance:regulations:create')
  @ApiOperation({ summary: 'Import a compliance framework' })
  async importFramework(
    @Body()
    dto: {
      name: string;
      shortName: string;
      version: string;
      obligations?: any[];
    },
  ) {
    const framework = await this.complianceService.importFramework(dto);
    return { data: framework };
  }

  @Get('frameworks')
  @RequirePermissions('compliance:regulations:read')
  @ApiOperation({ summary: 'List compliance frameworks' })
  async findFrameworks() {
    const frameworks = await this.complianceService.findFrameworks();
    return { data: frameworks };
  }
}
