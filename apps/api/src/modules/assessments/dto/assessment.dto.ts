import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateAssessmentDto {
  @ApiProperty({ example: 'DPIA: Customer Analytics Platform' })
  @IsString()
  title: string;

  @ApiProperty({ enum: ['dpia', 'pia', 'tia', 'lia'] })
  @IsEnum(['dpia', 'pia', 'tia', 'lia'] as const)
  type: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateAssessmentDto extends PartialType(CreateAssessmentDto) {
  @ApiPropertyOptional({ enum: ['draft', 'in_review', 'approved', 'rejected', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'in_review', 'approved', 'rejected', 'archived'] as const)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerId?: string;
}

export class AssessmentFilterDto {
  @ApiPropertyOptional({ enum: ['dpia', 'pia', 'tia', 'lia'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: ['draft', 'in_review', 'approved', 'rejected', 'archived'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
