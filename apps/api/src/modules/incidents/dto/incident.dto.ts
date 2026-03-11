import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Unauthorized data access detected' })
  @IsString()
  title: string;

  @ApiProperty({ enum: ['p1', 'p2', 'p3', 'p4'] })
  @IsEnum(['p1', 'p2', 'p3', 'p4'] as const)
  severity: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  affectedDataSubjects?: number;

  @ApiPropertyOptional({ description: 'Asset IDs affected' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedAssetIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBreach?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @ApiPropertyOptional({ enum: ['reported', 'confirmed', 'investigating', 'contained', 'resolved', 'closed'] })
  @IsOptional()
  @IsEnum(['reported', 'confirmed', 'investigating', 'contained', 'resolved', 'closed'] as const)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  containmentActions?: string;
}

export class IncidentFilterDto {
  @ApiPropertyOptional({ enum: ['p1', 'p2', 'p3', 'p4'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ enum: ['reported', 'confirmed', 'investigating', 'contained', 'resolved', 'closed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  breachOnly?: boolean;
}
