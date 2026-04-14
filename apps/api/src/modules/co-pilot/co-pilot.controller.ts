import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoPilotService } from './co-pilot.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { RequireFeature } from '@/core/licensing/decorators/require-feature.decorator';

@ApiTags('AI Co-Pilot')
@ApiBearerAuth()
@RequireFeature('ai_copilot')
@Controller('co-pilot')
export class CoPilotController {
  constructor(private readonly coPilotService: CoPilotService) {}

  @Post('query')
  @RequirePermissions('copilot:query')
  @ApiOperation({ summary: 'Submit a natural language query to the AI co-pilot' })
  async processQuery(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { query: string; sessionId: string },
  ) {
    const result = await this.coPilotService.processQuery(
      tenantId,
      userId,
      body.query,
      body.sessionId,
    );
    return { data: result };
  }

  @Get('history')
  @RequirePermissions('copilot:read')
  @ApiOperation({ summary: 'Get co-pilot conversation history' })
  async getHistory(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('sessionId') sessionId?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.coPilotService.getHistory(
      tenantId,
      userId,
      sessionId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post('feedback/:id')
  @RequirePermissions('copilot:query')
  @ApiOperation({ summary: 'Provide feedback on a co-pilot response' })
  async provideFeedback(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { feedback: string },
  ) {
    const result = await this.coPilotService.provideFeedback(
      tenantId,
      id,
      body.feedback,
    );
    return { data: result };
  }

  @Get('suggestions')
  @RequirePermissions('copilot:read')
  @ApiOperation({ summary: 'Get suggested queries for the co-pilot' })
  async getSuggestions(@CurrentUser('tenantId') tenantId: string) {
    return this.coPilotService.getSuggestions(tenantId);
  }
}
