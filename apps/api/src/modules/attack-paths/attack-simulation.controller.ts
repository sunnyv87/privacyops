import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttackSimulationService } from './attack-simulation.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Attack Simulations')
@ApiBearerAuth()
@Controller('attack-paths/simulations')
export class AttackSimulationController {
  constructor(private readonly simulationService: AttackSimulationService) {}

  @Post()
  @RequirePermissions('attack-paths:create')
  @ApiOperation({ summary: 'Run an attack simulation' })
  async runSimulation(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { scenarioType: string; config: any },
  ) {
    const simulation = await this.simulationService.runSimulation(
      tenantId,
      body.scenarioType,
      body.config,
      userId,
    );
    return { data: simulation };
  }

  @Get()
  @RequirePermissions('attack-paths:read')
  @ApiOperation({ summary: 'List attack simulations' })
  async getSimulations(
    @CurrentUser('tenantId') tenantId: string,
    @Query('scenario_type') scenarioType?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.simulationService.getSimulations(tenantId, {
      scenarioType,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('attack-paths:read')
  @ApiOperation({ summary: 'Get attack simulation details' })
  async getSimulationById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const simulation = await this.simulationService.getSimulationById(tenantId, id);
    return { data: simulation };
  }

  @Get(':id/paths')
  @RequirePermissions('attack-paths:read')
  @ApiOperation({ summary: 'Get simulated attack paths for a simulation' })
  async getSimulatedPaths(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.simulationService.getSimulatedPaths(
      tenantId,
      id,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post('identity-compromise')
  @RequirePermissions('attack-paths:create')
  @ApiOperation({ summary: 'Simulate identity compromise scenario' })
  async simulateIdentityCompromise(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { identityId: string },
  ) {
    const simulation = await this.simulationService.runSimulation(
      tenantId,
      'identity_compromise',
      { identityId: body.identityId },
      userId,
    );
    return { data: simulation };
  }

  @Post('data-exfiltration')
  @RequirePermissions('attack-paths:create')
  @ApiOperation({ summary: 'Simulate data exfiltration scenario' })
  async simulateDataExfiltration(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { assetId: string },
  ) {
    const simulation = await this.simulationService.runSimulation(
      tenantId,
      'data_exfiltration',
      { assetId: body.assetId },
      userId,
    );
    return { data: simulation };
  }
}
