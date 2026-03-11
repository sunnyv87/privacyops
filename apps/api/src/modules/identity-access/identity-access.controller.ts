import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IdentityAccessService } from './identity-access.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Identity Access')
@ApiBearerAuth()
@Controller('identity-access')
export class IdentityAccessController {
  constructor(private readonly identityAccessService: IdentityAccessService) {}

  @Get('mappings')
  @RequirePermissions('dspm:identity-access:read')
  @ApiOperation({ summary: 'List identity access mappings with filters' })
  async findMappings(
    @CurrentUser('tenantId') tenantId: string,
    @Query('identity_type') identityType?: string,
    @Query('asset_id') assetId?: string,
    @Query('is_excessive') isExcessive?: string,
    @Query('is_inactive') isInactive?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.identityAccessService.findMappings(tenantId, {
      identityType,
      assetId,
      isExcessive: isExcessive !== undefined ? isExcessive === 'true' : undefined,
      isInactive: isInactive !== undefined ? isInactive === 'true' : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('anomalies')
  @RequirePermissions('dspm:identity-access:read')
  @ApiOperation({ summary: 'Get identity access anomalies grouped by type' })
  async getAnomalies(@CurrentUser('tenantId') tenantId: string) {
    return this.identityAccessService.getAnomalies(tenantId);
  }

  @Get('identities/:id/data-access')
  @RequirePermissions('dspm:identity-access:read')
  @ApiOperation({ summary: 'Get all assets accessible by an identity' })
  async getIdentityDataAccess(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') identityId: string,
  ) {
    return this.identityAccessService.getIdentityDataAccess(tenantId, identityId);
  }

  @Get('assets/:id/identities')
  @RequirePermissions('dspm:identity-access:read')
  @ApiOperation({ summary: 'Get all identities that can access an asset' })
  async getAssetIdentities(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') assetId: string,
  ) {
    return this.identityAccessService.getAssetIdentities(tenantId, assetId);
  }

  @Get('stats')
  @RequirePermissions('dspm:identity-access:read')
  @ApiOperation({ summary: 'Get identity access statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.identityAccessService.getStats(tenantId);
    return { data: stats };
  }
}
