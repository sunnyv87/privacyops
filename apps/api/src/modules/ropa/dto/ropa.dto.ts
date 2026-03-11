import { IsString, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateRopaEntryDto {
  @ApiProperty({ example: 'Customer onboarding and KYC' })
  @IsString()
  processingPurpose: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ['consent', 'contract', 'legal_obligation', 'vital_interest', 'public_interest', 'legitimate_interest'] })
  @IsEnum(['consent', 'contract', 'legal_obligation', 'vital_interest', 'public_interest', 'legitimate_interest'] as const)
  lawfulBasis: string;

  @ApiProperty({ example: ['name', 'email', 'address', 'aadhaar'] })
  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];

  @ApiProperty({ example: ['customers', 'employees'] })
  @IsArray()
  @IsString({ each: true })
  dataSubjectCategories: string[];

  @ApiPropertyOptional({ example: ['Cloud provider', 'Payment processor'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @ApiPropertyOptional({ example: '365 days' })
  @IsOptional()
  @IsString()
  retentionPeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalMeasures?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationalMeasures?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpiaRequired?: boolean;
}

export class UpdateRopaEntryDto extends PartialType(CreateRopaEntryDto) {}

export class RopaFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lawfulBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dpiaRequired?: boolean;
}
