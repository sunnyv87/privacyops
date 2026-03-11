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
import { UsersService } from './users.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { CreateUserDto, UpdateUserDto, AssignRolesDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users:users:create')
  @ApiOperation({ summary: 'Create a new user' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.usersService.create(tenantId, userId, dto);
    return { data: user };
  }

  @Get()
  @RequirePermissions('users:users:read')
  @ApiOperation({ summary: 'List users' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('role') role?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.usersService.findAll(tenantId, { role, page, pageSize });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const user = await this.usersService.findById(tenantId, userId);
    return { data: user };
  }

  @Get(':id')
  @RequirePermissions('users:users:read')
  @ApiOperation({ summary: 'Get user details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const user = await this.usersService.findById(tenantId, id);
    return { data: user };
  }

  @Put(':id')
  @RequirePermissions('users:users:update')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(tenantId, id, userId, dto);
    return { data: user };
  }

  @Put(':id/roles')
  @RequirePermissions('users:users:update')
  @ApiOperation({ summary: 'Assign roles to a user' })
  async assignRoles(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ) {
    const user = await this.usersService.assignRoles(tenantId, id, actorId, dto.roleIds);
    return { data: user };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users:users:delete')
  @ApiOperation({ summary: 'Deactivate a user' })
  async delete(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
  ) {
    await this.usersService.delete(tenantId, id, actorId);
  }
}
