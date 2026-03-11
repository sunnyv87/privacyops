import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttackPathFilterDto {
  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low', 'info'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'mitigated', 'accepted'] })
  @IsOptional()
  @IsString()
  status?: string;

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

export class UpdateAttackPathStatusDto {
  @ApiProperty({ enum: ['open', 'acknowledged', 'mitigated', 'accepted'] })
  @IsEnum(['open', 'acknowledged', 'mitigated', 'accepted'] as const)
  status: string;
}
