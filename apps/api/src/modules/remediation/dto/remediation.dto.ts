import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposeActionDto {
  @ApiProperty()
  @IsString()
  findingId: string;

  @ApiProperty({
    enum: [
      'revoke_access', 'encrypt', 'enable_mfa', 'apply_retention',
      'restrict_public', 'delete_data', 'mask_data', 'quarantine',
      'rotate_credentials', 'restrict_sharing', 'disable_public_access',
      'enforce_encryption',
    ],
  })
  @IsString()
  actionType: string;
}

export class RemediationFilterDto {
  @ApiPropertyOptional({
    enum: [
      'proposed', 'approved', 'executing', 'completed',
      'failed', 'rolled_back', 'unsupported', 'manual_required',
    ],
  })
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
