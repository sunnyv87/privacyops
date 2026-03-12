import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScimService } from './scim.service';
import { ScimAuthGuard } from './scim-auth.guard';
import { Public } from '@/core/auth/decorators/public.decorator';

// ── SCIM DTOs ──────────────────────────────────────────────────────────────
class ScimName {
  @IsOptional() @IsString() givenName?: string;
  @IsOptional() @IsString() familyName?: string;
  @IsOptional() @IsString() formatted?: string;
}

class ScimEmail {
  @IsString() value: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsBoolean() primary?: boolean;
}

class ScimUserDto {
  @IsOptional() @IsString() userName?: string;
  @IsOptional() @ValidateNested() @Type(() => ScimName) name?: ScimName;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ScimEmail) emails?: ScimEmail[];
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() schemas?: string[];
}

class ScimPatchOperation {
  @IsString() op: string;
  @IsOptional() @IsString() path?: string;
  @IsOptional() value?: any;
}

class ScimPatchDto {
  @IsOptional() @IsArray() schemas?: string[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ScimPatchOperation) Operations: ScimPatchOperation[];
}

/**
 * SCIM 2.0 API Controller
 *
 * Implements RFC 7644 (SCIM Protocol) for automated user provisioning.
 * All endpoints are prefixed with /scim/v2 and use the SCIM-specific auth guard
 * instead of the global JWT guard.
 */
@ApiTags('SCIM 2.0')
@ApiBearerAuth()
@Controller('scim/v2')
@Public() // Bypass global JWT guard — SCIM guard handles auth
@UseGuards(ScimAuthGuard)
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  // =========================================================================
  // Users
  // =========================================================================

  @Get('Users')
  @ApiOperation({ summary: 'List users (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async listUsers(
    @Req() req: any,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listUsers(req.tenantId, {
      filter,
      startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
      count: count ? parseInt(count, 10) : undefined,
    });
  }

  @Get('Users/:id')
  @ApiOperation({ summary: 'Get user (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async getUser(@Req() req: any, @Param('id') id: string) {
    return this.scimService.getUser(req.tenantId, id);
  }

  @Post('Users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async createUser(@Req() req: any, @Body() body: ScimUserDto) {
    return this.scimService.createUser(req.tenantId, body);
  }

  @Put('Users/:id')
  @ApiOperation({ summary: 'Replace user (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async replaceUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ScimUserDto,
  ) {
    return this.scimService.replaceUser(req.tenantId, id, body);
  }

  @Patch('Users/:id')
  @ApiOperation({ summary: 'Patch user (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async patchUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ScimPatchDto,
  ) {
    return this.scimService.patchUser(req.tenantId, id, body);
  }

  @Delete('Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete/deactivate user (SCIM)' })
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    await this.scimService.deleteUser(req.tenantId, id);
  }

  // =========================================================================
  // Groups
  // =========================================================================

  @Get('Groups')
  @ApiOperation({ summary: 'List groups (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async listGroups(
    @Req() req: any,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listGroups(req.tenantId, {
      filter,
      startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
      count: count ? parseInt(count, 10) : undefined,
    });
  }

  @Get('Groups/:id')
  @ApiOperation({ summary: 'Get group (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async getGroup(@Req() req: any, @Param('id') id: string) {
    return this.scimService.getGroup(req.tenantId, id);
  }

  @Patch('Groups/:id')
  @ApiOperation({ summary: 'Patch group membership (SCIM)' })
  @Header('Content-Type', 'application/scim+json')
  async patchGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ScimPatchDto,
  ) {
    return this.scimService.patchGroup(req.tenantId, id, body);
  }
}
