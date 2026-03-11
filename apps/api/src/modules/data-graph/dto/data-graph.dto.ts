import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNodeDto {
  @ApiProperty({ description: 'Node type', enum: ['asset', 'dataset', 'column', 'identity', 'vendor', 'ai_system', 'processing_activity', 'retention_policy'] })
  @IsString()
  nodeType: string;

  @ApiProperty({ description: 'Entity ID this node represents' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Display label for the node' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateEdgeDto {
  @ApiProperty({ description: 'Source node ID' })
  @IsString()
  sourceNodeId: string;

  @ApiProperty({ description: 'Target node ID' })
  @IsString()
  targetNodeId: string;

  @ApiProperty({
    description: 'Relationship type',
    enum: ['CONTAINS', 'STORED_IN', 'ACCESSIBLE_BY', 'OWNED_BY', 'SHARED_WITH', 'USED_BY_AI', 'GOVERNED_BY'],
  })
  @IsString()
  relationshipType: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Confidence score (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class FindNodesQueryDto {
  @ApiPropertyOptional({ enum: ['asset', 'dataset', 'column', 'identity', 'vendor', 'ai_system', 'processing_activity', 'retention_policy'] })
  @IsOptional()
  @IsString()
  nodeType?: string;

  @ApiPropertyOptional({ description: 'Search by label' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class FindPathsQueryDto {
  @ApiProperty({ description: 'Source node ID' })
  @IsString()
  from: string;

  @ApiProperty({ description: 'Target node ID' })
  @IsString()
  to: string;

  @ApiPropertyOptional({ description: 'Maximum path depth', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth?: number;
}

export class SubgraphQueryDto {
  @ApiProperty({ description: 'Entity type' })
  @IsString()
  entityType: string;

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  entityId: string;
}
