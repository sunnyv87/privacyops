import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposeActionDto {
  @ApiProperty()
  @IsString()
  findingId: string;

  @ApiProperty({ enum: ['revoke_access', 'encrypt', 'enable_mfa', 'apply_retention', 'restrict_public', 'delete_data', 'mask_data', 'quarantine'] })
  @IsString()
  actionType: string;
}

export class RemediationFilterDto {
  @ApiPropertyOptional({ enum: ['proposed', 'approved', 'executing', 'completed', 'failed', 'rolled_back'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  findingId?: string;

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
