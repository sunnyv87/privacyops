import { IsString, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean } from 'class-validator';
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

  @ApiPropertyOptional({
    enum: ['full', 'incremental', 'targeted', 'shadow'],
    description: 'Discovery mode for the scan',
  })
  @IsOptional()
  @IsEnum(['full', 'incremental', 'targeted', 'shadow'] as const)
  discoveryMode?: 'full' | 'incremental' | 'targeted' | 'shadow';

  @ApiPropertyOptional({
    description: 'Scan scope configuration (includePatterns, excludePatterns, depth)',
  })
  @IsOptional()
  scanScope?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    depth?: number;
  };

  @ApiPropertyOptional({
    description: 'Enable post-discovery enrichment phases',
  })
  @IsOptional()
  enrichment?: {
    /** Populate AssetField records via getAssetSchema(). Default: true */
    schema?: boolean;
    /** Collect sample values via sampleContent(). Default: true */
    sampling?: boolean;
    /** Collect access policies via getAccessPolicies(). Default: true */
    accessPolicies?: boolean;
    /** Max sample values per field. Default: 5 */
    maxSampleValuesPerField?: number;
  };
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

export class ShadowDataSummaryDto {
  @ApiProperty({ description: 'Total shadow data assets found' })
  count: number;

  @ApiProperty({ description: 'Assets with matching fingerprints across data sources' })
  duplicateFingerprints: number;

  @ApiProperty({ description: 'Assets without an assigned owner' })
  unownedAssets: number;

  @ApiProperty({ description: 'Assets not scanned in over 180 days' })
  staleAssets: number;

  @ApiProperty({ description: 'List of shadow data asset summaries' })
  assets: {
    id: string;
    name: string;
    dataSourceId: string;
    reason: string;
  }[];
}

export class AiDatasetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  dataSourceId: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  sizeBytes?: bigint;

  @ApiPropertyOptional()
  lastScannedAt?: Date;
}

export class EnrichAssetMetadataDto {
  @ApiPropertyOptional({ description: 'Owner email address' })
  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional({ enum: ['encrypted', 'unencrypted', 'unknown'] })
  @IsOptional()
  @IsEnum(['encrypted', 'unencrypted', 'unknown'] as const)
  encryptionStatus?: 'encrypted' | 'unencrypted' | 'unknown';

  @ApiPropertyOptional({ description: 'Storage location identifier' })
  @IsOptional()
  @IsString()
  storageLocation?: string;

  @ApiPropertyOptional({ description: 'Access permissions configuration' })
  @IsOptional()
  accessPermissions?: any;
}
