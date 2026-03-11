import { IsString, IsOptional, IsNumber, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordLineageDto {
  @ApiProperty()
  @IsString()
  sourceAssetId: string;

  @ApiProperty()
  @IsString()
  targetAssetId: string;

  @ApiProperty({ enum: ['copy', 'transform', 'derive', 'aggregate', 'mask', 'encrypt', 'export'] })
  @IsString()
  transformType: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class LineageFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transformType?: string;

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
