import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindingFilterDto {
  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low', 'info'] })
  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low', 'info'] as const)
  severity?: string;

  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'mitigated', 'accepted', 'false_positive'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number;
}

export class UpdateFindingStatusDto {
  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'mitigated', 'accepted', 'false_positive'] })
  @IsEnum(['open', 'acknowledged', 'mitigated', 'accepted', 'false_positive'] as const)
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
