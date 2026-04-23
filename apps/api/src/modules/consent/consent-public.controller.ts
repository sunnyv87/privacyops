import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Public } from '@/core/auth/decorators/public.decorator';
import { ConsentService } from './consent.service';

/**
 * Public consent ingest endpoint. Marked @Public so the global JWT
 * guard skips it; authorization is instead enforced via a per-tenant
 * HMAC signature on the request body.
 *
 * Request shape:
 *   POST /consent/public/record
 *   Headers:
 *     X-Tenant-Id: <uuid>
 *     X-Consent-Signature: <hex HMAC-SHA256(body, derivedKey)>
 *   Body:
 *     { dataSubjectIdentifier, noticeId, status: 'granted'|'denied',
 *       channel?, ipAddress? }
 *
 * Key derivation:
 *   derivedKey = HMAC-SHA256(CONSENT_PUBLIC_SHARED_SECRET, tenantId)
 *
 * Deployments that need stronger per-tenant isolation can override by
 * setting env `CONSENT_PUBLIC_SECRET_<TENANTID>` (dash/uppercase), which
 * is preferred over the derived key when present.
 *
 * This endpoint ONLY accepts records-create flow. Revocation requires
 * the authenticated endpoints (signed session required).
 */
@ApiExcludeController()
@Controller('consent/public')
export class ConsentPublicController {
  private readonly logger = new Logger(ConsentPublicController.name);

  constructor(
    private readonly consent: ConsentService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('record')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Public consent ingest — HMAC-signed, anonymous-safe',
  })
  async recordPublicConsent(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-consent-signature') signature: string,
    @Body()
    body: {
      dataSubjectIdentifier: string;
      noticeId: string;
      status: 'granted' | 'denied';
      channel?: string;
      ipAddress?: string;
    },
  ) {
    if (!tenantId) throw new BadRequestException('X-Tenant-Id header required');
    if (!signature) throw new UnauthorizedException('signature missing');
    if (!body || !body.dataSubjectIdentifier || !body.noticeId || !body.status) {
      throw new BadRequestException(
        'dataSubjectIdentifier, noticeId, status required',
      );
    }
    if (body.status !== 'granted' && body.status !== 'denied') {
      throw new BadRequestException('status must be granted or denied');
    }

    // Verify HMAC signature.
    const sharedSecret = this.resolveSharedSecret(tenantId);
    if (!sharedSecret) {
      this.logger.error(
        `No public consent secret configured for tenant ${tenantId}`,
      );
      throw new UnauthorizedException('tenant not enabled for public ingest');
    }

    const canonical = JSON.stringify({
      dataSubjectIdentifier: body.dataSubjectIdentifier,
      noticeId: body.noticeId,
      status: body.status,
      channel: body.channel ?? null,
    });
    const expected = createHmac('sha256', sharedSecret).update(canonical).digest('hex');
    if (!this.timingSafeHex(signature, expected)) {
      this.logger.warn(
        `HMAC mismatch on public consent ingest for tenant ${tenantId}`,
      );
      throw new UnauthorizedException('signature invalid');
    }

    // Delegate to existing consent service — preserves audit + event path.
    // We pass a synthetic actorId because there's no authenticated user.
    const record = await this.consent.recordConsent(tenantId, 'system-public', {
      dataSubjectIdentifier: body.dataSubjectIdentifier,
      noticeId: body.noticeId,
      status: body.status,
      channel: body.channel ?? 'web',
      ipAddress: body.ipAddress,
    } as any);

    return { data: record };
  }

  /**
   * Resolve the HMAC shared secret for a tenant. Preference order:
   *   1. CONSENT_PUBLIC_SECRET_<TENANTID> (explicit per-tenant override)
   *   2. HMAC-SHA256(CONSENT_PUBLIC_SHARED_SECRET, tenantId) — derived
   * Returns null if neither source yields a usable secret.
   */
  private resolveSharedSecret(tenantId: string): string | null {
    const explicitKey = `CONSENT_PUBLIC_SECRET_${tenantId.replace(/-/g, '').toUpperCase()}`;
    const explicit = this.config.get<string>(explicitKey);
    if (explicit && explicit.length >= 32) return explicit;

    const shared = this.config.get<string>('CONSENT_PUBLIC_SHARED_SECRET');
    if (!shared || shared.length < 32) return null;
    return createHmac('sha256', shared).update(tenantId).digest('hex');
  }

  /**
   * Constant-time hex comparison. Returns false if lengths differ or if
   * either input is not valid hex, without leaking which check failed.
   */
  private timingSafeHex(a: string, b: string): boolean {
    try {
      const aBuf = Buffer.from(a, 'hex');
      const bBuf = Buffer.from(b, 'hex');
      if (aBuf.length === 0 || aBuf.length !== bBuf.length) {
        // Still run a dummy compare to avoid timing difference on length.
        timingSafeEqual(bBuf, bBuf);
        return false;
      }
      return timingSafeEqual(aBuf, bBuf);
    } catch {
      return false;
    }
  }
}
