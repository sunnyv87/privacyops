import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class ShadowDataAlertFilterDto {
  @ApiPropertyOptional({ enum: ['unmanaged_store', 'duplicate_data', 'orphaned_data', 'unknown_owner', 'policy_violation'] })
  @IsOptional()
  @IsString()
  alertType?: string;

  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'resolved', 'dismissed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low', 'info'] })
  @IsOptional()
  @IsString()
  severity?: string;

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

export class UpdateAlertStatusDto {
  @ApiProperty({ enum: ['open', 'acknowledged', 'resolved', 'dismissed'] })
  @IsEnum(['open', 'acknowledged', 'resolved', 'dismissed'] as const)
  status: string;
}
