import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthService, JwtPayload } from './auth.service';
import { SessionService } from './services/session.service';
import { MfaService } from './services/mfa.service';
import { RateLimit, RateLimitGuard } from './guards/rate-limit.guard';
import { PrismaService } from '@/core/prisma/prisma.service';
import { CryptoService } from '@/core/crypto/crypto.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() body: { email: string; password: string; tenantSlug?: string },
    @Req() req: Request,
  ) {
    const user = await this.authService.validateCredentials(
      body.email,
      body.password,
      body.tenantSlug,
    );

    // If MFA is enabled, return a temporary token requiring MFA verification
    if (user.mfaEnabled) {
      const mfaPendingToken = this.authService.generateMfaPendingToken(
        user.id,
        user.tenantId,
      );

      return {
        requiresMfa: true,
        mfaToken: mfaPendingToken,
      };
    }

    // No MFA — create session and return tokens
    const payload = this.authService.buildPayloadFromUser(user);
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionId = await this.sessionService.createSession(
      user.id,
      user.tenantId,
      { ip, userAgent, provider: 'local' },
    );

    const deviceFingerprint = AuthService.deviceFingerprint(ip, userAgent);
    const tokens = this.authService.generateTokens(
      payload,
      sessionId,
      deviceFingerprint,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
    };
  }

  @Public()
  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'Complete MFA verification after login' })
  async loginMfa(
    @Body() body: { mfaToken: string; code: string },
    @Req() req: Request,
  ) {
    // Verify the MFA pending token
    const pendingPayload = this.authService.verifyToken(body.mfaToken);

    if (pendingPayload.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid MFA token');
    }

    const user = await this.authService.validateUser(pendingPayload.sub);

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not configured for this user');
    }

    // Decrypt the MFA secret for TOTP verification
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const decryptedSecret = await this.cryptoService.decrypt(user.mfaSecret, tenant.encryptionKeyId);

    // Try TOTP code first
    let isValid = this.mfaService.verifyToken(decryptedSecret, body.code);

    // If TOTP fails, try recovery code
    if (!isValid && user.mfaRecoveryCodes) {
      // Recovery codes are stored as encrypted JSON
      const recoveryCodes: string[] = typeof user.mfaRecoveryCodes === 'string'
        ? await this.cryptoService.decryptJson(user.mfaRecoveryCodes, tenant.encryptionKeyId)
        : user.mfaRecoveryCodes as string[];
      const result = this.mfaService.verifyRecoveryCode(
        recoveryCodes,
        body.code,
      );
      if (result.valid) {
        isValid = true;
        // Re-encrypt and update remaining recovery codes
        const encryptedRemaining = await this.cryptoService.encryptJson(
          result.remaining,
          tenant.encryptionKeyId,
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: encryptedRemaining as any },
        });
      }
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // MFA verified — create session and return tokens
    const payload = this.authService.buildPayloadFromUser(user);
    const mfaIp =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const mfaUa = req.headers['user-agent'] || 'unknown';
    const sessionId = await this.sessionService.createSession(
      user.id,
      user.tenantId,
      { ip: mfaIp, userAgent: mfaUa, provider: 'local' },
    );

    const mfaFingerprint = AuthService.deviceFingerprint(mfaIp, mfaUa);
    const tokens = this.authService.generateTokens(
      payload,
      sessionId,
      mfaFingerprint,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Refresh access token with rotation' })
  async refreshToken(
    @Body() body: { refreshToken: string },
    @Req() req: Request,
  ) {
    const ip =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const fingerprint = AuthService.deviceFingerprint(ip, userAgent);

    const { sub, sid } = await this.authService.validateRefreshToken(
      body.refreshToken,
      fingerprint,
    );

    const user = await this.authService.validateUser(sub);
    const payload = this.authService.buildPayloadFromUser(user);

    // Rotate: revoke old session, create new one
    const newSessionId = await this.authService.rotateRefreshToken(
      sid,
      user.id,
      user.tenantId,
      { ip, userAgent, provider: 'local' },
    );

    const tokens = this.authService.generateTokens(
      payload,
      newSessionId,
      fingerprint,
    );

    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(@CurrentUser() user: any) {
    if (user.sid) {
      await this.sessionService.revokeSession(user.sid);
    }
    return { message: 'Logged out successfully' };
  }

  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions for current user' })
  async logoutAll(@CurrentUser() user: any) {
    await this.sessionService.revokeAllUserSessions(user.id);
    return { message: 'All sessions revoked' };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions for current user' })
  async listSessions(@CurrentUser() user: any) {
    const sessions = await this.sessionService.listUserSessions(user.id);
    return {
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        ip: s.ip,
        userAgent: s.userAgent,
        provider: s.provider,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        isCurrent: s.sessionId === user.sid,
      })),
    };
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret for MFA setup' })
  async mfaSetup(@CurrentUser() user: any) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (dbUser?.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { secret, otpauthUrl, qrCodeDataUrl } =
      await this.mfaService.generateSecret(user.email);

    // Encrypt the secret before storing
    const encryptedSecret = await this.cryptoService.encrypt(
      secret,
      (await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } })).encryptionKeyId,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptedSecret },
    });

    return { otpauthUrl, qrCodeDataUrl };
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA by verifying TOTP code' })
  async mfaEnable(
    @Body() body: { code: string },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser?.mfaSecret) {
      throw new BadRequestException(
        'MFA setup not initiated. Call POST /auth/mfa/setup first.',
      );
    }

    if (dbUser.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    // Decrypt the stored MFA secret for verification
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const decryptedSecret = await this.cryptoService.decrypt(dbUser.mfaSecret, tenant.encryptionKeyId);

    const isValid = this.mfaService.verifyToken(decryptedSecret, body.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate recovery codes and encrypt them before storing
    const recoveryCodes = this.mfaService.generateRecoveryCodes();
    const encryptedRecoveryCodes = await this.cryptoService.encryptJson(
      recoveryCodes,
      tenant.encryptionKeyId,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaRecoveryCodes: encryptedRecoveryCodes as any,
      },
    });

    // Regenerate session after privilege elevation to prevent session fixation
    if (user.sid) {
      await this.sessionService.revokeSession(user.sid);
    }
    const payload = this.authService.buildPayloadFromUser(dbUser);
    const ip =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const newSessionId = await this.sessionService.createSession(
      user.id,
      user.tenantId,
      { ip, userAgent, provider: 'local' },
    );
    const fingerprint = AuthService.deviceFingerprint(ip, userAgent);
    const tokens = this.authService.generateTokens(
      payload,
      newSessionId,
      fingerprint,
    );

    return {
      message: 'MFA enabled successfully',
      recoveryCodes,
      ...tokens,
    };
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA (requires current TOTP code)' })
  async mfaDisable(
    @Body() body: { code: string },
    @CurrentUser() user: any,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser?.mfaEnabled || !dbUser.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const tenantForMfa = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const decryptedMfaSecret = await this.cryptoService.decrypt(dbUser.mfaSecret, tenantForMfa.encryptionKeyId);
    const isValid = this.mfaService.verifyToken(decryptedMfaSecret, body.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: null,
      },
    });

    return { message: 'MFA disabled successfully' };
  }

  // ─── OIDC (Keycloak) ───────────────────────────────────────

  @Public()
  @Get('oidc')
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'Initiate OIDC login redirect' })
  async oidcLogin() {
    // Passport redirects automatically
  }

  @Public()
  @Get('oidc/callback')
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'Handle OIDC callback' })
  async oidcCallback(@Req() req: Request) {
    const userPayload = req.user as JwtPayload;
    const ip =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const sessionId = await this.sessionService.createSession(
      userPayload.sub,
      userPayload.tenantId,
      { ip, userAgent, provider: 'oidc' },
    );

    const fingerprint = AuthService.deviceFingerprint(ip, userAgent);
    const tokens = this.authService.generateTokens(
      userPayload,
      sessionId,
      fingerprint,
    );

    return {
      ...tokens,
      user: {
        id: userPayload.sub,
        email: userPayload.email,
        tenantId: userPayload.tenantId,
      },
    };
  }

  // ─── SAML 2.0 ──────────────────────────────────────────────

  @Public()
  @Get('saml')
  @UseGuards(AuthGuard('saml'))
  @ApiOperation({ summary: 'Initiate SAML login' })
  async samlLogin() {
    // Passport redirects automatically
  }

  @Public()
  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle SAML assertion callback' })
  async samlCallback(@Req() req: Request) {
    const userPayload = req.user as JwtPayload;
    const ip =
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const sessionId = await this.sessionService.createSession(
      userPayload.sub,
      userPayload.tenantId,
      { ip, userAgent, provider: 'saml' },
    );

    const fingerprint = AuthService.deviceFingerprint(ip, userAgent);
    const tokens = this.authService.generateTokens(
      userPayload,
      sessionId,
      fingerprint,
    );

    return {
      ...tokens,
      user: {
        id: userPayload.sub,
        email: userPayload.email,
        tenantId: userPayload.tenantId,
      },
    };
  }

  @Public()
  @Get('saml/metadata')
  @ApiOperation({ summary: 'Serve SAML SP metadata XML' })
  async samlMetadata(@Res() res: Response) {
    // Access the underlying SAML strategy to generate metadata
    try {
      const { Strategy } = await import('@node-saml/passport-saml');
      // Generate minimal SP metadata
      const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="privacyops-sp">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="/api/v1/auth/saml/callback"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

      res.set('Content-Type', 'application/xml');
      res.send(metadata);
    } catch (error) {
      this.logger.error('Failed to generate SAML metadata', error);
      res.status(500).json({ message: 'SAML not configured' });
    }
  }
}
