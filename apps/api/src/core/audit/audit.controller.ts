import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService, AuditCategory, AuditSeverity } from './audit.service';
import { RequirePermissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Search audit logs with filters' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  async searchLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const result = await this.auditService.search(tenantId, {
      action,
      actorId,
      entityType,
      category,
      severity,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    return result;
  }

  @Get('security-events')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Search security events' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  async searchSecurityEvents(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('severity') severity?: AuditSeverity,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const result = await this.auditService.search(tenantId, {
      action,
      actorId,
      category: 'security',
      severity,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    return result;
  }

  @Get('logs/:id')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  async getLog(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const log = await this.auditService.findById(tenantId, id);
    if (!log) {
      throw new NotFoundException('Audit log entry not found');
    }
    return { data: log };
  }

  @Post('verify-chain')
  @RequirePermissions('audit:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify audit log chain integrity' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  async verifyChain(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.auditService.verifyChain(
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );

    return { data: result };
  }

  @Get('export')
  @RequirePermissions('audit:export')
  @ApiOperation({ summary: 'Export audit logs as CSV or JSON' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'], description: 'Export format (default: json)' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  async exportLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query('format') format?: 'csv' | 'json',
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const logs = await this.auditService.exportLogs(tenantId, {
      action,
      actorId,
      entityType,
      category,
      severity,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    const exportFormat = format || 'json';

    if (exportFormat === 'csv') {
      const csvHeader = [
        'id',
        'timestamp',
        'actorId',
        'actorType',
        'action',
        'entityType',
        'entityId',
        'severity',
        'category',
        'ipAddress',
        'userAgent',
        'integrityHash',
        'changes',
      ].join(',');

      const csvRows = logs.map((log) =>
        [
          log.id,
          log.timestamp.toISOString(),
          log.actorId || '',
          log.actorType,
          log.action,
          log.entityType,
          log.entityId,
          log.severity || '',
          log.category || '',
          log.ipAddress || '',
          this.escapeCsvField(log.userAgent || ''),
          log.integrityHash,
          this.escapeCsvField(log.changes ? JSON.stringify(log.changes) : ''),
        ].join(','),
      );

      const csv = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${tenantId}-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.json({ data: logs, exportedAt: new Date().toISOString(), totalRecords: logs.length });
    }
  }

  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
