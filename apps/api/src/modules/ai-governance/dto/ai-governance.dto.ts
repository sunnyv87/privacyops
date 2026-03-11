import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateAiSystemDto {
  @ApiProperty({ example: 'Customer Churn Prediction Model' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the AI system' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: ['high', 'limited', 'minimal', 'unacceptable'] })
  @IsOptional()
  @IsString()
  riskCategory?: string;

  @ApiPropertyOptional({ description: 'Purpose of the AI system' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ description: 'Vendor or provider of the AI system' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ description: 'Regulatory basis references' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regulatoryBasis?: string[];

  @ApiPropertyOptional({ description: 'Data categories used by the AI system' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataCategories?: string[];

  @ApiPropertyOptional({ description: 'Owner user ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateAiSystemDto extends PartialType(CreateAiSystemDto) {
  @ApiPropertyOptional({ enum: ['draft', 'active', 'under_review', 'decommissioned'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class RecordDatasetUsageDto {
  @ApiProperty({ description: 'AI system ID' })
  @IsString()
  aiSystemId: string;

  @ApiProperty({ description: 'Dataset or data asset ID' })
  @IsString()
  datasetId: string;

  @ApiProperty({ enum: ['training', 'validation', 'inference', 'fine_tuning'] })
  @IsString()
  usageType: string;

  @ApiPropertyOptional({ description: 'Description of how the dataset is used' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Data categories in the dataset' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataCategories?: string[];
}

export class AiSystemFilterDto {
  @ApiPropertyOptional({ enum: ['high', 'limited', 'minimal', 'unacceptable'] })
  @IsOptional()
  @IsString()
  riskCategory?: string;

  @ApiPropertyOptional({ enum: ['draft', 'active', 'under_review', 'decommissioned'] })
  @IsOptional()
  @IsString()
  status?: string;
}
