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
import { ClassificationService } from './classification.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Classification')
@ApiBearerAuth()
@Controller('classification')
export class ClassificationController {
  constructor(
    private readonly classificationService: ClassificationService,
  ) {}

  @Post('rules')
  @RequirePermissions('classification:rules:create')
  @ApiOperation({ summary: 'Create a new classification rule' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    const rule = await this.classificationService.create(
      tenantId,
      userId,
      dto,
    );
    return { data: rule };
  }

  @Get('rules')
  @RequirePermissions('classification:rules:read')
  @ApiOperation({ summary: 'List classification rules' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.classificationService.findAll(tenantId, { page, pageSize });
  }

  @Get('rules/:id')
  @RequirePermissions('classification:rules:read')
  @ApiOperation({ summary: 'Get classification rule details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const rule = await this.classificationService.findById(tenantId, id);
    return { data: rule };
  }

  @Put('rules/:id')
  @RequirePermissions('classification:rules:update')
  @ApiOperation({ summary: 'Update a classification rule' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const rule = await this.classificationService.update(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: rule };
  }
}
