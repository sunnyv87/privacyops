import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartScanDto {
  @ApiProperty({ description: 'Data source ID to scan' })
  @IsString()
  dataSourceId: string;

  @ApiPropertyOptional({ description: 'Specific paths to scan' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includePaths?: string[];

  @ApiPropertyOptional({ description: 'Paths to exclude' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePaths?: string[];

  @ApiPropertyOptional({ enum: ['full', 'incremental'], default: 'incremental' })
  @IsOptional()
  @IsEnum(['full', 'incremental'] as const)
  mode?: 'full' | 'incremental';
}

export class ScanFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @ApiPropertyOptional({ enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;
}
