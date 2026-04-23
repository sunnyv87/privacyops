import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedactionService } from './redaction.service';
import { RedactTextDto } from './dto/redaction.dto';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Redaction')
@ApiBearerAuth()
@Controller('redaction')
export class RedactionController {
  constructor(private readonly redaction: RedactionService) {}

  @Post('redact-text')
  @RequirePermissions('dsar:requests:update')
  @ApiOperation({ summary: 'Redact PII from arbitrary text (stateless)' })
  async redactText(
    @CurrentUser('tenantId') _tenantId: string,
    @Body() dto: RedactTextDto,
  ) {
    const result = this.redaction.redactText(dto.text, {
      preserve: dto.preserve,
      categories: dto.categories,
    });
    return {
      data: {
        redactedText: result.redactedText,
        matchCount: result.matches.length,
        categoriesFound: result.categoriesFound,
      },
    };
  }
}
