import { IsString, IsOptional, IsEnum, IsArray, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateVendorDto {
  @ApiProperty({ example: 'Acme Cloud Services' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsEnum(['critical', 'high', 'medium', 'low'] as const)
  riskTier: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  contractExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataProcessingPurposes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataCategories?: string[];
}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiPropertyOptional({ enum: ['active', 'under_review', 'suspended', 'terminated'] })
  @IsOptional()
  @IsEnum(['active', 'under_review', 'suspended', 'terminated'] as const)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dpaSignedAt?: string;
}

export class CreateVendorAssessmentDto {
  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  findings?: { category: string; finding: string; severity: string }[];
}

export class VendorFilterDto {
  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsOptional()
  @IsString()
  riskTier?: string;

  @ApiPropertyOptional({ enum: ['active', 'under_review', 'suspended', 'terminated'] })
  @IsOptional()
  @IsString()
  status?: string;
}
