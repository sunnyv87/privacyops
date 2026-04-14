import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';

/**
 * Platform-admin tenant controller. All endpoints here require
 * `admin:tenants:manage` which is reserved for the super-admin role.
 * Regular tenant users should NOT be able to enumerate or provision
 * tenants.
 */
@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Post()
  @RequirePermissions('admin:tenants:manage')
  @ApiOperation({ summary: 'Provision a new tenant with initial admin user' })
  async provision(
    @CurrentUser('id') actorId: string,
    @Body() dto: ProvisionTenantDto,
  ) {
    const result = await this.tenants.provisionTenant(actorId, dto);
    return { data: result };
  }

  @Get(':id')
  @RequirePermissions('admin:tenants:manage')
  @ApiOperation({ summary: 'Get a tenant by id (platform admin only)' })
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenants.findById(id);
    return { data: tenant };
  }
}
