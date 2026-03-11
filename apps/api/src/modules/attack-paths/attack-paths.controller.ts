import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttackPathsService } from './attack-paths.service';
import { AttackPathAnalyzer } from './attack-path-analyzer';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { UpdateAttackPathStatusDto } from './dto/attack-path.dto';

@ApiTags('Attack Paths')
@ApiBearerAuth()
@Controller('attack-paths')
export class AttackPathsController {
  constructor(
    private readonly attackPathsService: AttackPathsService,
    private readonly attackPathAnalyzer: AttackPathAnalyzer,
  ) {}

  @Get()
  @RequirePermissions('dspm:attack-paths:read')
  @ApiOperation({ summary: 'List attack paths with filters' })
  async getAttackPaths(
    @CurrentUser('tenantId') tenantId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.attackPathsService.getAttackPaths(tenantId, {
      severity,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('stats')
  @RequirePermissions('dspm:attack-paths:read')
  @ApiOperation({ summary: 'Get attack path statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.attackPathsService.getStats(tenantId);
    return { data: stats };
  }

  @Get(':id')
  @RequirePermissions('dspm:attack-paths:read')
  @ApiOperation({ summary: 'Get attack path details' })
  async getAttackPathById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const path = await this.attackPathsService.getAttackPathById(tenantId, id);
    return { data: path };
  }

  @Patch(':id/status')
  @RequirePermissions('dspm:attack-paths:update')
  @ApiOperation({ summary: 'Update attack path status' })
  async updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttackPathStatusDto,
  ) {
    const path = await this.attackPathsService.updateStatus(
      tenantId,
      id,
      dto.status,
      userId,
    );
    return { data: path };
  }

  @Post('analyze')
  @RequirePermissions('dspm:attack-paths:create')
  @ApiOperation({ summary: 'Trigger attack path analysis' })
  async analyze(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.attackPathAnalyzer.analyzeAttackPaths(tenantId);
    return { data: result };
  }
}
