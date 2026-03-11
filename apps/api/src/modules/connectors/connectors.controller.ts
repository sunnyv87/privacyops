import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectorsService } from './connectors.service';
import {
  CreateConnectorDto,
  UpdateConnectorDto,
} from './dto/connector.dto';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Connectors')
@ApiBearerAuth()
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Post()
  @RequirePermissions('dspm:connectors:create')
  @ApiOperation({ summary: 'Register a new data source connector' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConnectorDto,
  ) {
    const connector = await this.connectorsService.create(
      tenantId,
      userId,
      dto,
    );
    return { data: connector };
  }

  @Get()
  @RequirePermissions('dspm:connectors:read')
  @ApiOperation({ summary: 'List all connectors' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.connectorsService.findAll(tenantId, {
      type,
      status,
      page,
      pageSize,
    });
  }

  @Get('available')
  @RequirePermissions('dspm:connectors:read')
  @ApiOperation({ summary: 'List available connector types' })
  async getAvailableTypes() {
    return { data: this.connectorsService.getAvailableConnectors() };
  }

  @Get(':id')
  @RequirePermissions('dspm:connectors:read')
  @ApiOperation({ summary: 'Get connector details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const connector = await this.connectorsService.findById(tenantId, id);
    return { data: connector };
  }

  @Put(':id')
  @RequirePermissions('dspm:connectors:update')
  @ApiOperation({ summary: 'Update connector configuration' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConnectorDto,
  ) {
    const connector = await this.connectorsService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: connector };
  }

  @Post(':id/test')
  @RequirePermissions('dspm:connectors:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test connector connection' })
  async testConnection(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const result = await this.connectorsService.testConnection(tenantId, id);
    return { data: result };
  }

  @Delete(':id')
  @RequirePermissions('dspm:connectors:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a connector (soft delete)' })
  async delete(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.connectorsService.delete(tenantId, id, userId);
  }
}
