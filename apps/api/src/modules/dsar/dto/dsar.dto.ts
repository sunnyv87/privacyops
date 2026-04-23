import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDsarDto {
  @ApiProperty({ enum: ['access', 'deletion', 'rectification', 'portability', 'objection', 'restriction'] })
  @IsEnum(['access', 'deletion', 'rectification', 'portability', 'objection', 'restriction'] as const)
  type: string;

  @ApiProperty({ description: 'Data subject email' })
  @IsString()
  dataSubjectEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataSubjectName?: string;

  @ApiPropertyOptional({ description: 'Data subject phone number (optional, for fuzzy identity match)' })
  @IsOptional()
  @IsString()
  dataSubjectPhone?: string;

  @ApiPropertyOptional({ description: 'External subject identifier from the requesting system (optional)' })
  @IsOptional()
  @IsString()
  externalSubjectId?: string;

  @ApiProperty({ description: 'Description of the request' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Channel: web, email, phone, postal' })
  @IsOptional()
  @IsString()
  channel?: string;
}

export class UpdateDsarStatusDto {
  @ApiProperty({
    enum: ['received', 'identity_verification', 'in_progress', 'review', 'completed', 'rejected'],
  })
  @IsEnum([
    'received', 'identity_verification', 'in_progress', 'review', 'completed', 'rejected',
  ] as const)
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Assign to user ID' })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class DsarFilterDto {
  @ApiPropertyOptional({ enum: ['access', 'deletion', 'rectification', 'portability', 'objection', 'restriction'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: ['received', 'identity_verification', 'in_progress', 'review', 'completed', 'rejected', 'overdue'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overdueOnly?: boolean;
}
