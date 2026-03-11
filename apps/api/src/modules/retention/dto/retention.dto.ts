import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateRetentionPolicyDto {
  @ApiProperty({ example: 'Customer PII Retention' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'customer_pii' })
  @IsString()
  recordCategory: string;

  @ApiProperty({ example: 365, description: 'Retention period in days' })
  @IsNumber()
  @Min(1)
  retentionDays: number;

  @ApiProperty({ enum: ['delete', 'anonymize', 'archive'] })
  @IsEnum(['delete', 'anonymize', 'archive'] as const)
  actionOnExpiry: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regulationReference?: string;
}

export class UpdateRetentionPolicyDto extends PartialType(CreateRetentionPolicyDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RetentionFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recordCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}
