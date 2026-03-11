import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsentService } from './consent.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import {
  CreateConsentNoticeDto,
  UpdateConsentNoticeDto,
  RecordConsentDto,
  RevokeConsentDto,
  CreateProcessingPurposeDto,
} from './dto/consent.dto';

@ApiTags('Consent')
@ApiBearerAuth()
@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  // ---------------------------------------------------------------------------
  // Notices
  // ---------------------------------------------------------------------------

  @Post('notices')
  @RequirePermissions('consent:notices:create')
  @ApiOperation({ summary: 'Create a consent notice' })
  async createNotice(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConsentNoticeDto,
  ) {
    const notice = await this.consentService.createNotice(
      tenantId,
      userId,
      dto,
    );
    return { data: notice };
  }

  @Get('notices')
  @RequirePermissions('consent:notices:read')
  @ApiOperation({ summary: 'List consent notices' })
  async findAllNotices(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.consentService.findAllNotices(tenantId, { page, pageSize });
  }

  @Get('notices/:id')
  @RequirePermissions('consent:notices:read')
  @ApiOperation({ summary: 'Get consent notice details' })
  async findNotice(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const notice = await this.consentService.findNoticeById(tenantId, id);
    return { data: notice };
  }

  @Put('notices/:id')
  @RequirePermissions('consent:notices:update')
  @ApiOperation({ summary: 'Update a consent notice' })
  async updateNotice(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsentNoticeDto,
  ) {
    const notice = await this.consentService.updateNotice(
      tenantId,
      id,
      userId,
      dto,
    );
    return { data: notice };
  }

  // ---------------------------------------------------------------------------
  // Purposes
  // ---------------------------------------------------------------------------

  @Post('purposes')
  @RequirePermissions('consent:purposes:create')
  @ApiOperation({ summary: 'Create a processing purpose' })
  async createPurpose(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProcessingPurposeDto,
  ) {
    const purpose = await this.consentService.createPurpose(
      tenantId,
      userId,
      dto,
    );
    return { data: purpose };
  }

  @Get('purposes')
  @RequirePermissions('consent:purposes:read')
  @ApiOperation({ summary: 'List processing purposes' })
  async findAllPurposes(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.consentService.findAllPurposes(tenantId, { page, pageSize });
  }

  // ---------------------------------------------------------------------------
  // Consent Records
  // ---------------------------------------------------------------------------

  @Post('records')
  @RequirePermissions('consent:records:create')
  @ApiOperation({ summary: 'Record a consent grant or denial' })
  async recordConsent(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RecordConsentDto,
  ) {
    const records = await this.consentService.recordConsent(
      tenantId,
      userId,
      dto,
    );
    return { data: records };
  }

  @Post('revoke')
  @RequirePermissions('consent:records:create')
  @ApiOperation({ summary: 'Revoke existing consent' })
  async revokeConsent(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RevokeConsentDto,
  ) {
    const result = await this.consentService.revokeConsent(
      tenantId,
      userId,
      dto,
    );
    return { data: result };
  }

  @Get('records')
  @RequirePermissions('consent:records:read')
  @ApiOperation({ summary: 'List consent records' })
  async findAllRecords(
    @CurrentUser('tenantId') tenantId: string,
    @Query('data_subject_id') dataSubjectId?: string,
    @Query('status') status?: string,
    @Query('purpose_id') purposeId?: string,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    return this.consentService.findAllRecords(tenantId, {
      dataSubjectId,
      status,
      purposeId,
      page,
      pageSize,
    });
  }

  // ---------------------------------------------------------------------------
  // Preference Center
  // ---------------------------------------------------------------------------

  @Get('preference-center/:dataSubjectId')
  @RequirePermissions('consent:read')
  @ApiOperation({ summary: 'Get preference center for a data subject' })
  async getPreferenceCenter(
    @CurrentUser('tenantId') tenantId: string,
    @Param('dataSubjectId') dataSubjectId: string,
  ) {
    const result = await this.consentService.getPreferenceCenter(
      tenantId,
      dataSubjectId,
    );
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Jurisdictions
  // ---------------------------------------------------------------------------

  @Get('jurisdictions')
  @RequirePermissions('consent:read')
  @ApiOperation({ summary: 'Get consent records grouped by jurisdiction' })
  async getConsentByJurisdiction(
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const result = await this.consentService.getConsentByJurisdiction(tenantId);
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Link to RoPA
  // ---------------------------------------------------------------------------

  @Post('link-ropa')
  @RequirePermissions('consent:admin')
  @ApiOperation({ summary: 'Link a processing purpose to a RoPA entry' })
  async linkToRopa(
    @CurrentUser('tenantId') tenantId: string,
    @Body('purposeId') purposeId: string,
    @Body('ropaId') ropaId: string,
  ) {
    const result = await this.consentService.linkToRopa(
      tenantId,
      purposeId,
      ropaId,
    );
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Consent Timeline
  // ---------------------------------------------------------------------------

  @Get('timeline/:dataSubjectId')
  @RequirePermissions('consent:read')
  @ApiOperation({ summary: 'Get consent timeline for a data subject' })
  async getConsentTimeline(
    @CurrentUser('tenantId') tenantId: string,
    @Param('dataSubjectId') dataSubjectId: string,
  ) {
    const timeline = await this.consentService.getConsentTimeline(
      tenantId,
      dataSubjectId,
    );
    return { data: timeline };
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  @Get('stats')
  @RequirePermissions('consent:records:read')
  @ApiOperation({ summary: 'Get consent statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    const stats = await this.consentService.getStats(tenantId);
    return { data: stats };
  }
}
