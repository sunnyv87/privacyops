import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateConsentNoticeDto {
  @ApiProperty({ example: 'Marketing Communications Consent' })
  @IsString()
  name: string;

  @ApiProperty({ example: '1.0' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'HTML or markdown content of the notice' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Processing purpose IDs linked to this notice' })
  @IsArray()
  @IsString({ each: true })
  purposeIds: string[];
}

export class UpdateConsentNoticeDto extends PartialType(CreateConsentNoticeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RecordConsentDto {
  @ApiProperty({ description: 'Data subject email or identifier' })
  @IsString()
  dataSubjectIdentifier: string;

  @ApiProperty({ description: 'Consent notice ID' })
  @IsString()
  noticeId: string;

  @ApiProperty({ enum: ['granted', 'denied'] })
  @IsEnum(['granted', 'denied'] as const)
  status: 'granted' | 'denied';

  @ApiPropertyOptional({ description: 'Channel (web, mobile, email, offline)' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class RevokeConsentDto {
  @ApiProperty()
  @IsString()
  dataSubjectIdentifier: string;

  @ApiProperty()
  @IsString()
  noticeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateProcessingPurposeDto {
  @ApiProperty({ example: 'Direct Marketing' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Send promotional emails and offers' })
  @IsString()
  description: string;

  @ApiProperty({ enum: ['consent', 'contract', 'legal_obligation', 'legitimate_interest'] })
  @IsString()
  lawfulBasis: string;

  @ApiPropertyOptional({ description: 'Days until consent expires' })
  @IsOptional()
  retentionDays?: number;
}

export class ConsentFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataSubjectId?: string;

  @ApiPropertyOptional({ enum: ['granted', 'denied', 'revoked', 'expired'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purposeId?: string;
}
