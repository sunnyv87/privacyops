import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class IdentityAccessFilterDto {
  @ApiPropertyOptional({ description: 'Filter by identity type (user, service_account, role, group, public)' })
  @IsOptional()
  @IsString()
  identityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExcessive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInactive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number;
}
