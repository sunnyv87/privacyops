import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class RedactTextDto {
  @ApiProperty({ description: 'Text content to redact', maxLength: 1_000_000 })
  @IsString()
  @MaxLength(1_000_000)
  text: string;

  @ApiPropertyOptional({
    description: 'Preserve these exact strings (e.g. the subject\'s own email)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preserve?: string[];

  @ApiPropertyOptional({
    description: 'PII categories to redact. Defaults to all.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

export interface RedactionMatch {
  type: string;
  start: number;
  end: number;
  original: string;
  replacement: string;
}

export interface RedactionResult {
  redactedText: string;
  matches: RedactionMatch[];
  categoriesFound: Record<string, number>;
}
