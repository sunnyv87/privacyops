import { IsString, IsOptional, IsNumber, IsEnum, IsArray, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassifyAssetDto {
  @ApiProperty({ description: 'Asset ID to classify' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'Specific field IDs to classify' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldIds?: string[];

  @ApiPropertyOptional({ enum: ['regex', 'dictionary', 'ml', 'all'], default: 'all' })
  @IsOptional()
  @IsString()
  method?: string;
}

export class CreateLabelDto {
  @ApiProperty({ example: 'Custom PII Label' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['pii', 'pfi', 'phi', 'sensitive', 'public'] })
  @IsEnum(['pii', 'pfi', 'phi', 'sensitive', 'public'] as const)
  category: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  sensitivityLevel: number;

  @ApiPropertyOptional({ example: ['\\b\\d{4}-\\d{4}\\b'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patterns?: string[];

  @ApiPropertyOptional({ example: ['custom_field'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ClassificationFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelId?: string;

  @ApiPropertyOptional({ enum: ['pii', 'pfi', 'phi', 'sensitive', 'public'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}
