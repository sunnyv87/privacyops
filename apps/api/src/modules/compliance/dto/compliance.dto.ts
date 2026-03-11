import { IsString, IsOptional, IsEnum, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateControlDto {
  @ApiProperty({ example: 'CTRL-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Data Encryption at Rest' })
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiProperty({ description: 'Obligation IDs this control maps to' })
  @IsArray()
  @IsString({ each: true })
  obligationIds: string[];
}

export class UpdateControlDto extends PartialType(CreateControlDto) {
  @ApiPropertyOptional({ enum: ['implemented', 'partial', 'planned', 'not_applicable'] })
  @IsOptional()
  @IsEnum(['implemented', 'partial', 'planned', 'not_applicable'] as const)
  status?: string;
}

export class AddEvidenceDto {
  @ApiProperty()
  @IsString()
  controlId: string;

  @ApiProperty({ enum: ['document', 'screenshot', 'log', 'certificate', 'other'] })
  @IsString()
  type: string;

  @ApiProperty({ description: 'URL or S3 key to the evidence artifact' })
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class ComplianceFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regulationId?: string;

  @ApiPropertyOptional({ enum: ['implemented', 'partial', 'planned', 'not_applicable'] })
  @IsOptional()
  @IsString()
  controlStatus?: string;
}
