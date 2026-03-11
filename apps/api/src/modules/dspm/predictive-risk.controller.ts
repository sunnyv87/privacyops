import {
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PredictiveRiskService } from './predictive-risk.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('DSPM - Predictive Risk')
@ApiBearerAuth()
@Controller('dspm/predictive')
export class PredictiveRiskController {
  constructor(
    private readonly predictiveRiskService: PredictiveRiskService,
  ) {}

  @Get('forecasts')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'List risk forecasts with filters' })
  async getForecasts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('forecast_type') forecastType?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.predictiveRiskService.getForecasts(tenantId, {
      forecastType,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('generate')
  @RequirePermissions('dspm:findings:create')
  @ApiOperation({ summary: 'Generate all predictive risk forecasts' })
  async generate(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.predictiveRiskService.generateForecasts(tenantId);
    return { data: result };
  }

  @Get('shadow-data-growth')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get shadow data growth forecasts' })
  async getShadowDataGrowth(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.predictiveRiskService.getForecasts(tenantId, {
      forecastType: 'shadow_data_growth',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('vendor-exposure')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get vendor exposure forecasts' })
  async getVendorExposure(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.predictiveRiskService.getForecasts(tenantId, {
      forecastType: 'vendor_exposure',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('governance-gaps')
  @RequirePermissions('dspm:findings:read')
  @ApiOperation({ summary: 'Get governance gap forecasts' })
  async getGovernanceGaps(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.predictiveRiskService.getForecasts(tenantId, {
      forecastType: 'governance_gap',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
